import { getSupabaseAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdminClient()

    if (req.method === 'GET') {
      const { bill, challan, limit } = req.query
      const lim = Number(limit) || 50

      let query = supabase.from('invoice').select('*')

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

      const { data, error } = await query.order('created_at', { ascending: false }).limit(lim)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const { challanno, lines } = req.body

      if (!challanno || !Array.isArray(lines)) {
        return res.status(400).json({ error: 'challanno and lines[] are required' })
      }

      // Confirm challan exists (and can also fetch GP if needed later)
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

      // Compute next billno (same pattern as challan)
      let baseNext = 1
      try {
        const { data: recent } = await supabase
          .from('invoice')
          .select('billno,id')
          .order('id', { ascending: false })
          .limit(100)

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

      const maxAttempts = 5
      let attempt = 0

      while (attempt < maxAttempts) {
        const candidate = baseNext + attempt
        const billStr = String(candidate).padStart(5, '0')

        const descriptionPayload = lines.map((l) => ({
          qty: l.qty,
          description: l.description,
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

        if (error?.code === '23505' || /duplicate key value/i.test(String(error?.message))) {
          attempt += 1
          continue
        }

        return res.status(500).json({ error: error.message })
      }

      return res.status(409).json({ error: 'Could not allocate a unique bill number. Please retry.' })
    }

    if (req.method === 'PATCH') {
      const { id, billno, status } = req.body || {}

      if (typeof status !== 'boolean') {
        return res.status(400).json({ error: 'status (boolean) is required' })
      }

      const supabase = getSupabaseAdminClient()

      let query = supabase.from('invoice').update({ status }).select('*')
      if (id != null) {
        query = query.eq('id', id)
      } else if (billno != null) {
        query = query.eq('billno', billno)
      } else {
        return res.status(400).json({ error: 'id or billno is required' })
      }

      const { data, error } = await query.single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
