-- schema.sql: run this ONCE in Supabase (SQL Editor -> New query -> paste -> Run).
-- It creates four tables and locks every row to the user who created it.

-- 1. Spending
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  category    text not null check (category in ('Food', 'Car', 'Bills', 'Shopping', 'Entertainment', 'Other')),
  note        text,
  amount      numeric(12,2) not null check (amount > 0),
  created_at  timestamptz not null default now()
);
create index expenses_user_date_idx on public.expenses (user_id, date desc);

-- 2. Service and repair records
create table public.car_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  odometer    integer not null check (odometer >= 0),
  type        text not null check (type in ('Service', 'Repair', 'Other')),
  description text not null,
  workshop    text,
  cost        numeric(12,2) not null default 0 check (cost >= 0),
  created_at  timestamptz not null default now()
);
create index car_logs_user_odo_idx on public.car_logs (user_id, odometer desc);

-- 3. Date-based reminders (road tax, insurance, tyre check)
create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  due         date not null,
  created_at  timestamptz not null default now()
);
create index reminders_user_due_idx on public.reminders (user_id, due);

-- 4. Car settings (one row per user)
create table public.car_settings (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  odometer         integer not null default 0 check (odometer >= 0),
  service_interval integer not null default 10000 check (service_interval > 0),
  start_odometer   integer not null default 0 check (start_odometer >= 0)
);

-- Row-level security: a signed-in user can only see and change their own rows.
-- Without a signed-in session (for example the public key alone) nothing is readable.
alter table public.expenses     enable row level security;
alter table public.car_logs     enable row level security;
alter table public.reminders    enable row level security;
alter table public.car_settings enable row level security;

create policy "own rows" on public.expenses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own rows" on public.car_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own rows" on public.reminders
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own rows" on public.car_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
