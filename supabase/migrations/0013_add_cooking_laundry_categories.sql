-- Add Cooking and Laundry service categories
insert into public.service_categories (slug, name, icon, sort_order) values
  ('cooking', 'Cooking', 'ChefHat', 150),
  ('laundry', 'Laundry', 'Shirt', 160)
on conflict (slug) do nothing;
