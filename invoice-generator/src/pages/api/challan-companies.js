import { getSupabaseAdminClient } from '../../lib/supabaseServer'

const UNION_FABRICS_CANONICAL = 'Union Fabrics (Pvt) Ltd.'
const isUnionFabrics = (name) => String(name || '').trim().toLowerCase().startsWith('union fabrics')

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('DeliveryChallan')
      .select('Industry')
      .order('Industry', { ascending: true })
      .limit(2000)

    if (error) return res.status(500).json({ error: error.message })
    const set = new Set()
    for (const r of (data || [])) {
      const name = r?.Industry && String(r.Industry).trim()
      if (name) {
        // Normalize all "Union Fabrics*" variations to one canonical name
        set.add(isUnionFabrics(name) ? UNION_FABRICS_CANONICAL : name)
      }
    }
    const list = Array.from(set).sort()
    return res.status(200).json(list)
  } catch (e) {
    console.error('/api/challan-companies exception:', e)
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
