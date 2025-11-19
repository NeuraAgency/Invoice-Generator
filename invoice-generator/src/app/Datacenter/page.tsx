'use client'

import React, { useState, useEffect } from 'react'
import { createWorker } from 'tesseract.js'
import { PDFDocument } from 'pdf-lib'
import { runAgent } from '../../agents/agents'

const Page = () => {
  // Local uploaded files (kept if still needed for OCR preview) but display will use DB docs
  const [files, setFiles] = useState<File[]>([])
  const [image, setImage] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [texts, setTexts] = useState<{ [key: string]: string }>({})
  const [docs, setDocs] = useState<Array<{ id: number; document_no: string | null; document_date: string | null; URL: string | null; items?: any }>>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Fetch persisted documents from database
  const fetchDocs = async () => {
    try {
      setDocsLoading(true)
      setDocsError(null)
      const res = await fetch('/api/extractions?limit=50')
      if (!res.ok) {
        throw new Error(`Failed to load documents: ${res.status}`)
      }
      const data = await res.json()
      setDocs(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setDocsError(e.message || 'Unknown error loading documents')
    } finally {
      setDocsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  const isImageUrl = (u: string) => /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(u)

  const extractPDFText = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();
      let extractedText = '';

      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        // pdf-lib does not support text extraction directly.
        // You may use a placeholder or integrate another library for real extraction.
        extractedText += '[Text extraction from PDF not supported by pdf-lib]\n';
      }

      return extractedText;
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      return 'Failed to extract text from PDF';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const newFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...newFiles])

    const file = newFiles[0]
    setImage(file)
    setSelectedFile(file)
    setText('')
    setSelectedText('')

    if (file.type === 'application/pdf') {
      setLoading(true)
      try {
        const extractedText = await extractPDFText(file)
        setText(extractedText)
        setTexts(prev => ({ ...prev, [file.name]: extractedText }))
        setSelectedText(extractedText)
      } catch (error) {
        console.error('Error extracting PDF:', error)
      } finally {
        setLoading(false)
      }
    } else if (file.type.startsWith('image/')) {
      setLoading(true)
      try {
        const extraction = await runAgent(file)
        console.log('Gemini extraction result:', extraction)
        const extractedText = extraction.raw ?? JSON.stringify(extraction, null, 2)
        setText(extractedText)
        setTexts(prev => ({ ...prev, [file.name]: extractedText }))
        setSelectedText(extractedText)
      } catch (error) {
        console.error('Error extracting image text with agent:', error)
      } finally {
        setLoading(false)
      }
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
    if (selectedFile === image) setSelectedText(extractedText)
    await worker.terminate()
    setLoading(false)
  }

  const handleDelete = (fileToDelete: File) => {
    setFiles(prev => prev.filter(file => file !== fileToDelete))
    setTexts(prev => {
      const newTexts = { ...prev }
      delete newTexts[fileToDelete.name]
      return newTexts
    })
    if (selectedFile === fileToDelete) {
      setSelectedFile(null)
      setSelectedText('')
    }
    if (image === fileToDelete) {
      setImage(null)
      setText('')
    }
  }

  // We display database docs instead of recently uploaded local files

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center p-7">
      <div className="flex w-full h-full max-w-[1600px] gap-6 p-8">
        <div className="w-1/2 flex flex-col gap-2 max-h-full overflow-y-auto">
          <div className="flex items-end justify-between gap-3 mb-2">
                <h2 className="text-[var(--accent)] font-semibold">Documents</h2>
            <div className="flex items-end gap-4">
              <div className="flex flex-col">
                <h2 className="font-semibold text-sm text-white">Enter GatePass Number</h2>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search GP"
                  className="my-2 w-40 text-sm border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/50"
                />
              </div>
              <button
                onClick={fetchDocs}
                className="text-sm px-2 py-1 border border-[var(--accent)] text-[var(--accent)] rounded hover:bg-[var(--accent)] hover:text-white transition"
                disabled={docsLoading}
              >
                {docsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          {docsError && (
            <div className="text-red-500 text-sm mb-2">{docsError}</div>
          )}
          {(!docsLoading && docs.length === 0) && (
            <div className="text-[var(--accent)] text-center mt-8">No documents found</div>
          )}
          {(docs
            .filter(doc => {
              if (!search.trim()) return true
              const q = search.trim().toLowerCase()
              const inDocNo = (doc.document_no || '').toLowerCase().includes(q)
              const inItems = Array.isArray(doc.items) && doc.items.some((it: any) => {
                const d1 = (it.materialDescription || '').toLowerCase().includes(q)
                const d2 = (it.materialNo || '').toLowerCase().includes(q)
                const d3 = (it.indNo || it.IND || '').toLowerCase().includes(q)
                const d4 = (it.quantityFromRemarks || '').toLowerCase().includes(q)
                return d1 || d2 || d3 || d4
              })
              return inDocNo || inItems
            }))
          .map(doc => (
            <div
              key={doc.id}
              className="w-11/12 flex items-center gap-3 bg-black border border-orange-500 rounded-lg px-4 py-3 text-white hover:border-orange-400 transition-all"
            >
              {/* Preview (image if possible) */}
              <div className="flex-shrink-0">
                {doc.URL && isImageUrl(doc.URL) ? (
                  <img
                    src={doc.URL}
                    alt={doc.document_no ?? `Document-${doc.id}`}
                    className="h-16 w-16 object-cover rounded bg-white"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-16 w-16 flex items-center justify-center rounded bg-gray-800 text-xs text-gray-300">
                    No Preview
                  </div>
                )}
              </div>

              {/* Meta (Gatepass no, date, and URL link) */}
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">
                    {doc.document_no || '—'}
                  </span>
                  <span className="text-xs text-[var(--accent)] whitespace-nowrap">
                    {doc.document_date || '—'}
                  </span>
                </div>
                {doc.URL && (
                  <a
                    href={doc.URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline break-all"
                  >
                    {doc.URL}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="w-1/2 flex flex-col gap-6 items-stretch">
          <div className="flex-1 bg-[#e2c6b6] rounded-lg flex items-center justify-center overflow-hidden min-h-4/5">
            {selectedFile ? (
              selectedFile.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-black text-center p-4">
                  <p className="text-xl font-semibold">{selectedFile.name}</p>
                  <p className="text-sm">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              )
            ) : null}
          </div>
          <input 
            id="file-upload" 
            type="file" 
            accept="image/*,.pdf,.doc,.docx" 
            multiple 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <div className="flex gap-3">
            <button
              className="inline-flex items-center justify-center rounded-md bg-orange-600 px-4 py-2 h-10 min-w-[130px] text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              Upload File
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md bg-gray-700 px-4 py-2 h-10 min-w-[130px] text-sm font-semibold text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={fetchDocs}
              disabled={docsLoading}
            >
              {docsLoading ? 'Loading…' : 'Load Docs'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Page
