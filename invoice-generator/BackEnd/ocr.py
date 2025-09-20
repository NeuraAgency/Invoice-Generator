from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
import pytesseract
import re
import io

app = FastAPI()

@app.post("/extract-fields/")
async def extract_fields(file: UploadFile = File(...)):
    # Check image type
    if not (file.filename.endswith(".png") or file.filename.endswith(".jpg") or file.filename.endswith(".jpeg")):
        raise HTTPException(status_code=400, detail="Only image files (PNG/JPG) are allowed.")

    # Read image
    image_data = await file.read()
    image = Image.open(io.BytesIO(image_data))

    # Run OCR
    text = pytesseract.image_to_string(image)

    # Extract fields with regex
    extracted = {}

    # Company name
    company_match = re.search(r"KASSIM TEXTILES.*", text, re.IGNORECASE)
    if company_match:
        extracted["company_name"] = company_match.group().strip()

    # Gate Pass No
    gp_match = re.search(r"Gate Pass No.*?:\s*([A-Z0-9/]+)", text, re.IGNORECASE)
    if gp_match:
        extracted["gate_pass_no"] = gp_match.group(1).strip()

    # Date
    date_match = re.search(r"Date\s*:\s*([0-9]{1,2}[-/][A-Za-z]+[-/][0-9]{2,4})", text)
    if date_match:
        extracted["date"] = date_match.group(1).strip()

    # Items (loop through table rows)
    items = []
    for line in text.splitlines():
        if re.search(r"\d+\s+ALUMINIUM", line, re.IGNORECASE):
            parts = line.split()
            if len(parts) >= 4:
                item = {
                    "item_name": " ".join(parts[1:-2]),
                    "item_code": parts[-2],
                    "quantity": parts[-1]
                }
                items.append(item)
    if items:
        extracted["items"] = items

    return {"raw_text": text, "structured_data": extracted}
