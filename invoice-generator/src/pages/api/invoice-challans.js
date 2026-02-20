import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { billno } = req.query
    const billStr = String(billno ?? '').trim()
    if (!billStr) {
      return res.status(400).json({ error: 'billno is required' })
    }

    const supabase = getSupabaseAdminClient()

    const loadChallanMeta = async (challannos) => {
      const nums = (Array.isArray(challannos) ? challannos : [])
        .map((n) => Number(String(n ?? '').replace(/\D/g, '')))
        .filter((n) => Number.isFinite(n) && n > 0)

      if (nums.length === 0) return { challannos: [], challans: [], gp: '', po: '' }

      try {
        const { data: rows, error } = await supabase
          .from('DeliveryChallan')
          .select('challanno, GP, PO')
          .in('challanno', nums)

        if (error) {
          console.warn('/api/invoice-challans DeliveryChallan meta failed:', error)
          return { challannos: nums, challans: [], gp: '', po: '' }
        }

        const challans = (rows || [])
          .map((r) => ({
            challanno: Number(r?.challanno),
            gp: r?.GP ?? null,
            po: r?.PO ?? null,
          }))
          .filter((r) => Number.isFinite(r.challanno) && r.challanno > 0)
          .sort((a, b) => a.challanno - b.challanno)

        const gp = Array.from(new Set(challans.map((c) => String(c.gp ?? '').trim()).filter(Boolean))).join(', ')
        const po = Array.from(new Set(challans.map((c) => String(c.po ?? '').trim()).filter(Boolean))).join(', ')

        return { challannos: challans.map((c) => c.challanno), challans, gp, po }
      } catch (e) {
        console.warn('/api/invoice-challans DeliveryChallan meta exception:', e)
        return { challannos: nums, challans: [], gp: '', po: '' }
      }
    }

    // Prefer the mapping table if it exists.
    try {
      const { data, error } = await supabase
        .from('invoice_challans')
        .select('challanno')
        .eq('billno', billStr)

      if (!error && Array.isArray(data) && data.length > 0) {
        const challannos = data
          .map((r) => Number(r?.challanno))
          .filter((n) => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b)

        const meta = await loadChallanMeta(challannos)
        return res.status(200).json({ billno: billStr, challannos: meta.challannos, challans: meta.challans, gp: meta.gp, po: meta.po })
      }

      // If the table exists but no rows, fall through to invoice fallback.
      if (error) {
        // If table doesn't exist or RLS blocks it, we fall back below.
        console.warn('/api/invoice-challans mapping query failed (fallback):', error)
      }
    } catch (e) {
      console.warn('/api/invoice-challans mapping exception (fallback):', e)
    }

    // Fallback: single challan on invoice row.
    const { data: inv, error: invErr } = await supabase
      .from('invoice')
      .select('billno, challanno')
      .eq('billno', billStr)
      .maybeSingle()

    if (invErr) return res.status(500).json({ error: invErr.message })
    if (!inv) return res.status(404).json({ error: 'Invoice not found' })

    const ch = Number(inv?.challanno)
    const challannos = Number.isFinite(ch) && ch > 0 ? [ch] : []
    const meta = await loadChallanMeta(challannos)
    return res.status(200).json({ billno: billStr, challannos: meta.challannos, challans: meta.challans, gp: meta.gp, po: meta.po })
  } catch (e) {
    console.error('/api/invoice-challans error:', e)
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
