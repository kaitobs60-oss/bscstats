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

-- Raw friendly Battle Log entries collected for tracked pro rosters.
-- These are individual battle records, not verified set-level scrim scores.
create table if not exists public.scrim_battles (
  battle_id text primary key,
  battle_time timestamptz not null,
  event_id bigint,
  map_name text,
  mode text,
  battle_type text not null,
  tracked_team text not null,
  tracked_players jsonb not null default '[]'::jsonb,
  players jsonb not null default '[]'::jsonb,
  battle_data jsonb not null default '{}'::jsonb,
  source text not null default 'supercell_battlelog',
  created_at timestamptz not null default now()
);
create index if not exists scrim_battles_battle_time_idx on public.scrim_battles (battle_time desc);
create index if not exists scrim_battles_team_time_idx on public.scrim_battles (tracked_team, battle_time desc);
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

-- Row Level Security: public catalogue + verified competitive records.
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.roster_history enable row level security;
alter table public.tournaments enable row level security;
alter table public.maps enable row level security;
alter table public.matches enable row level security;
alter table public.match_sets enable row level security;
alter table public.draft_picks enable row level security;
alter table public.scrims enable row level security;
alter table public.scrim_battles enable row level security;
alter table public.transfers enable row level security;
alter table public.news enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_entries enable row level security;
alter table public.fantasy_rosters enable row level security;
alter table public.fantasy_roster_players enable row level security;

drop policy if exists "public read verified teams" on public.teams;
drop policy if exists "public read teams" on public.teams;
create policy "public read teams" on public.teams for select to anon, authenticated using (true);
drop policy if exists "public read verified players" on public.players;
drop policy if exists "public read players" on public.players;
create policy "public read players" on public.players for select to anon, authenticated using (true);
drop policy if exists "public read verified maps" on public.maps;
drop policy if exists "public read maps" on public.maps;
create policy "public read maps" on public.maps for select to anon, authenticated using (true);

drop policy if exists "public read verified roster_history" on public.roster_history;
drop policy if exists "public read verified roster history" on public.roster_history;
create policy "public read verified roster history" on public.roster_history for select to anon, authenticated using (verified = true);
drop policy if exists "public read verified tournaments" on public.tournaments;
create policy "public read verified tournaments" on public.tournaments for select to anon, authenticated using (verified = true);
drop policy if exists "public read verified matches" on public.matches;
create policy "public read verified matches" on public.matches for select to anon, authenticated using (verified = true);
drop policy if exists "public read verified scrims" on public.scrims;
create policy "public read verified scrims" on public.scrims for select to anon, authenticated using (verified = true);
drop policy if exists "public read scrim battle logs" on public.scrim_battles;
create policy "public read scrim battle logs" on public.scrim_battles for select to anon, authenticated using (true);
drop policy if exists "public read verified transfers" on public.transfers;
create policy "public read verified transfers" on public.transfers for select to anon, authenticated using (verified = true);
drop policy if exists "public read verified news" on public.news;
create policy "public read verified news" on public.news for select to anon, authenticated using (verified = true);

drop policy if exists "public read verified match_sets" on public.match_sets;
drop policy if exists "public read sets of verified matches" on public.match_sets;
create policy "public read sets of verified matches" on public.match_sets for select to anon, authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and m.verified = true));
drop policy if exists "public read verified draft_picks" on public.draft_picks;
drop policy if exists "public read drafts of verified matches" on public.draft_picks;
create policy "public read drafts of verified matches" on public.draft_picks for select to anon, authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and m.verified = true));

drop policy if exists "public read verified match predictions" on public.predictions;
create policy "public read verified match predictions" on public.predictions for select to anon, authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and m.verified = true));
drop policy if exists "users read own prediction entries" on public.prediction_entries;
create policy "users read own prediction entries" on public.prediction_entries for select to authenticated using (auth.uid() = user_id);
drop policy if exists "users submit own open prediction" on public.prediction_entries;
create policy "users submit own open prediction" on public.prediction_entries for insert to authenticated
  with check (auth.uid() = user_id and points = 0 and exists (
    select 1 from public.predictions p join public.matches m on m.id = p.match_id
    where p.id = prediction_id and m.verified = true
      and (p.closes_at is null or p.closes_at > now())
      and predicted_winner_team_id in (m.team_a_id, m.team_b_id)
  ));

drop policy if exists "users manage own fantasy rosters" on public.fantasy_rosters;
create policy "users manage own fantasy rosters" on public.fantasy_rosters for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users manage own fantasy roster players" on public.fantasy_roster_players;
create policy "users manage own fantasy roster players" on public.fantasy_roster_players for all to authenticated
  using (exists (select 1 from public.fantasy_rosters r where r.id = roster_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.fantasy_rosters r where r.id = roster_id and r.user_id = auth.uid()));

-- Explicit API grants; RLS remains the row-level security boundary.
grant usage on schema public to anon, authenticated;
grant select on public.teams, public.players, public.roster_history, public.tournaments, public.maps,
  public.matches, public.match_sets, public.draft_picks, public.scrims, public.transfers, public.news,
  public.predictions to anon, authenticated;
grant select on public.prediction_entries, public.fantasy_rosters, public.fantasy_roster_players to authenticated;
grant insert on public.prediction_entries to authenticated;
grant select, insert, update, delete on public.fantasy_rosters, public.fantasy_roster_players to authenticated;


-- Final hardening pass: remove permissive legacy policies and keep points server-controlled.
drop policy if exists "users insert own prediction entries" on public.prediction_entries;
drop policy if exists "users update own prediction entries" on public.prediction_entries;
drop policy if exists "public read predictions" on public.predictions;
drop policy if exists "users read own prediction entries" on public.prediction_entries;
create policy "users read own prediction entries" on public.prediction_entries
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "users submit own open prediction" on public.prediction_entries;
create policy "users submit own open prediction" on public.prediction_entries
  for insert to authenticated with check (
    (select auth.uid()) = user_id and points = 0 and exists (
      select 1 from public.predictions p join public.matches m on m.id = p.match_id
      where p.id = prediction_id and m.verified = true
        and (p.closes_at is null or p.closes_at > now())
        and predicted_winner_team_id in (m.team_a_id, m.team_b_id)
    )
  );
drop policy if exists "users manage own fantasy rosters" on public.fantasy_rosters;
create policy "users manage own fantasy rosters" on public.fantasy_rosters for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "users manage own fantasy roster players" on public.fantasy_roster_players;
create policy "users manage own fantasy roster players" on public.fantasy_roster_players for all to authenticated
  using (exists (select 1 from public.fantasy_rosters r where r.id = roster_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.fantasy_rosters r where r.id = roster_id and r.user_id = (select auth.uid())));

create index if not exists draft_picks_set_id_idx on public.draft_picks(set_id);
create index if not exists draft_picks_team_id_idx on public.draft_picks(team_id);
create index if not exists draft_picks_player_id_idx on public.draft_picks(player_id);
create index if not exists match_sets_map_id_idx on public.match_sets(map_id);
create index if not exists match_sets_winner_team_id_idx on public.match_sets(winner_team_id);
create index if not exists predictions_match_id_idx on public.predictions(match_id);
create index if not exists transfers_player_id_idx on public.transfers(player_id);
create index if not exists transfers_from_team_id_idx on public.transfers(from_team_id);
create index if not exists transfers_to_team_id_idx on public.transfers(to_team_id);
create index if not exists prediction_entries_winner_team_idx on public.prediction_entries(predicted_winner_team_id);
create index if not exists fantasy_roster_players_player_idx on public.fantasy_roster_players(player_id);
create index if not exists fantasy_rosters_tournament_idx on public.fantasy_rosters(tournament_id);
