-- Delete an unused artwork record and its related database rows atomically.
-- Storage objects are removed by the authenticated admin API using the paths
-- returned here. Order-linked artwork is deliberately rejected and archived by
-- the API instead so historical order references remain valid.
create or replace function delete_artwork_record(p_painting_id text)
returns table(storage_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from order_items where product_id = p_painting_id
  ) then
    raise exception 'Artwork is referenced by an order' using errcode = '23503';
  end if;

  return query
    select paths.path
    from painting_images image
    cross join lateral unnest(array[
      image.storage_path,
      image.thumbnail_path,
      image.gallery_path,
      image.large_path
    ]) as paths(path)
    where image.painting_id = p_painting_id and paths.path is not null;

  delete from product_variants where product_id = p_painting_id;
  delete from painting_images where painting_id = p_painting_id;
  delete from products where id = p_painting_id;

  if not found then
    raise exception 'Artwork not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function delete_artwork_record(text)
  from public, anon, authenticated;
grant execute on function delete_artwork_record(text) to service_role;
