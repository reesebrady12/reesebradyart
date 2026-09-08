-- Additional portfolio invariants for databases that already ran the category migration.
alter table products drop constraint if exists supported_medium_values;
alter table products add constraint supported_medium_values
  check (medium is null or medium in ('oil', 'colored_pencil', 'graphite_pencil'));

alter table products drop constraint if exists completion_date_year_match;
alter table products add constraint completion_date_year_match check (
  completion_date is null or
  completion_year = extract(year from completion_date)::smallint
);

alter table products drop constraint if exists category_business_rules;
alter table products add constraint category_business_rules check (
  (category = 'sold' and purchasable = false and sold = true and inventory = 0)
  or (category = 'project' and purchasable = false and sold = false)
  or (category = 'available' and sold = false and (
    purchasable = false or (
      price_in_cents > 0 and (type <> 'original' or inventory = 1)
    )
  ))
);
