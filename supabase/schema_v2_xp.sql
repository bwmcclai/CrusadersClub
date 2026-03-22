-- ============================================================
-- Crusaders Club — Schema v2: XP, Levels, Achievements
-- Run AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- ─── Add XP / Level / Color columns to players ───────────────────────────────
alter table public.players
  add column if not exists xp            integer not null default 0,
  add column if not exists level         integer not null default 1,
  add column if not exists default_color text    not null default '#E74C3C';

-- ─── Achievements (lookup / seed table) ──────────────────────────────────────
create table if not exists public.achievements (
  id          text primary key,
  name        text not null,
  description text not null,
  icon        text not null,
  category    text not null check (category in ('combat', 'creator', 'explorer', 'legend')),
  xp_reward   integer not null default 0
);

-- ─── Player Achievement Unlocks ───────────────────────────────────────────────
create table if not exists public.player_achievements (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players(id) on delete cascade,
  achievement_id text not null references public.achievements(id),
  unlocked_at    timestamptz not null default now(),
  unique (player_id, achievement_id)
);

create index if not exists player_achievements_player_idx on public.player_achievements(player_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.achievements        enable row level security;
alter table public.player_achievements enable row level security;

create policy "Achievements readable by all"
  on public.achievements for select using (true);

create policy "Player achievements readable by owner"
  on public.player_achievements for select using (auth.uid() = player_id);

create policy "System can grant achievements"
  on public.player_achievements for insert with check (auth.uid() = player_id);

-- ─── Seed Achievements ───────────────────────────────────────────────────────
insert into public.achievements (id, name, description, icon, category, xp_reward) values
  ('first_blood',    'First Blood',       'Win your first battle.',              '⚔️', 'combat',   50),
  ('strategist',     'Strategist',        'Win 10 games.',                       '🧠', 'combat',   100),
  ('centurion',      'Centurion',         'Win 100 games.',                      '💯', 'legend',   500),
  ('eliminator',     'Eliminator',        'Eliminate 10 opponents.',             '💀', 'combat',   75),
  ('speed_demon',    'Speed Demon',       'Win a Lightning speed game.',         '⚡', 'combat',   50),
  ('veteran',        'Battle-Hardened',   'Play 50 games.',                      '🛡️', 'combat',   150),
  ('cartographer',   'Cartographer',      'Create your first map.',              '🗺️', 'creator',  100),
  ('map_master',     'Map Master',        'Create 5 maps.',                      '🌍', 'creator',  200),
  ('popular_terrain','Popular Terrain',   'Have a map played 50 times.',         '📍', 'creator',  200),
  ('legend',         'Living Legend',     'Reach level 25.',                     '🌟', 'legend',   300),
  ('supreme',        'Supreme Crusader',  'Reach the maximum level 50.',         '👑', 'legend',   1000),
  ('elo_1500',       'Warlord',           'Reach 1500 ELO.',                     '🏆', 'legend',   250),
  ('elo_2000',       'Grand Strategist',  'Reach 2000 ELO.',                     '🎖️', 'legend',   500),
  ('team_player',    'Band of Brothers',  'Win a team game.',                    '🤝', 'explorer', 75),
  ('globetrotter',   'Globetrotter',      'Play on 10 different maps.',          '🌐', 'explorer', 150)
on conflict (id) do nothing;

-- ─── award_xp: add XP and recompute level ────────────────────────────────────
create or replace function public.award_xp(p_player_id uuid, p_amount integer)
returns integer language plpgsql security definer as $$
declare
  new_xp       integer;
  new_level    integer := 1;
  remaining    integer;
  threshold    integer;
begin
  -- Increment XP
  update public.players
  set xp = xp + p_amount
  where id = p_player_id
  returning xp into new_xp;

  -- Recompute level: threshold(N) = 100 + (N-1)*50
  remaining := new_xp;
  while new_level < 50 loop
    threshold := 100 + (new_level - 1) * 50;
    exit when remaining < threshold;
    remaining  := remaining - threshold;
    new_level  := new_level + 1;
  end loop;

  update public.players set level = new_level where id = p_player_id;
  return new_level;
end;
$$;

-- ─── grant_achievement: unlock + award XP (idempotent) ───────────────────────
create or replace function public.grant_achievement(p_player_id uuid, p_achievement_id text)
returns boolean language plpgsql security definer as $$
declare
  xp_reward integer;
begin
  -- Already unlocked? No-op
  if exists (
    select 1 from public.player_achievements
    where player_id = p_player_id and achievement_id = p_achievement_id
  ) then return false; end if;

  insert into public.player_achievements (player_id, achievement_id)
  values (p_player_id, p_achievement_id);

  select a.xp_reward into xp_reward from public.achievements a where a.id = p_achievement_id;
  if xp_reward > 0 then
    perform public.award_xp(p_player_id, xp_reward);
  end if;

  return true;
end;
$$;

-- ─── Supabase Storage: avatars bucket ────────────────────────────────────────
-- Create manually in Dashboard: Storage → New Bucket → "avatars" (public)
-- Or run:
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
-- on conflict (id) do nothing;
