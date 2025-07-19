import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://crietsezhyjpshzsyout.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  if (req.method === 'GET') {
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

  res.status(405).json({ error: 'Method not allowed' })
}
