-- BSCSTATS central database schema (Supabase / PostgreSQL)
-- Apply in a new Supabase project after reviewing RLS and admin roles.
create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region text,
  logo_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  tag text unique,
  nickname text not null,
  nationality text,
  current_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.roster_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  started_on date,
  ended_on date,
  source_url text,
  verified boolean not null default false
);
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  season integer,
  region text,
  event_type text,
  starts_on date,
  ends_on date,
  source_url text,
  verified boolean not null default false
);
create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  mode text not null
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete set null,
  played_at timestamptz,
  team_a_id uuid not null references public.teams(id),
  team_b_id uuid not null references public.teams(id),
  score_a integer not null default 0 check (score_a >= 0),
  score_b integer not null default 0 check (score_b >= 0),
  stage text,
  source_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  set_number integer not null,
  map_id uuid references public.maps(id),
  winner_team_id uuid references public.teams(id),
  score_a integer,
  score_b integer,
  unique(match_id,set_number)
);
create table if not exists public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  set_id uuid references public.match_sets(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  brawler text not null,
  pick_order integer not null,
  pick_type text not null check (pick_type in ('pick','ban')),
  draft_position text check (draft_position in ('FP','LP','middle') or draft_position is null),
  player_id uuid references public.players(id),
  unique(match_id,set_id,pick_order,pick_type)
);
create table if not exists public.scrims (
  id uuid primary key default gen_random_uuid(),
  played_at timestamptz not null,
  team_a_id uuid not null references public.teams(id),
  team_b_id uuid not null references public.teams(id),
  score_a integer not null check (score_a >= 0),
  score_b integer not null check (score_b >= 0),
  source text,
  source_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  from_team_id uuid references public.teams(id),
  to_team_id uuid references public.teams(id),
  announced_on date,
  source_url text,
  verified boolean not null default false
);
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  url text,
  published_at timestamptz,
  verified boolean not null default false
);
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.prediction_entries (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  predicted_winner_team_id uuid not null references public.teams(id),
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique(prediction_id,user_id)
);
create table if not exists public.fantasy_rosters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.fantasy_roster_players (
  roster_id uuid not null references public.fantasy_rosters(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key(roster_id,player_id)
);

create index if not exists matches_played_at_idx on public.matches(played_at desc);
create index if not exists matches_tournament_idx on public.matches(tournament_id);
create index if not exists draft_picks_brawler_idx on public.draft_picks(brawler);
create index if not exists scrims_played_at_idx on public.scrims(played_at desc);
create index if not exists prediction_entries_user_idx on public.prediction_entries(user_id);

-- Public read access is limited to verified competitive records.
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.roster_history enable row level security;
alter table public.tournaments enable row level security;
alter table public.maps enable row level security;
alter table public.matches enable row level security;
alter table public.match_sets enable row level security;
alter table public.draft_picks enable row level security;
alter table public.scrims enable row level security;
alter table public.transfers enable row level security;
alter table public.news enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_entries enable row level security;
alter table public.fantasy_rosters enable row level security;
alter table public.fantasy_roster_players enable row level security;

do $$
declare t text;
begin
  foreach t in array array['teams','players','tournaments','maps','matches','match_sets','draft_picks','scrims','transfers','news'] loop
    execute format('drop policy if exists "public read verified %1$s" on public.%1$I', t);
    if t in ('teams','players','maps') then
      execute format('create policy "public read verified %1$s" on public.%1$I for select using (true)', t);
    else
      execute format('create policy "public read verified %1$s" on public.%1$I for select using (verified = true)', t);
    end if;
  end loop;
end $$;

-- Users may read and manage only their own prediction entries and fantasy rosters.
create policy "users read own prediction entries" on public.prediction_entries for select using (auth.uid() = user_id);
create policy "users insert own prediction entries" on public.prediction_entries for insert with check (auth.uid() = user_id);
create policy "users update own prediction entries" on public.prediction_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own fantasy rosters" on public.fantasy_rosters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own fantasy roster players" on public.fantasy_roster_players for all
  using (exists (select 1 from public.fantasy_rosters r where r.id = roster_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.fantasy_rosters r where r.id = roster_id and r.user_id = auth.uid()));
