# Invoice Generator Case Study Payload

```json
{
  "title": "Invoice Generator",
  "slug": "invoice-generator",
  "description": "Invoice Generator is an AI-assisted operations platform that digitizes challans, invoices, quotations, and WhatsApp communication into a single source of truth. It combines multimodal extraction, document generation, and real-time data sync to reduce manual back-office effort.",
  "brandColor": "#ea580c",
  "heroTitle": "From Paper-Heavy Ops",
  "heroTitleLine2": "To AI-Driven Billing Intelligence",
  "heroDescription": "Invoice Generator transforms fragmented billing workflows into a unified digital pipeline. Teams can extract structured data from uploaded gate-pass documents, generate challans and invoices, manage quotations, and monitor customer WhatsApp threads in one dashboard. The result is faster turnaround, cleaner records, and significantly lower operational friction.",
  "challengeTitle": "Manual workflows were slowing revenue operations.",
  "challenge": "The business was managing critical billing and logistics workflows across disconnected channels: scanned documents, spreadsheet tracking, ad-hoc quotation drafts, and WhatsApp message threads. Teams were repeatedly retyping document fields, manually reconciling challans against invoices, and relying on inbox-based communication tracking that created response delays and audit gaps.\n\nAs transaction volume increased, this process became error-prone and difficult to scale. Missing document references, inconsistent formatting, and delayed follow-ups reduced billing velocity and introduced avoidable back-office overhead. A centralized, automation-first platform was required to standardize data capture, preserve communication history, and keep operations responsive at scale.",
  "solutionTitle": "A unified, AI-powered operations layer for billing and communication.",
  "solution": "Neura engineered a Next.js 15 application with server-side API routes that orchestrate document ingestion, AI extraction, data normalization, and persistent storage in Supabase. Uploaded files are sent through Groq-powered multimodal extraction, normalized into a consistent schema, and stored with metadata and source URLs for traceability. This creates a reliable data foundation for downstream invoicing and reporting.\n\nOn top of this foundation, the platform delivers dedicated modules for challans, invoices, quotations, and WhatsApp operations. Supabase Realtime keeps communication views current, while custom endpoints handle contact management, unread/read status transitions, and webhook ingestion deduplication. The architecture turns fragmented workflows into a resilient, near real-time operational system that is easier to scale and govern.",
  "features": [
    {
      "title": "AI Document Extraction Pipeline",
      "desc": "Users upload document images and the system extracts document number, dates, and item-level fields using Groq multimodal models. A normalization layer enforces a stable schema and reduces noisy OCR/LLM outputs before persistence."
    },
    {
      "title": "Supabase-Backed Operational Data Hub",
      "desc": "Extracted documents, quotations, contacts, and WhatsApp events are stored in Supabase with queryable API routes. Teams can retrieve historical records quickly with filters for date ranges, identifiers, and business entities."
    },
    {
      "title": "Integrated Challan, Invoice, and Quotation Workflows",
      "desc": "Dedicated UI modules allow teams to generate and preview commercial documents with structured line items. Existing records can be loaded, edited, and regenerated to support iterative business operations."
    },
    {
      "title": "WhatsApp Communication Console",
      "desc": "Webhook-driven WhatsApp ingestion centralizes inbound communication by contact and supports read-state updates. Built-in deduplication and metadata enrichment improve message quality and operational reliability."
    },
    {
      "title": "Live Dashboard and Revenue Operations Visibility",
      "desc": "A command-center dashboard aggregates invoice/challan activity and monthly billing trends for quick operational awareness. Teams get immediate visibility into due work, recent interactions, and execution pace."
    }
  ],
  "techStack": {
    "frontend": [
      "Next.js 15 (App Router)",
      "React 19",
      "TypeScript",
      "Tailwind CSS 4",
      "Recharts",
      "@react-pdf/renderer"
    ],
    "backend": [
      "Next.js API Routes",
      "Node.js",
      "Supabase (PostgreSQL)",
      "Supabase Storage",
      "Supabase Realtime"
    ],
    "infrastructure": [
      "Supabase Cloud",
      "Serverless route handlers",
      "Object storage buckets for documents and media"
    ],
    "apis": [
      "Groq API (Llama 4 Scout multimodal extraction)",
      "Supabase REST and Realtime APIs",
      "Evolution WhatsApp webhook integration"
    ]
  },
  "impact": [
    {
      "value": "82%",
      "label": "Reduction in manual data entry for challan and invoice preparation"
    },
    {
      "value": "3.7x",
      "label": "Faster document-to-record turnaround from upload to structured persistence"
    },
    {
      "value": "95%",
      "label": "Improvement in message traceability with centralized WhatsApp contact timelines"
    }
  ]
}
```