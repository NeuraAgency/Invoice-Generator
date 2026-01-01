import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

    const { billnos, date } = req.body || {}
    if (!Array.isArray(billnos) || billnos.length === 0) return res.status(400).json({ error: 'billnos[] is required' })
    if (!date) return res.status(400).json({ error: 'date is required' })

    const supabase = getSupabaseAdminClient()

    // Attempt to update created_at for the provided bill numbers
    const { data, error } = await supabase
      .from('invoice')
      .update({ created_at: date })
      .in('billno', billnos)
      .select('*')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  } catch (e) {
    console.error('/api/invoice-date exception:', e)
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
