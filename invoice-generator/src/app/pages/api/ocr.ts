import type { NextApiRequest, NextApiResponse } from 'next';
import Tesseract from 'tesseract.js';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Important for file uploads
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const form = formidable({ multiples: false });

  form.parse(req, (err, fields, files) => {
    if (err) {
      res.status(500).json({ error: 'Error parsing file' });
      return;
    }

    const file = files.file as formidable.File;

    Tesseract.recognize(file.filepath, 'eng')
      .then(({ data: { text } }) => {
        res.status(200).json({ text });
      })
      .catch((error) => {
        res.status(500).json({ error: error.message });
      });
  });
}
