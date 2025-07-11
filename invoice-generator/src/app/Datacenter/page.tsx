'use client'

import React, { useState } from 'react'
import { createWorker } from 'tesseract.js'

const Page = () => {
  const [image, setImage] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0])
      setText('')
    }
  }

  const preprocessImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      const reader = new FileReader()

      reader.onload = (e) => {
        if (!e.target?.result) return
        img.src = e.target.result as string
      }

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        canvas.width = img.width
        canvas.height = img.height

        // Draw image
        ctx.drawImage(img, 0, 0)

        // Convert to grayscale + threshold
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
          const value = avg > 128 ? 255 : 0 // simple threshold
          data[i] = data[i + 1] = data[i + 2] = value
        }

        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }

      reader.readAsDataURL(file)
    })
  }

  const handleExtract = async () => {
    if (!image) return
    setLoading(true)

    const enhancedImageBase64 = await preprocessImage(image)

    const worker = await createWorker('eng');


    const {
      data: { text: extractedText }
    } = await worker.recognize(enhancedImageBase64)

    setText(extractedText)
    await worker.terminate()
    setLoading(false)
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📄 Upload Image for OCR</h2>
      <input type="file" accept="image/*" onChange={handleImageChange} className="mb-4" />
      <button
        onClick={handleExtract}
        disabled={!image || loading}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? 'Extracting...' : 'Extract Text'}
      </button>
      <div className="mt-6">
        <h3 className="text-xl font-semibold mb-2">📖 Extracted Text:</h3>
        <pre className="bg-black  p-4 rounded whitespace-pre-wrap">{text}</pre>
      </div>
    </div>
  )
}

export default Page
