import { getSupabaseAdminClient } from '../../lib/supabaseServer'

const isUnionFabrics = (name) => String(name || '').trim().toLowerCase().startsWith('union fabrics')

// Expresses "challanno starts with these digits" as DB-native numeric ranges
// (e.g. prefix "3" -> 3, 30-39, 300-399, ...) so the search can be pushed into
// the same query as every other filter via .or(), instead of requiring its own
// separate fetch-then-filter pass that ignores everything else and is capped
// by a fixed row window.
const buildPrefixRanges = (prefixNum, maxDigits = 7) => {
  const prefixStr = String(prefixNum)
  const k = prefixStr.length
  const ranges = []
  for (let L = k; L <= maxDigits; L++) {
    const multiplier = Math.pow(10, L - k)
    const lo = prefixNum * multiplier
    const hi = lo + multiplier - 1
    ranges.push([lo, hi])
  }
  return ranges
}

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdminClient()

    const shouldExcludeInvoiced = (val) => {
      const s = String(val ?? '').toLowerCase().trim()
      return s === '1' || s === 'true' || s === 'yes' || s === 'y'
    }

    const filterOutInvoiced = async (rows) => {
      try {
        const challannos = (Array.isArray(rows) ? rows : [])
          .map((r) => r?.challanno)
          .filter((c) => c != null)

        if (!challannos.length) return Array.isArray(rows) ? rows : []

        const { data: invRows, error: invErr } = await supabase
          .from('invoice')
          .select('challanno')
          .in('challanno', challannos)

        if (invErr) {
          // Fail open: return original challans rather than 500
          console.error('excludeInvoiced invoice lookup error:', invErr)
          return Array.isArray(rows) ? rows : []
        }

        const invoicedSet = new Set((invRows || []).map((r) => r?.challanno).filter((c) => c != null))
        return (Array.isArray(rows) ? rows : []).filter((r) => !invoicedSet.has(r?.challanno))
      } catch (e) {
        console.error('excludeInvoiced exception:', e)
        return Array.isArray(rows) ? rows : []
      }
    }

    if (req.method === 'GET') {
      const { id, challan, limit, exact, industry, date, from, to, item, excludeInvoiced, gp, indent } = req.query
      const lim = Number(limit) || 50
      const exclude = shouldExcludeInvoiced(excludeInvoiced)
      const isExact = String(exact).toLowerCase() === '1' || String(exact).toLowerCase() === 'true'

      // Fetch single challan by primary id (used for edit flows) — this is a
      // direct lookup, not a filtered list, so it stays as its own early return.
      if (id && typeof id === 'string') {
        const parsedId = Number(String(id).replace(/\D/g, ''))
        if (!Number.isNaN(parsedId)) {
          const { data, error } = await supabase
            .from('DeliveryChallan')
            .select('*')
            .eq('id', parsedId)
            .maybeSingle()

          if (error) return res.status(500).json({ error: error.message })
          if (!data) return res.status(404).json({ error: 'Not found' })
          return res.status(200).json(data)
        }
      }

      // Build one query with every DB-native filter chained onto it, so they all
      // combine (AND) together instead of branching into separate early-return
      // paths where a challan-number search would silently drop every other
      // filter (company, GP, date, item, indent, excludeInvoiced).
      let query = supabase.from('DeliveryChallan').select('*')

      const challanDigits = challan && typeof challan === 'string' ? challan.replace(/\D/g, '') : ''
      if (challanDigits.length > 0) {
        const parsed = Number(challanDigits)
        if (isExact) {
          query = query.eq('challanno', parsed)
        } else {
          // Prefix search expressed as numeric ranges pushed into the query itself
          // (see buildPrefixRanges), so it composes with the other filters and
          // isn't limited to whatever fits in a fixed-size fetch window.
          const ranges = buildPrefixRanges(parsed)
          const orExpr = ranges.map(([lo, hi]) => `and(challanno.gte.${lo},challanno.lte.${hi})`).join(',')
          query = query.or(orExpr)
        }
      }

      if (industry && typeof industry === 'string') {
        // If filtering by a Union Fabrics variant, match all Union Fabrics rows
        if (isUnionFabrics(industry)) {
          query = query.ilike('Industry', 'Union Fabrics%')
        } else {
          query = query.eq('Industry', industry)
        }
      }

      if (date && typeof date === 'string') {
        // Some rows store human date in `Date` column; match exactly if provided
        query = query.eq('Date', date)
      }

      if (from && typeof from === 'string') {
        const d = new Date(from)
        if (!Number.isNaN(d.getTime())) {
          query = query.gte('created_at', d.toISOString())
        }
      }

      if (to && typeof to === 'string') {
        const dt = new Date(to)
        if (!Number.isNaN(dt.getTime())) {
          dt.setHours(23, 59, 59, 999)
          query = query.lte('created_at', dt.toISOString())
        }
      }

      if (gp && typeof gp === 'string') {
        query = query.ilike('GP', `%${gp.trim()}%`)
      }

      query = query.order('challanno', { ascending: false })

      // item/indent (fuzzy substring match) and excludeInvoiced can't be expressed
      // as plain column filters, so they still run in memory below — but decoupled
      // from the display `limit`. When any of them are active we fetch a much
      // wider candidate window first (bounded by FETCH_CAP, not by `lim`), filter
      // that, and only then trim to `lim`. Otherwise (no such filters) we fetch
      // exactly `lim` rows as before, since there's nothing further to narrow.
      const hasItemFilter = Boolean(item && typeof item === 'string' && item.trim())
      const hasIndentFilter = Boolean(indent && typeof indent === 'string' && indent.trim())
      const needsWideWindow = hasItemFilter || hasIndentFilter || exclude
      const FETCH_CAP = 2000
      const fetchLimit = needsWideWindow ? Math.max(FETCH_CAP, lim) : lim
      query = query.limit(fetchLimit)

      const { data, error } = await query
      if (error) return res.status(500).json({ error: error.message })

      let filtered = data || []

      // Item name filter: matches any Description entry's text fields containing the query
      if (hasItemFilter) {
        const q = item.trim().toLowerCase()
        filtered = filtered.filter(row => {
          const desc = row?.Description
          const arr = Array.isArray(desc) ? desc : desc ? [desc] : []
          for (const d of arr) {
            const fields = [d?.description, d?.materialDescription, d?.desc]
            if (fields.some(f => typeof f === 'string' && f.toLowerCase().includes(q))) return true
          }
          return false
        })
      }

      // Indent number filter: matches any Description entry's indent number containing the query
      if (hasIndentFilter) {
        const q = indent.trim().toLowerCase()
        filtered = filtered.filter(row => {
          const desc = row?.Description
          const arr = Array.isArray(desc) ? desc : desc ? [desc] : []
          for (const d of arr) {
            const ind = String(d?.indNo ?? d?.indno ?? "")
            if (ind.toLowerCase().includes(q)) return true
          }
          return false
        })
      }

      if (exclude) {
        filtered = await filterOutInvoiced(filtered)
      }

      const out = filtered.slice(0, lim)
      return res.status(200).json(out)
    }

    if (req.method === 'PATCH') {
      const { id, challanno, Date, PO, GP, Industry, Description, Sample_returned } = req.body || {}

      const parsedId = id != null ? Number(String(id).replace(/\D/g, '')) : null
      const parsedChallanno = challanno != null ? Number(String(challanno).replace(/\D/g, '')) : null

      if (parsedId == null && parsedChallanno == null) {
        return res.status(400).json({ error: 'Missing id or challanno' })
      }

      let query = supabase
        .from('DeliveryChallan')
        .update({ Date, PO, GP, Industry, Description, Sample_returned })
        .select('*')

      if (parsedId != null && !Number.isNaN(parsedId)) {
        query = query.eq('id', parsedId)
      } else if (parsedChallanno != null && !Number.isNaN(parsedChallanno)) {
        query = query.eq('challanno', parsedChallanno)
      } else {
        return res.status(400).json({ error: 'Invalid id or challanno' })
      }

      const { data, error } = await query.maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Not found' })

      const challanStr = data?.challanno != null ? String(data.challanno).padStart(5, '0') : null
      return res.status(200).json({ data, challan: challanStr })
    }

    if (req.method === 'POST') {
      const { Date, PO, GP, Industry, Description, Sample_returned } = req.body

      // NEW: read the largest challanno from DB and add 1
      let nextChallanNo = 1
      try {
        const { data: maxRow, error: maxErr } = await supabase
          .from('DeliveryChallan')
          .select('challanno')
          .order('challanno', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (maxErr) {
          console.error('Error reading max challanno:', maxErr)
        } else if (maxRow && maxRow.challanno != null) {
          const currentMax = Number(String(maxRow.challanno).replace(/\D/g, ''))
          if (!Number.isNaN(currentMax)) {
            nextChallanNo = currentMax + 1
          }
        }
      } catch (e) {
        console.error('Exception while reading max challanno:', e)
        // fall back to 1
        nextChallanNo = 1
      }

      const challanStr = String(nextChallanNo).padStart(5, '0')

      // Insert single row with computed challanno
      const { data, error } = await supabase
        .from('DeliveryChallan')
        .insert(
          [
            {
              Date,
              PO,
              GP,
              Industry,
              Description,
              Sample_returned: Boolean(Sample_returned),
              challanno: nextChallanNo,
            },
          ],
          { returning: 'representation' }
        )
        .select('*')
        .single()

      if (error) {
        console.error('Error inserting DeliveryChallan:', error)
        // if DB has a unique constraint and this clashes, surface a clear message
        if (error.code === '23505' || /duplicate key value/i.test(String(error.message))) {
          return res
            .status(409)
            .json({ error: 'Could not allocate a unique challan number. Please retry.' })
        }
        return res.status(500).json({ error: error.message })
      }

      return res.status(201).json({ data, challan: challanStr })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
