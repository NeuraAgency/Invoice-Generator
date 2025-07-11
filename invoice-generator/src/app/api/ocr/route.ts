import { NextRequest, NextResponse } from 'next/server'
import tesseract from 'node-tesseract-ocr'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { base64Image } = await req.json()

    if (!base64Image) {
      console.error("❌ No image data provided.")
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 })
    }

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const filePath = path.join(os.tmpdir(), 'temp.png')
    fs.writeFileSync(filePath, buffer)
    console.log("✅ Image saved at", filePath)

    const config = {
      lang: 'eng',
      oem: 1,
      psm: 3
    }

    const text = await tesseract.recognize(filePath, config)
    console.log("✅ OCR complete")

    fs.unlinkSync(filePath)
    console.log("🗑️ Temp file deleted")

    return NextResponse.json({ text })
  } catch (error: any) {
    console.error("❌ OCR error:", error)
    return NextResponse.json({ error: error.message || 'Unknown server error' }, { status: 500 })
  }
}
