-- Run only after the 2026-08-08 Manager security update is deployed and tested.
-- This changes access rules only. It does not insert, update, or delete business data.

begin;

-- Tables reported by Supabase Security Advisor on 2026-08-08.
alter table public.rentals enable row level security;
alter table public.tools enable row level security;
alter table public.customers enable row level security;
alter table public.service_centres enable row level security;
alter table public.services enable row level security;
alter table public.customer_arrears enable row level security;

-- The Manager now accesses data through its authenticated server layer, so the
-- older anonymous/public policies are no longer required.
drop policy if exists "Allow all payments" on public.payments;
drop policy if exists "Allow all sale_entries" on public.sale_entries;
drop policy if exists "Allow all sale_items" on public.sale_items;
drop policy if exists "Allow all shop cash received" on public.shop_cash_received;
drop policy if exists "cash staff transfers read" on public.cash_staff_transfers;
drop policy if exists "cash staff transfers insert pending" on public.cash_staff_transfers;

commit;
