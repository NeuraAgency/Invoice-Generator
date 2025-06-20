export default async function handler(req, res) {
    if (req.method === "POST") {
      const formData = new FormData();
      formData.append("file", req.body);
  
      const response = await fetch("http://localhost:8000/ocr", {
        method: "POST",
        body: formData,
      });
  
      const data = await response.json();
      return res.status(200).json(data);
    } else {
      res.setHeader("Allow", ["POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  }
  