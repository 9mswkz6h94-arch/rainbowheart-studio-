insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'setlist-pdfs',
  'setlist-pdfs',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their setlist PDFs" on storage.objects;
create policy "Users can upload their setlist PDFs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'setlist-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read their setlist PDFs" on storage.objects;
create policy "Users can read their setlist PDFs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'setlist-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their setlist PDFs" on storage.objects;
create policy "Users can update their setlist PDFs"
on storage.objects for update
to authenticated
using (
  bucket_id = 'setlist-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'setlist-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their setlist PDFs" on storage.objects;
create policy "Users can delete their setlist PDFs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'setlist-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);
