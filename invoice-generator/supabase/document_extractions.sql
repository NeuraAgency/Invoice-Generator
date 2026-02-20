-- SQL schema for persisting extraction results from /api/extract
create table if not exists public.document_extractions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  document_no text,
  document_date date,
  items jsonb not null default '[]'::jsonb,
  raw_text text,
  "URL" text,
  constraint document_extractions_document_no_date_key unique (document_no, document_date)
);

-- If the table already existed before this file was updated, ensure the new column exists:
-- alter table public.document_extractions add column if not exists "URL" text;

-- Multi-challan invoice support
-- Maps one invoice billno -> many challans
create table if not exists public.invoice_challans (
  billno text not null,
  challanno bigint not null,
  created_at timestamptz not null default now(),
  constraint invoice_challans_pkey primary key (billno, challanno)
);

create index if not exists invoice_challans_billno_idx on public.invoice_challans (billno);
