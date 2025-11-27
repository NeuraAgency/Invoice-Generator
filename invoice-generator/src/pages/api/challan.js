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
