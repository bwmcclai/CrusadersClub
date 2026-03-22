-- ============================================================
-- Crusaders Club — Supabase Schema
-- Run this in the Supabase SQL editor (Database → SQL Editor)
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Helper: updated_at trigger ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- TABLES
-- ============================================================

-- ─── Players (public profile, mirrors auth.users) ────────────────────────────
create table if not exists public.players (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  avatar_url   text,
  elo          integer not null default 1000,
  games_played integer not null default 0,
  games_won    integer not null default 0,
  games_lost   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

-- ─── Battle Maps ─────────────────────────────────────────────────────────────
create table if not exists public.battle_maps (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  author_id      uuid references public.players(id) on delete set null,
  region_name    text not null,
  region_bounds  jsonb not null,  -- { minLat, maxLat, minLon, maxLon }
  territories    jsonb not null default '[]',   -- Territory[]
  bonus_groups   jsonb not null default '[]',   -- BonusGroup[]
  thumbnail_url  text,
  is_public      boolean not null default false,
  play_count     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger battle_maps_updated_at
  before update on public.battle_maps
  for each row execute function public.set_updated_at();

create index if not exists battle_maps_author_idx on public.battle_maps(author_id);
create index if not exists battle_maps_public_idx  on public.battle_maps(is_public) where is_public = true;

-- ─── Games ───────────────────────────────────────────────────────────────────
create table if not exists public.games (
  id                     uuid primary key default gen_random_uuid(),
  map_id                 uuid not null references public.battle_maps(id) on delete restrict,
  name                   text not null,
  mode                   text not null check (mode in ('lightning', 'slow_hour', 'slow_day')),
  status                 text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  max_players            integer not null check (max_players between 2 and 8),
  current_players        integer not null default 0,
  turn_number            integer not null default 0,
  current_turn_player_id uuid,  -- set after game starts, references game_players.id
  turn_deadline          timestamptz,
  winner_id              uuid references public.players(id) on delete set null,
  created_by             uuid references public.players(id) on delete set null,
  -- Game settings stored as JSON for flexibility
  -- spoils_mode: 'none' | 'flat' | 'escalating'
  -- fog_of_war: boolean
  -- team_mode: 'none' | 'doubles' | 'triples'
  -- game_type: 'standard' | 'assassin' | 'capitals'
  -- initial_deployment: 'random' | 'draft' | 'manual'
  -- card_trade_count: tracks how many times cards have been traded (for escalating)
  settings               jsonb not null default '{
    "spoils_mode": "escalating",
    "fog_of_war": false,
    "team_mode": "none",
    "game_type": "standard",
    "initial_deployment": "random",
    "card_trade_count": 0
  }',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger games_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

create index if not exists games_status_idx    on public.games(status);
create index if not exists games_created_by_idx on public.games(created_by);

-- ─── Game Players ─────────────────────────────────────────────────────────────
create table if not exists public.game_players (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references public.games(id) on delete cascade,
  player_id           uuid references public.players(id) on delete set null,  -- null for AI bots
  username            text not null,
  avatar_url          text,
  color               text not null,
  is_ai               boolean not null default false,
  ai_difficulty       text check (ai_difficulty in ('easy', 'medium', 'hard')),
  turn_order          integer not null,
  card_count          integer not null default 0,
  is_eliminated       boolean not null default false,
  eliminated_at       timestamptz,
  team                text,                -- 'A' | 'B' | 'C' for team games
  assassin_target_id  uuid references public.game_players(id) on delete set null,
  joined_at           timestamptz not null default now(),

  unique (game_id, turn_order),
  unique (game_id, player_id)   -- one real player per game
);

create index if not exists game_players_game_idx   on public.game_players(game_id);
create index if not exists game_players_player_idx on public.game_players(player_id);

-- Add FK from games.current_turn_player_id → game_players.id (deferred to avoid circular)
alter table public.games
  add constraint games_current_turn_fk
  foreign key (current_turn_player_id)
  references public.game_players(id)
  on delete set null
  deferrable initially deferred;

-- ─── Territory States ─────────────────────────────────────────────────────────
create table if not exists public.territory_states (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.games(id) on delete cascade,
  territory_id     text not null,   -- ID within the map's territories JSON
  owner_player_id  uuid references public.game_players(id) on delete set null,
  armies           integer not null default 1,
  updated_at       timestamptz not null default now(),

  unique (game_id, territory_id)
);

create index if not exists territory_states_game_idx  on public.territory_states(game_id);
create index if not exists territory_states_owner_idx on public.territory_states(owner_player_id);

-- ─── Cards (Spoils) ──────────────────────────────────────────────────────────
-- One row per card in the game's deck
create table if not exists public.cards (
  id                   uuid primary key default gen_random_uuid(),
  game_id              uuid not null references public.games(id) on delete cascade,
  territory_id         text not null,   -- territory this card represents
  card_type            text not null check (card_type in ('infantry', 'cavalry', 'artillery', 'wild')),
  held_by_player_id    uuid references public.game_players(id) on delete set null,
  deck_position        integer          -- ordering within the deck; null = held or discarded
);

create index if not exists cards_game_idx       on public.cards(game_id);
create index if not exists cards_holder_idx     on public.cards(held_by_player_id);

-- ─── Game Events (Audit Log) ──────────────────────────────────────────────────
create table if not exists public.game_events (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.games(id) on delete cascade,
  game_player_id   uuid references public.game_players(id) on delete set null,
  event_type       text not null check (event_type in (
    'join', 'start', 'deploy', 'attack', 'fortify', 'card_trade', 'eliminate', 'win'
  )),
  -- event_data shape by type:
  -- deploy:     { territory_id, armies_placed }
  -- attack:     { from, to, attackers, defenders, attack_dice, defend_dice, attacker_losses, defender_losses, conquered }
  -- fortify:    { from, to, armies_moved }
  -- card_trade: { card_ids, armies_received, trade_number }
  -- eliminate:  { eliminated_player_id, cards_taken }
  -- win:        { winner_player_id, elo_changes: [{player_id, delta}] }
  event_data       jsonb not null default '{}',
  turn_number      integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists game_events_game_idx on public.game_events(game_id);
create index if not exists game_events_type_idx on public.game_events(event_type);

-- ─── ELO History ─────────────────────────────────────────────────────────────
create table if not exists public.elo_history (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  game_id     uuid references public.games(id) on delete set null,
  elo_before  integer not null,
  elo_after   integer not null,
  delta       integer not null,   -- positive = gain, negative = loss
  created_at  timestamptz not null default now()
);

create index if not exists elo_history_player_idx on public.elo_history(player_id);


-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create player profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep games.current_players in sync
create or replace function public.sync_game_player_count()
returns trigger language plpgsql as $$
begin
  update public.games
  set current_players = (
    select count(*) from public.game_players where game_id = coalesce(new.game_id, old.game_id)
  )
  where id = coalesce(new.game_id, old.game_id);
  return coalesce(new, old);
end;
$$;

create trigger game_players_count_insert
  after insert on public.game_players
  for each row execute function public.sync_game_player_count();

create trigger game_players_count_delete
  after delete on public.game_players
  for each row execute function public.sync_game_player_count();


-- ============================================================
-- DATABASE FUNCTIONS (RPC)
-- ============================================================

-- Roll dice and return results
-- attack_count: 1-3, defend_count: 1-2
create or replace function public.roll_dice(attack_count integer, defend_count integer)
returns jsonb language plpgsql as $$
declare
  attack_dice integer[];
  defend_dice integer[];
  i integer;
  a_sorted integer[];
  d_sorted integer[];
  attacker_losses integer := 0;
  defender_losses integer := 0;
  comparisons integer;
begin
  -- Roll attack dice
  attack_dice := array[]::integer[];
  for i in 1..attack_count loop
    attack_dice := array_append(attack_dice, floor(random() * 6 + 1)::integer);
  end loop;

  -- Roll defend dice
  defend_dice := array[]::integer[];
  for i in 1..defend_count loop
    defend_dice := array_append(defend_dice, floor(random() * 6 + 1)::integer);
  end loop;

  -- Sort descending
  select array_agg(v order by v desc) into a_sorted from unnest(attack_dice) as t(v);
  select array_agg(v order by v desc) into d_sorted from unnest(defend_dice) as t(v);

  -- Compare pairs
  comparisons := least(attack_count, defend_count);
  for i in 1..comparisons loop
    if a_sorted[i] > d_sorted[i] then
      defender_losses := defender_losses + 1;
    else
      attacker_losses := attacker_losses + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'attack_dice', to_jsonb(attack_dice),
    'defend_dice', to_jsonb(defend_dice),
    'attacker_losses', attacker_losses,
    'defender_losses', defender_losses
  );
end;
$$;

-- Calculate ELO change (K=32, standard formula)
create or replace function public.calc_elo_delta(winner_elo integer, loser_elo integer)
returns integer language plpgsql as $$
declare
  expected numeric;
  k integer := 32;
begin
  expected := 1.0 / (1.0 + power(10.0, (loser_elo - winner_elo)::numeric / 400.0));
  return round(k * (1.0 - expected));
end;
$$;

-- Calculate armies earned for card trade-in (escalating spoils)
-- trade_count: number of times cards have been traded in this game so far
create or replace function public.card_trade_armies(trade_count integer, spoils_mode text)
returns integer language plpgsql as $$
begin
  if spoils_mode = 'none' then return 0; end if;
  if spoils_mode = 'flat' then return 4; end if;
  -- escalating
  return case trade_count
    when 0 then 4
    when 1 then 6
    when 2 then 8
    when 3 then 10
    when 4 then 12
    when 5 then 15
    else 15 + (trade_count - 5) * 5
  end;
end;
$$;

-- Calculate armies a player receives at start of turn (territories/3 + continent bonuses)
create or replace function public.calc_deployment_armies(
  p_game_id uuid,
  p_game_player_id uuid
)
returns integer language plpgsql as $$
declare
  territory_count integer;
  bonus_armies integer := 0;
  map_row record;
  bonus_group jsonb;
  bg_territories jsonb;
  bg_bonus integer;
  bg_id text;
  owned_count integer;
  total_in_group integer;
begin
  -- Count owned territories
  select count(*) into territory_count
  from public.territory_states
  where game_id = p_game_id and owner_player_id = p_game_player_id;

  -- Get map for bonus group calculation
  select bm.bonus_groups into map_row
  from public.games g
  join public.battle_maps bm on bm.id = g.map_id
  where g.id = p_game_id;

  -- Check each bonus group
  if map_row.bonus_groups is not null then
    for bonus_group in select * from jsonb_array_elements(map_row.bonus_groups)
    loop
      bg_territories := bonus_group->'territory_ids';
      bg_bonus := (bonus_group->>'bonus_armies')::integer;
      total_in_group := jsonb_array_length(bg_territories);

      select count(*) into owned_count
      from public.territory_states ts
      where ts.game_id = p_game_id
        and ts.owner_player_id = p_game_player_id
        and ts.territory_id = any(
          select jsonb_array_elements_text(bg_territories)
        );

      if owned_count = total_in_group then
        bonus_armies := bonus_armies + bg_bonus;
      end if;
    end loop;
  end if;

  return greatest(3, floor(territory_count::numeric / 3)::integer) + bonus_armies;
end;
$$;


-- ============================================================
-- VIEWS
-- ============================================================

-- Leaderboard: top players by ELO
create or replace view public.leaderboard as
select
  p.id,
  p.username,
  p.avatar_url,
  p.elo,
  p.games_played,
  p.games_won,
  p.games_lost,
  case when p.games_played > 0
    then round(p.games_won::numeric / p.games_played * 100, 1)
    else 0
  end as win_rate,
  rank() over (order by p.elo desc) as rank
from public.players p
where p.games_played > 0
order by p.elo desc;

-- Lobby view: active + waiting games with map + creator info
create or replace view public.lobby_games as
select
  g.id,
  g.name,
  g.mode,
  g.status,
  g.max_players,
  g.current_players,
  g.settings,
  g.created_at,
  bm.name as map_name,
  bm.thumbnail_url as map_thumbnail,
  bm.region_name,
  p.username as creator_name,
  exists(
    select 1 from public.game_players gp where gp.game_id = g.id and gp.is_ai = true
  ) as has_ai
from public.games g
join public.battle_maps bm on bm.id = g.map_id
left join public.players p on p.id = g.created_by
where g.status in ('waiting', 'active')
order by g.created_at desc;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.players          enable row level security;
alter table public.battle_maps      enable row level security;
alter table public.games            enable row level security;
alter table public.game_players     enable row level security;
alter table public.territory_states enable row level security;
alter table public.cards            enable row level security;
alter table public.game_events      enable row level security;
alter table public.elo_history      enable row level security;

-- Helper: check if authenticated user is in a game
create or replace function public.is_game_participant(p_game_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.game_players
    where game_id = p_game_id
      and player_id = auth.uid()
  );
$$;

-- ── players ──────────────────────────────────────────────────
create policy "Players are publicly readable"
  on public.players for select using (true);

create policy "Players can update own profile"
  on public.players for update using (auth.uid() = id);

create policy "Players can insert own profile"
  on public.players for insert with check (auth.uid() = id);

-- ── battle_maps ───────────────────────────────────────────────
create policy "Public maps are visible to all"
  on public.battle_maps for select
  using (is_public = true or auth.uid() = author_id);

create policy "Authors can insert their maps"
  on public.battle_maps for insert
  with check (auth.uid() = author_id);

create policy "Authors can update their maps"
  on public.battle_maps for update
  using (auth.uid() = author_id);

create policy "Authors can delete their maps"
  on public.battle_maps for delete
  using (auth.uid() = author_id);

-- ── games ─────────────────────────────────────────────────────
create policy "Waiting games visible to all authenticated"
  on public.games for select
  using (status = 'waiting' or public.is_game_participant(id));

create policy "Authenticated users can create games"
  on public.games for insert
  with check (auth.uid() = created_by);

create policy "Game participants can update game"
  on public.games for update
  using (public.is_game_participant(id));

-- ── game_players ──────────────────────────────────────────────
create policy "Game players visible to participants or waiting games"
  on public.game_players for select
  using (
    public.is_game_participant(game_id)
    or exists (
      select 1 from public.games where id = game_id and status = 'waiting'
    )
  );

create policy "Authenticated users can join games"
  on public.game_players for insert
  with check (auth.uid() = player_id or is_ai = true);

create policy "Game participants can update player state"
  on public.game_players for update
  using (public.is_game_participant(game_id));

-- ── territory_states ──────────────────────────────────────────
create policy "Territory states visible to game participants"
  on public.territory_states for select
  using (public.is_game_participant(game_id));

create policy "Game participants can insert territory states"
  on public.territory_states for insert
  with check (public.is_game_participant(game_id));

create policy "Game participants can update territory states"
  on public.territory_states for update
  using (public.is_game_participant(game_id));

-- ── cards ─────────────────────────────────────────────────────
create policy "Players can view their own cards"
  on public.cards for select
  using (
    held_by_player_id in (
      select id from public.game_players where player_id = auth.uid()
    )
    or held_by_player_id is null  -- undealt cards visible to game creator for setup
  );

create policy "Game participants can manage cards"
  on public.cards for all
  using (public.is_game_participant(game_id));

-- ── game_events ───────────────────────────────────────────────
create policy "Game events visible to participants"
  on public.game_events for select
  using (public.is_game_participant(game_id));

create policy "Game participants can insert events"
  on public.game_events for insert
  with check (public.is_game_participant(game_id));

-- ── elo_history ───────────────────────────────────────────────
create policy "Players can view own ELO history"
  on public.elo_history for select
  using (auth.uid() = player_id);

create policy "System can insert ELO history"
  on public.elo_history for insert
  with check (auth.uid() = player_id);


-- ============================================================
-- REALTIME
-- Enable Supabase Realtime on game-critical tables
-- Run in Supabase Dashboard: Database → Replication → add tables
-- ============================================================
-- Programmatic approach (run if replication publication exists):
-- alter publication supabase_realtime add table public.games;
-- alter publication supabase_realtime add table public.game_players;
-- alter publication supabase_realtime add table public.territory_states;
-- alter publication supabase_realtime add table public.game_events;
