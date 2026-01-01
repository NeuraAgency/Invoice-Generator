import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdminClient()

    if (req.method === 'GET') {
      const { bill, challan, limit, item, from, to, industry } = req.query
      const lim = Number(limit) || 50

      // Try to include DeliveryChallan info so we can see the Industry/Company.
      // If that join/select fails for any reason, fall back to a simple invoice select
      // to avoid returning 500 to the client.
      try {
        let query = supabase.from('invoice').select('*, DeliveryChallan(Industry, GP)')

        // Numeric prefix filter for billno
        if (bill && typeof bill === 'string') {
          const parsedBill = Number(String(bill).replace(/\D/g, ''))
          if (!Number.isNaN(parsedBill)) {
            query = query.gte('billno', parsedBill).lt('billno', parsedBill * 10)
          }
        }

        // Numeric prefix filter for challanno
        if (challan && typeof challan === 'string') {
          const parsedCh = Number(String(challan).replace(/\D/g, ''))
          if (!Number.isNaN(parsedCh)) {
            query = query.gte('challanno', parsedCh).lt('challanno', parsedCh * 10)
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

        const { data, error } = await query.order('billno', { ascending: false }).limit(lim)
        if (error) throw error
        // In-memory filters: industry and item smart match
        let resultData = Array.isArray(data) ? data : []
        if (industry && typeof industry === 'string') {
          const inorm = String(industry).trim().toLowerCase()
          resultData = resultData.filter(r => String(r?.DeliveryChallan?.Industry || '').toLowerCase() === inorm)
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
            const parsedBill = Number(String(bill).replace(/\D/g, ''))
            if (!Number.isNaN(parsedBill)) {
              fallback = fallback.gte('billno', parsedBill).lt('billno', parsedBill * 10)
            }
          }
          if (challan && typeof challan === 'string') {
            const parsedCh = Number(String(challan).replace(/\D/g, ''))
            if (!Number.isNaN(parsedCh)) {
              fallback = fallback.gte('challanno', parsedCh).lt('challanno', parsedCh * 10)
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

          const { data: fd, error: ferr } = await fallback.order('billno', { ascending: false }).limit(lim)
          if (ferr) {
            console.error('/api/invoice fallback query error:', ferr)
            return res.status(500).json({ error: String(ferr.message || ferr) })
          }
          let resultFd = Array.isArray(fd) ? fd : []
          if (industry && typeof industry === 'string') {
            const inorm = String(industry).trim().toLowerCase()
            resultFd = resultFd.filter(r => String(r?.DeliveryChallan?.Industry || '').toLowerCase() === inorm)
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
      const { challanno, lines, billno: requestedBillNo } = req.body

      if (!challanno || !Array.isArray(lines)) {
        return res.status(400).json({ error: 'challanno and lines[] are required' })
      }

      // Confirm challan exists 
      const { data: challanRow, error: challanError } = await supabase
        .from('DeliveryChallan')
        .select('challanno')
        .eq('challanno', challanno)
        .maybeSingle()

      if (challanError) {
        return res.status(500).json({ error: challanError.message })
      }
      if (!challanRow) {
        return res.status(404).json({ error: 'Challan not found' })
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
                challanno,
                Description: descriptionPayload,
              },
            ],
            { returning: 'representation' }
          )
          .select('*')
          .single()

        if (!error) {
          return res.status(201).json({ data, bill: billStr })
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
