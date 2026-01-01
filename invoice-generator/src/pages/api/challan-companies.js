import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    const supabase = getSupabaseAdminClient()
    // Fetch distinct Industry values; Supabase distinct on select isn't cross-compatible in all versions,
    // so we fetch and de-duplicate in memory.
    const { data, error } = await supabase
      .from('DeliveryChallan')
      .select('Industry')
      .order('Industry', { ascending: true })
      .limit(2000)

    if (error) return res.status(500).json({ error: error.message })
    const set = new Set()
    for (const r of (data || [])) {
      const name = r?.Industry && String(r.Industry).trim()
      if (name) set.add(name)
    }
    const list = Array.from(set)
    return res.status(200).json(list)
  } catch (e) {
    console.error('/api/challan-companies exception:', e)
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
