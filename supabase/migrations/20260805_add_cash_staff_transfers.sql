create table if not exists public.cash_staff_transfers (
  id uuid primary key default gen_random_uuid(),
  sent_date date not null default current_date,
  shop text not null default 'Multiple Shops',
  amount numeric(12,2) not null check (amount > 0),
  staff_name text not null,
  shop_breakdown jsonb not null default '[]'::jsonb,
  remarks text not null default '',
  status text not null default 'pending' check (status in ('pending', 'received')),
  confirmed_at timestamptz,
  confirmed_by text,
  created_at timestamptz not null default now()
);

alter table public.cash_staff_transfers
  add column if not exists shop_breakdown jsonb not null default '[]'::jsonb;

create index if not exists cash_staff_transfers_status_idx
  on public.cash_staff_transfers (status, created_at desc);

alter table public.cash_staff_transfers enable row level security;

drop policy if exists "cash staff transfers read" on public.cash_staff_transfers;
create policy "cash staff transfers read" on public.cash_staff_transfers
  for select to anon, authenticated using (true);

drop policy if exists "cash staff transfers insert pending" on public.cash_staff_transfers;
create policy "cash staff transfers insert pending" on public.cash_staff_transfers
  for insert to anon, authenticated
  with check (status = 'pending' and confirmed_at is null and confirmed_by is null);

create or replace function public.confirm_cash_staff_transfer(p_transfer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_row public.cash_staff_transfers%rowtype;
  allocation jsonb;
begin
  select * into transfer_row
  from public.cash_staff_transfers
  where id = p_transfer_id and status = 'pending'
  for update;

  if not found then return false; end if;

  for allocation in select * from jsonb_array_elements(transfer_row.shop_breakdown)
  loop
    insert into public.shop_cash_received
      (received_date, shop, received_from, amount, mode, payment_mode, remarks)
    values
      (transfer_row.sent_date,
       allocation->>'shop',
       transfer_row.staff_name,
       (allocation->>'amount')::numeric,
       'Cash',
       'Cash',
       case when transfer_row.remarks = '' then 'Cash collection confirmed' else transfer_row.remarks end);
  end loop;

  update public.cash_staff_transfers
  set status = 'received', confirmed_at = now(), confirmed_by = 'Administrator'
  where id = p_transfer_id;

  return true;
end;
$$;

revoke all on function public.confirm_cash_staff_transfer(uuid) from public, anon, authenticated;
grant execute on function public.confirm_cash_staff_transfer(uuid) to service_role;
