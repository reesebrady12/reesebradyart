-- Public portfolio assets. Database image columns store paths relative to this
-- bucket (for example: available/painting-id/gallery/image.webp).
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'artwork',
  'artwork',
  true,
  41943040,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict(id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public artwork files are readable" on storage.objects;
create policy "public artwork files are readable"
  on storage.objects for select
  using (bucket_id = 'artwork');

drop policy if exists "admins upload artwork files" on storage.objects;
create policy "admins upload artwork files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'artwork' and is_admin());

drop policy if exists "admins update artwork files" on storage.objects;
create policy "admins update artwork files"
  on storage.objects for update to authenticated
  using (bucket_id = 'artwork' and is_admin())
  with check (bucket_id = 'artwork' and is_admin());

drop policy if exists "admins delete artwork files" on storage.objects;
create policy "admins delete artwork files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'artwork' and is_admin());

-- Convert only the original demo records from bundled paths. Upload files at
-- these bucket-relative destinations before publishing the demo records.
update products set image = case image
  when '/art/golden-hour.svg' then 'available/golden-hour.webp'
  when '/art/still-water.svg' then 'available/still-water.webp'
  when '/art/wild-flowers.svg' then 'available/wild-flowers.webp'
  when '/art/blue-morning.svg' then 'available/blue-morning.webp'
  else image
end
where image in (
  '/art/golden-hour.svg',
  '/art/still-water.svg',
  '/art/wild-flowers.svg',
  '/art/blue-morning.svg'
);
