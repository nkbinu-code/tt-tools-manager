-- Separates an optional expected due date from the actual return date.
-- This is additive only: it does not update, delete, or rewrite existing rows.
alter table public.rentals
  add column if not exists expected_end_date date;

comment on column public.rentals.expected_end_date is
  'Optional expected rental end/due date. Actual returns continue to use end_date.';
