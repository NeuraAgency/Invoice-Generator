import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdminClient()

    if (req.method === 'GET') {
      const { challan, limit } = req.query

      // If challan query provided, perform a prefix search on challanno
      if (challan && typeof challan === 'string') {
        const lim = Number(limit) || 10

        // challanno is stored as a number; we support simple prefix search
        // by interpreting the query as a number and filtering rows whose
        // challanno starts with the provided digits.
        const parsed = Number(challan.replace(/\D/g, ''))

        if (!Number.isNaN(parsed)) {
          const { data, error } = await supabase
            .from('DeliveryChallan')
            .select('*')
            .gte('challanno', parsed)
            .lt('challanno', parsed * 10)
            .order('created_at', { ascending: false })
            .limit(lim)

          if (error) return res.status(500).json({ error: error.message })
          return res.status(200).json(data)
        }
      }

      // Default: return all (existing behavior)
      const { data, error } = await supabase
        .from('DeliveryChallan')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const { Date, PO, GP, Industry, Description } = req.body

      // Compute base next number: scan recent rows and find max numeric challanno
      let baseNext = 1
      try {
        const { data: recent } = await supabase
          .from('DeliveryChallan')
          .select('challanno,id')
          .order('id', { ascending: false })
          .limit(100)

        if (Array.isArray(recent) && recent.length > 0) {
          let maxSeen = 0
          for (const r of recent) {
            const num = Number(String(r?.challanno ?? '').replace(/\D/g, ''))
            if (!Number.isNaN(num)) maxSeen = Math.max(maxSeen, num)
          }
          baseNext = maxSeen + 1
        }
      } catch (e) {
        baseNext = 1
      }

      // Try to insert; if PK conflict on challanno, bump and retry a few times
      const maxAttempts = 5
      let attempt = 0
      let lastErr = null
      while (attempt < maxAttempts) {
        const candidate = baseNext + attempt
        const challanStr = String(candidate).padStart(5, '0')

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
                challanno: candidate
              }
            ],
            { returning: 'representation' }
          )
          .select('*')
          .single()

        if (!error) {
          return res.status(201).json({ data, challan: challanStr })
        }

        // Unique violation (duplicate challanno) — try next number
        if (error?.code === '23505' || /duplicate key value/i.test(String(error?.message))) {
          lastErr = error
          attempt += 1
          continue
        }

        // Other errors: bail out
        return res.status(500).json({ error: error.message })
      }

      // If we got here, we ran out of attempts due to contention
      return res.status(409).json({ error: 'Could not allocate a unique challan number. Please retry.' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
