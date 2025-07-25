'use client'

import React, { useState } from 'react'
import { createWorker } from 'tesseract.js'

const Page = () => {
  const [images, setImages] = useState<File[]>([])
  const [image, setImage] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [texts, setTexts] = useState<{ [key: string]: string }>({})

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setImages(prev => [...prev, ...newFiles])
      setImage(newFiles[0])
      setText('')
      setSelectedImage(newFiles[0])
      setSelectedText('')
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

        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
          const value = avg > 128 ? 255 : 0
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
    setTexts(prev => ({ ...prev, [image.name]: extractedText }))
    if (selectedImage === image) setSelectedText(extractedText)
    await worker.terminate()
    setLoading(false)
  }

  const handleDelete = (fileToDelete: File) => {
    setImages(prev => prev.filter(file => file !== fileToDelete))
    setTexts(prev => {
      const newTexts = { ...prev }
      delete newTexts[fileToDelete.name]
      return newTexts
    })
    if (selectedImage === fileToDelete) {
      setSelectedImage(null)
      setSelectedText('')
    }
    if (image === fileToDelete) {
      setImage(null)
      setText('')
    }
  }

  const fileList = images

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center p-7">
      <div className="flex w-full h-full max-w-[1600px] gap-6 p-8">
        <div className="w-1/2 flex flex-col gap-2 max-h-full overflow-y-auto">
          {fileList.length === 0 ? (
            <div className="text-orange-400 text-center mt-8">No files uploaded</div>
          ) : fileList.map((file, i) => (
            <div key={i} className="w-11/12 flex items-center justify-between bg-black border border-orange-500 rounded-lg px-4 py-3 text-white hover:border-orange-400 transition-all">
              <span className="truncate">{file.name}</span>
              <div className="flex items-center gap-3">
                <button 
                  className="hover:text-orange-400" 
                  onClick={() => handleDelete(file)}
                >
                  <img src="/trash.png" alt="delete" className="w-5" />
                </button>
                <button className="hover:text-orange-400" onClick={() => {
                  setSelectedImage(file)
                  setSelectedText(texts[file.name] || '')
                  setImage(file)
                  setText(texts[file.name] || '')
                }}>
                  <img src="/eye.png" alt="show" className="w-6" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="w-1/2 flex flex-col gap-6 items-stretch">
          <div className="flex-1 bg-[#e2c6b6] rounded-lg flex items-center justify-center overflow-hidden min-h-4/5">
            {selectedImage ? (
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Preview"
                className="max-h-full max-w-full object-contain"
              />
            ) : null}
          </div>
          {/* Extracted Text */}
          {/* <div className="flex-1 bg-[#e2c6b6] rounded-lg p-4 overflow-auto min-h-0">
            <h3 className="text-xl font-semibold mb-2 text-black">📖 Extracted Text:</h3>
            <pre className="bg-black text-white p-4 rounded whitespace-pre-wrap min-h-[300px]">{selectedText}</pre>
          </div> */}
          <input id="file-upload" type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
          <button
            className="bg-orange-600 text-white font-bold px-2 py-2 w-1/6 rounded-lg "
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            Upload File
          </button>
        </div>
      </div>
    </div>
  )
}

export default Page
