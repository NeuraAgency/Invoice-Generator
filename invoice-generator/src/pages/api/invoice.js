import { getSupabaseAdminClient } from '../../lib/supabaseServer'

const isUnionFabrics = (name) => String(name || '').trim().toLowerCase().startsWith('union fabrics')

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdminClient()

    if (req.method === 'GET') {
      const { bill, challan, limit, item, from, to, industry, paid } = req.query
      const lim = Number(limit) || 1000

      const parsePaid = (v) => {
        if (v == null) return null
        const s = String(v).trim().toLowerCase()
        if (!s) return null
        if (s === '1' || s === 'true' || s === 'paid' || s === 'yes') return true
        if (s === '0' || s === 'false' || s === 'unpaid' || s === 'no') return false
        return null
      }
      const paidBool = parsePaid(paid)

      // Try to include DeliveryChallan info so we can see the Industry/Company.
      // If that join/select fails for any reason, fall back to a simple invoice select
      // to avoid returning 500 to the client.
      try {
        let query = supabase.from('invoice').select('*, DeliveryChallan(Industry, GP, PO)')

        // Filter for billno: exact match for numeric, ilike prefix for string patterns (e.g. KTML-0001)
        if (bill && typeof bill === 'string') {
          const trimmed = bill.trim()
          if (/[a-zA-Z]/.test(trimmed)) {
            // String-format bill number (e.g. KTML-0001) — use ilike for prefix match
            query = query.ilike('billno', `${trimmed}%`)
          } else {
            const parsedBill = Number(String(trimmed).replace(/\D/g, ''))
            if (!Number.isNaN(parsedBill) && parsedBill > 0) {
              query = query.eq('billno', parsedBill)
            }
          }
        }

        // Exact match filter for challanno
        if (challan && typeof challan === 'string') {
          const parsedCh = Number(String(challan).replace(/\D/g, ''))
          if (!Number.isNaN(parsedCh) && parsedCh > 0) {
            query = query.eq('challanno', parsedCh)
          }
        }

        // Date range filters on created_at
        if (from && typeof from === 'string') {
          const fromIso = new Date(from).toISOString()
          query = query.gte('created_at', fromIso)
        }
        if (to && typeof to === 'string') {
          const dt = new Date(to)
          dt.setHours(23, 59, 59, 999)
          query = query.lte('created_at', dt.toISOString())
        }

        // Paid filter (status column): unpaid includes false OR null
        if (paidBool === true) {
          query = query.eq('status', true)
        } else if (paidBool === false) {
          query = query.or('status.eq.false,status.is.null')
        }

        const { data, error } = await query.order('billno', { ascending: false }).limit(lim)
        if (error) throw error
        // In-memory filters: industry and item smart match
        let resultData = Array.isArray(data) ? data : []
        if (industry && typeof industry === 'string') {
          const inorm = String(industry).trim().toLowerCase()
          resultData = resultData.filter(r => {
            const ind = String(r?.DeliveryChallan?.Industry || '').trim()
            if (isUnionFabrics(inorm)) return isUnionFabrics(ind)
            return ind.toLowerCase() === inorm
          })
        }
        if (paidBool === true) {
          resultData = resultData.filter(r => r?.status === true)
        } else if (paidBool === false) {
          resultData = resultData.filter(r => r?.status === false || r?.status == null)
        }
        // Smart item filter on Description (token + fuzzy)
        if (item && typeof item === 'string') {
          const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
          const tokenize = (s) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean)
          const levenshtein = (a, b) => {
            a = normalize(a); b = normalize(b);
            const m = a.length, n = b.length;
            if (!m) return n; if (!n) return m;
            const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
            for (let i = 0; i <= m; i++) dp[i][0] = i;
            for (let j = 0; j <= n; j++) dp[0][j] = j;
            for (let i = 1; i <= m; i++) {
              for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                  dp[i - 1][j] + 1,
                  dp[i][j - 1] + 1,
                  dp[i - 1][j - 1] + cost
                );
              }
            }
            return dp[m][n];
          };
          const smartMatch = (query, text) => {
            const qTokens = tokenize(query);
            const tTokens = tokenize(text);
            if (!qTokens.length) return true;
            const allPresent = qTokens.every(qt => tTokens.some(tt => tt.includes(qt)));
            if (allPresent) return true;
            let matched = 0;
            for (const qt of qTokens) {
              let best = Infinity;
              for (const tt of tTokens) {
                const d = levenshtein(qt, tt);
                best = Math.min(best, d);
                if (best === 0) break;
              }
              const ok = best <= 2 || best <= Math.ceil(qt.length * 0.2);
              if (ok) matched++;
            }
            return matched >= Math.ceil(qTokens.length * 0.7);
          };

          const filtered = (resultData || []).filter(row => {
            const desc = row?.Description
            const arr = Array.isArray(desc) ? desc : desc ? [desc] : []
            for (const d of arr) {
              const combined = [d?.description, d?.materialDescription].filter(Boolean).join(' ')
              if (smartMatch(item, combined)) return true
            }
            return false
          })
          return res.status(200).json(filtered)
        }
        return res.status(200).json(resultData)
      } catch (e) {
        console.error('/api/invoice primary query error:', e)
        // fallback: try a simpler query without the join/relationship
        try {
          let fallback = supabase.from('invoice').select('*')
          if (bill && typeof bill === 'string') {
            const trimmed = bill.trim()
            if (/[a-zA-Z]/.test(trimmed)) {
              fallback = fallback.ilike('billno', `${trimmed}%`)
            } else {
              const parsedBill = Number(String(trimmed).replace(/\D/g, ''))
              if (!Number.isNaN(parsedBill) && parsedBill > 0) {
                fallback = fallback.eq('billno', parsedBill)
              }
            }
          }
          if (challan && typeof challan === 'string') {
            const parsedCh = Number(String(challan).replace(/\D/g, ''))
            if (!Number.isNaN(parsedCh) && parsedCh > 0) {
              fallback = fallback.eq('challanno', parsedCh)
            }
          }
          // Date range filters in fallback
          if (from && typeof from === 'string') {
            const fromIso = new Date(from).toISOString()
            fallback = fallback.gte('created_at', fromIso)
          }
          if (to && typeof to === 'string') {
            const dt = new Date(to)
            dt.setHours(23, 59, 59, 999)
            fallback = fallback.lte('created_at', dt.toISOString())
          }

          // Paid filter (status column): unpaid includes false OR null
          if (paidBool === true) {
            fallback = fallback.eq('status', true)
          } else if (paidBool === false) {
            fallback = fallback.or('status.eq.false,status.is.null')
          }

          const { data: fd, error: ferr } = await fallback.order('billno', { ascending: false }).limit(lim)
          if (ferr) {
            console.error('/api/invoice fallback query error:', ferr)
            return res.status(500).json({ error: String(ferr.message || ferr) })
          }
          let resultFd = Array.isArray(fd) ? fd : []
          if (industry && typeof industry === 'string') {
            const inorm = String(industry).trim().toLowerCase()
            resultFd = resultFd.filter(r => {
              const ind = String(r?.DeliveryChallan?.Industry || '').trim()
              if (isUnionFabrics(inorm)) return isUnionFabrics(ind)
              return ind.toLowerCase() === inorm
            })
          }
          if (paidBool === true) {
            resultFd = resultFd.filter(r => r?.status === true)
          } else if (paidBool === false) {
            resultFd = resultFd.filter(r => r?.status === false || r?.status == null)
          }
          if (item && typeof item === 'string') {
            const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
            const tokenize = (s) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean)
            const levenshtein = (a, b) => {
              a = normalize(a); b = normalize(b);
              const m = a.length, n = b.length;
              if (!m) return n; if (!n) return m;
              const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
              for (let i = 0; i <= m; i++) dp[i][0] = i;
              for (let j = 0; j <= n; j++) dp[0][j] = j;
              for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                  const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                  dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                  );
                }
              }
              return dp[m][n];
            };
            const smartMatch = (query, text) => {
              const qTokens = tokenize(query);
              const tTokens = tokenize(text);
              if (!qTokens.length) return true;
              const allPresent = qTokens.every(qt => tTokens.some(tt => tt.includes(qt)));
              if (allPresent) return true;
              let matched = 0;
              for (const qt of qTokens) {
                let best = Infinity;
                for (const tt of tTokens) {
                  const d = levenshtein(qt, tt);
                  best = Math.min(best, d);
                  if (best === 0) break;
                }
                const ok = best <= 2 || best <= Math.ceil(qt.length * 0.2);
                if (ok) matched++;
              }
              return matched >= Math.ceil(qTokens.length * 0.7);
            };

            const filtered = (resultFd || []).filter(row => {
              const desc = row?.Description
              const arr = Array.isArray(desc) ? desc : desc ? [desc] : []
              for (const d of arr) {
                const combined = [d?.description, d?.materialDescription].filter(Boolean).join(' ')
                if (smartMatch(item, combined)) return true
              }
              return false
            })
            return res.status(200).json(filtered)
          }
          return res.status(200).json(resultFd)
        } catch (err) {
          console.error('/api/invoice fallback exception:', err)
          return res.status(500).json({ error: String(err?.message || err) })
        }
      }
    }

    if (req.method === 'POST') {
      const { challanno, challannos, lines, billno: requestedBillNo } = req.body

      if (!challanno || !Array.isArray(lines)) {
        return res.status(400).json({ error: 'challanno and lines[] are required' })
      }

      const parseChallanno = (v) => {
        const n = Number(String(v ?? '').replace(/\D/g, ''))
        return Number.isFinite(n) && n > 0 ? n : null
      }

      const primaryCh = parseChallanno(challanno)
      if (!primaryCh) {
        return res.status(400).json({ error: 'Invalid challanno' })
      }

      const allChallans = (() => {
        if (!Array.isArray(challannos) || challannos.length === 0) return [primaryCh]
        const parsed = challannos.map(parseChallanno).filter(Boolean)
        const set = new Set(parsed)
        set.add(primaryCh)
        return Array.from(set)
      })()

      // Confirm challan(s) exist
      const { data: challanRows, error: challanError } = await supabase
        .from('DeliveryChallan')
        .select('challanno')
        .in('challanno', allChallans)

      if (challanError) {
        return res.status(500).json({ error: challanError.message })
      }
      const found = new Set((challanRows || []).map(r => r?.challanno))
      const missing = allChallans.filter(c => !found.has(c))
      if (missing.length > 0) {
        return res.status(404).json({ error: `Challan not found: ${missing.join(', ')}` })
      }

      // If the client sent a specific bill number (like KTML-0001), we use it.
      // Otherwise, we compute the next numeric one globally.
      let baseNext = 1
      if (requestedBillNo) {
        // If it's a string like "KTML-0001", we'll try to use it directly.
        // We'll trust the client's incrementing logic for now.
      } else {
        try {
          const { data: recent } = await supabase
            .from('invoice')
            .select('billno')
            .order('billno', { ascending: false })
            .limit(50)

          if (Array.isArray(recent) && recent.length > 0) {
            let maxSeen = 0
            for (const r of recent) {
              const num = Number(String(r?.billno ?? '').replace(/\D/g, ''))
              if (!Number.isNaN(num)) maxSeen = Math.max(maxSeen, num)
            }
            baseNext = maxSeen + 1
          }
        } catch (e) {
          baseNext = 1
        }
      }

      const maxAttempts = 5
      let attempt = 0

      while (attempt < maxAttempts) {
        let candidate = requestedBillNo
        if (!candidate) {
          candidate = baseNext + attempt
        } else if (attempt > 0) {
          // If we had a conflict with the requested one, we try to increment its numeric part
          const parts = String(requestedBillNo).split('-')
          if (parts.length === 2) {
            const prefix = parts[0]
            const num = Number(parts[1]) + attempt
            candidate = `${prefix}-${String(num).padStart(4, '0')}`
          } else {
            const numPart = String(requestedBillNo).match(/\d+$/)
            if (numPart) {
              const prefix = String(requestedBillNo).slice(0, -numPart[0].length)
              const num = Number(numPart[0]) + attempt
              candidate = `${prefix}${String(num).padStart(numPart[0].length, '0')}`
            } else {
              candidate = `${requestedBillNo}_${attempt}`
            }
          }
        }

        const billStr = String(candidate)

        const descriptionPayload = lines.map((l) => ({
          qty: l.qty,
          description: l.description,
          rate: l.rate ?? null,
          amount: l.amount,
        }))

        const { data, error } = await supabase
          .from('invoice')
          .insert(
            [
              {
                billno: candidate,
                challanno: primaryCh,
                Description: descriptionPayload,
              },
            ],
            { returning: 'representation' }
          )
          .select('*')
          .single()

        if (!error) {
          // Optional mapping: one invoice billno -> many challannos
          if (Array.isArray(allChallans) && allChallans.length > 1) {
            try {
              const mapRows = allChallans.map((c) => ({ billno: billStr, challanno: c }))
              const { error: mapErr } = await supabase.from('invoice_challans').insert(mapRows)
              if (mapErr) console.warn('invoice_challans insert failed (non-fatal):', mapErr)
            } catch (e) {
              console.warn('invoice_challans insert exception (non-fatal):', e)
            }
          }

          return res.status(201).json({ data, bill: billStr, challannos: allChallans })
        }

        if (error?.code === '23505' || /duplicate key value|already exists/i.test(String(error?.message))) {
          attempt += 1
          // If we are auto-generating a global numeric one, we also increment baseNext to be safe
          if (!requestedBillNo) attempt = attempt // baseNext + attempt handles it
          continue
        }

        return res.status(500).json({ error: error.message })
      }

      return res.status(409).json({ error: 'Could not allocate a unique bill number. Please retry.' })
    }

    if (req.method === 'DELETE') {
      const billno = (req.body && req.body.billno != null) ? req.body.billno : req.query?.billno
      const billStr = String(billno ?? '').trim()
      if (!billStr) return res.status(400).json({ error: 'billno is required' })

      // Try delete by exact billno string first (covers prefixes like KTML-0001)
      let deleted = []
      try {
        const { data, error } = await supabase
          .from('invoice')
          .delete()
          .eq('billno', billStr)
          .select('billno')

        if (error) return res.status(500).json({ error: error.message })
        deleted = Array.isArray(data) ? data : []
      } catch (e) {
        return res.status(500).json({ error: String(e?.message || e) })
      }

      // If nothing deleted and billno is numeric-only, try as number (covers numeric billno storage)
      if (deleted.length === 0 && /^[0-9]+$/.test(billStr)) {
        const num = Number(billStr)
        if (Number.isFinite(num)) {
          const { data, error } = await supabase
            .from('invoice')
            .delete()
            .eq('billno', num)
            .select('billno')
          if (error) return res.status(500).json({ error: error.message })
          deleted = Array.isArray(data) ? data : []
        }
      }

      if (deleted.length === 0) return res.status(404).json({ error: 'Invoice not found' })

      // Best-effort cleanup for multi-challan mapping
      try {
        const { error: mapErr } = await supabase.from('invoice_challans').delete().eq('billno', billStr)
        if (mapErr) console.warn('invoice_challans delete failed (non-fatal):', mapErr)
      } catch (e) {
        console.warn('invoice_challans delete exception (non-fatal):', e)
      }

      return res.status(200).json({ deleted: true, billno: billStr })
    }

    if (req.method === 'PATCH') {
      const { billno, status } = req.body || {}

      if (typeof status !== 'boolean') {
        return res.status(400).json({ error: 'status (boolean) is required' })
      }

      if (billno == null) {
        return res.status(400).json({ error: 'billno is required' })
      }

      const supabase = getSupabaseAdminClient()

      const { data, error } = await supabase.from('invoice').update({ status }).eq('billno', billno).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('/api/invoice outer exception:', e)
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
