import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://crietsezhyjpshzsyout.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fetch all rows from the table
    const { data, error } = await supabase.from('DeliveryChallan').select('*')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { field1, field2 } = req.body
    const { data, error } = await supabase
      .from('DeliveryChallan')
      .insert([{ field1, field2 }])
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
