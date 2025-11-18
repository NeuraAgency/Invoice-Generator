import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdminClient()

    if (req.method === 'GET') {
      const { gp, limit } = req.query

      // If gp query provided, perform a case-insensitive prefix search on GP
      if (gp && typeof gp === 'string') {
        const lim = Number(limit) || 10
        const { data, error } = await supabase
          .from('DeliveryChallan')
          .select('*')
          .ilike('GP', `${gp}%`)
          .order('created_at', { ascending: false })
          .limit(lim)

        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json(data)
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

      // Determine previous challan: prefer challanno, else fallback to id
      let prevNumber = 0
      try {
        const { data: lastRows, error: lastErr } = await supabase
          .from('DeliveryChallan')
          .select('challanno,id')
          .order('id', { ascending: false })
          .limit(1)

        if (!lastErr && Array.isArray(lastRows) && lastRows.length > 0) {
          const last = lastRows[0]
          if (last?.challanno) {
            // extract numeric part (handles padded strings)
            const digits = String(last.challanno).replace(/\D/g, '')
            const n = Number(digits)
            if (!Number.isNaN(n)) prevNumber = n
            else if (last?.id) prevNumber = Number(last.id) || 0
          } else if (last?.id) {
            prevNumber = Number(last.id) || 0
          }
        }
      } catch (e) {
        // ignore and default prevNumber = 0
      }

      const nextNumber = prevNumber + 1
      const challan = String(nextNumber).padStart(5, '0')

      // Insert the new row including the computed ChallanNo
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
              challanno: challan
            }
          ],
          { returning: 'representation' }
        )
        .select('*')
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json({ data, challan })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
