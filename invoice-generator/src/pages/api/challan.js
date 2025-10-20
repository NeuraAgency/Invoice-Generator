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

      const { data, error } = await supabase
        .from('DeliveryChallan')
        .insert([
          {
            Date,
            PO,
            GP,
            Industry,
            Description
          }
        ])

      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
