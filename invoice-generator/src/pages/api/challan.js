import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdminClient()

    if (req.method === 'GET') {
      const { id, challan, limit, exact, industry, date, from, to, item } = req.query
      const lim = Number(limit) || 50

      // Fetch single challan by primary id (used for edit flows)
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

      // If challan query provided, perform a prefix search on challanno
      if (challan && typeof challan === 'string') {
        const lim = Number(limit) || 10

        // challanno is stored as a number; we support simple prefix search
        // by interpreting the query as a number and filtering rows whose
        // challanno starts with the provided digits.
        const parsed = Number(challan.replace(/\D/g, ''))

        if (!Number.isNaN(parsed)) {
          // If exact flag provided, return only exact challanno matches
          if (String(exact).toLowerCase() === '1' || String(exact).toLowerCase() === 'true') {
            const { data, error } = await supabase
              .from('DeliveryChallan')
              .select('*')
              .eq('challanno', parsed)
              .order('challanno', { ascending: false })
              .limit(lim)

            if (error) return res.status(500).json({ error: error.message })
            return res.status(200).json(data)
          }

          // Legacy: best-effort prefix search by casting to text and using like
          // Note: PostgREST allows text pattern matching on text columns; for numeric
          // columns, we use a computed text via RPC style filter. As a simpler fallback,
          // we narrow by a reasonable numeric window then filter in memory.
          const { data, error } = await supabase
            .from('DeliveryChallan')
            .select('*')
            .order('challanno', { ascending: false })
            .limit(500)

          if (error) return res.status(500).json({ error: error.message })

          const prefix = String(parsed)
          const filtered = (data || []).filter((row) => String(row?.challanno ?? '').startsWith(prefix)).slice(0, lim)
          return res.status(200).json(filtered)
        }
      }

      // Default: return with optional filters
      let query = supabase
        .from('DeliveryChallan')
        .select('*')
        .order('challanno', { ascending: false })
        .limit(lim)

      if (industry && typeof industry === 'string') {
        query = query.eq('Industry', industry)
      }

      if (date && typeof date === 'string') {
        // Some rows store human date in `Date` column; match exactly if provided
        query = query.eq('Date', date)
      }

      if (from && typeof from === 'string') {
        const d = new Date(from)
        if (!Number.isNaN(d.getTime())) {
          const fromIso = d.toISOString()
          query = query.gte('created_at', fromIso)
        }
      }

      if (to && typeof to === 'string') {
        const dt = new Date(to)
        if (!Number.isNaN(dt.getTime())) {
          dt.setHours(23, 59, 59, 999)
          query = query.lte('created_at', dt.toISOString())
        }
      }

      const { data, error } = await query

      if (error) return res.status(500).json({ error: error.message })

      // If challan prefix provided without exact flag, perform client-side prefix filter
      if (challan && typeof challan === 'string' && !(String(exact).toLowerCase() === '1' || String(exact).toLowerCase() === 'true')) {
        const parsed = Number(challan.replace(/\D/g, ''))
        if (!Number.isNaN(parsed)) {
          const lim = Number(limit) || 50
          const prefix = String(parsed)
          const filtered = (data || []).filter((row) => String(row?.challanno ?? '').startsWith(prefix)).slice(0, lim)
          return res.status(200).json(filtered)
        }
      }

      // Item name filter: matches any Description entry's text fields containing the query
      if (item && typeof item === 'string') {
        const q = item.trim().toLowerCase()
        const lim = Number(limit) || 50
        const filtered = (data || []).filter(row => {
          const desc = row?.Description
          const arr = Array.isArray(desc) ? desc : desc ? [desc] : []
          for (const d of arr) {
            const fields = [d?.description, d?.materialDescription, d?.desc]
            if (fields.some(f => typeof f === 'string' && f.toLowerCase().includes(q))) return true
          }
          return false
        }).slice(0, lim)
        return res.status(200).json(filtered)
      }

      return res.status(200).json(data)
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
