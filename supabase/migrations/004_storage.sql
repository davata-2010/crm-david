-- Bucket privado para adjuntos. Ruta: {workspace_id}/{uuid}-{nombre}
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "attachments read" on storage.objects;
create policy "attachments read" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "attachments insert" on storage.objects;
create policy "attachments insert" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and public.can_write(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "attachments delete" on storage.objects;
create policy "attachments delete" on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and public.can_write(((storage.foldername(name))[1])::uuid)
  );
