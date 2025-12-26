import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdminClient()

    if (req.method === 'GET') {
      const { bill, challan, limit } = req.query
      const lim = Number(limit) || 50

      // Try to include DeliveryChallan info so we can see the Industry/Company.
      // If that join/select fails for any reason, fall back to a simple invoice select
      // to avoid returning 500 to the client.
      try {
        let query = supabase.from('invoice').select('*, DeliveryChallan(Industry)')

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

        const { data, error } = await query.order('billno', { ascending: false }).limit(lim)
        if (error) throw error
        return res.status(200).json(data)
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
          const { data: fd, error: ferr } = await fallback.order('billno', { ascending: false }).limit(lim)
          if (ferr) {
            console.error('/api/invoice fallback query error:', ferr)
            return res.status(500).json({ error: String(ferr.message || ferr) })
          }
          return res.status(200).json(fd)
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
