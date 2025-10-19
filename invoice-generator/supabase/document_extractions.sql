-- SQL schema for persisting extraction results from /api/extract
create table if not exists public.document_extractions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  document_no text,
  document_date date,
  items jsonb not null default '[]'::jsonb,
  raw_text text,
  constraint document_extractions_document_no_date_key unique (document_no, document_date)
);
