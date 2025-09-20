from fastapi import FastAPI, UploadFile, File, HTTPException
import pdfplumber

app = FastAPI()

@app.post("/extract-text/")
async def extract_text(file: UploadFile = File(...)):
    # Only allow PDFs
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    text_content = ""
    try:
        # Read file into pdfplumber
        with pdfplumber.open(file.file) as pdf:
            for page in pdf.pages:
                text_content += page.extract_text() or ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

    return {"filename": file.filename, "extracted_text": text_content}
