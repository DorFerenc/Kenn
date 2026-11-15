-- The pregnancy: one per household, and the source of every date in the app.
--
-- What is NOT here is as important as what is. There are no window dates and no
-- materialised tasks: packages/engine/CLAUDE.md puts windows as day offsets from
-- an anchor, so a corrected EDD re-derives every window rather than rewriting
-- stored rows. This table holds the anchors; @kenn/engine does the arithmetic.
--
-- Dating precedence, decided at step 1 and enforced by the service layer: an
-- ultrasound-corrected EDD beats a remembered LMP, and an IVF transfer beats
-- both. All three columns are kept, because a family who corrects the EDD at
-- the first scan has not stopped knowing their LMP.

create table pregnancy (
  household_id uuid primary key references household (id) on delete cascade,
  dating_method text not null
    check (dating_method in ('lmp', 'ultrasound', 'ivf_transfer')),
  lmp date,
  edd date,
  transfer_date date,
  fetuses integer not null default 1 check (fetuses between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Each dating method needs the date it is named after. Checked here and not
  -- only in zod, because the engine silently produces no tasks at all when the
  -- anchor it needs is absent — a failure that looks like an empty checklist
  -- rather than like an error.
  constraint pregnancy_has_its_date check (
    case dating_method
      when 'lmp' then lmp is not null
      when 'ultrasound' then edd is not null
      when 'ivf_transfer' then transfer_date is not null
    end
  )
);

comment on table pregnancy is
  'Anchors for one household. No window dates: the engine derives those from day offsets.';
comment on column pregnancy.edd is
  'Ultrasound-corrected estimated due date. Beats lmp when dating_method is ultrasound.';
comment on column pregnancy.fetuses is
  'Singleton or multiple. Feeds applies_if, which is why it is an anchor-table column.';

alter table pregnancy enable row level security;

create policy pregnancy_rw on pregnancy
  for all
  using (is_member(household_id))
  with check (is_member(household_id));
