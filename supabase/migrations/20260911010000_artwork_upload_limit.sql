-- Keep the current artwork bucket aligned with the admin uploader's 40 MB limit.
update storage.buckets
set file_size_limit = 41943040
where id = 'artwork';
