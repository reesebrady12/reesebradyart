-- Metadata for master artwork files and responsive web derivatives.
alter table painting_images add column if not exists original_filename text not null default '';
alter table painting_images add column if not exists thumbnail_path text;
alter table painting_images add column if not exists gallery_path text;
alter table painting_images add column if not exists large_path text;

alter type image_kind add value if not exists 'texture';
alter type image_kind add value if not exists 'side';
alter type image_kind add value if not exists 'back';

create index if not exists painting_images_primary_order_idx
  on painting_images(painting_id, is_primary desc, sort_order);

update storage.buckets set file_size_limit = 41943040 where id = 'paintings';
