## Invoice Generator

AI-assisted invoice, challan, and quotation extraction tool built on Next.js 15. Users can upload document images, have Groq's multimodal LLM extract structured data, and store the normalized output in Supabase for later retrieval.

## Prerequisites

- Node.js 18+
- npm (bundled with Node) or your preferred package manager
- Accounts and API keys for:
	- [Groq](https://groq.com/) — used for multimodal data extraction
	- [Supabase](https://supabase.com/) — used for persisting extracted documents

## Environment Variables

Create an `.env.local` file in the project root with the following values:

```
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

> ⚠️ The Supabase **service role** key is required because the API route performs server-side inserts. Never expose it to the browser.

## Supabase Schema

Create a table named `document_extractions` with columns capable of storing the normalized payload. A sample SQL migration:

```sql
create table if not exists public.document_extractions (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	document_no text,
	document_date text,
	items jsonb not null default '[]'::jsonb,
	raw_text text
);
```

Adjust column names or types to match your downstream reporting needs. The API currently inserts one row per extraction request using these fields.

## Running the App

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the UI. Upload a document image via the relevant page and the extracted data will be persisted automatically in Supabase.

## Troubleshooting

- Ensure the Groq and Supabase environment variables are present before starting the server; the API will throw a 500 error if they are missing.
- Check the `document_extractions` table in Supabase to verify incoming rows. Errors are logged server-side but don't block the HTTP response.
