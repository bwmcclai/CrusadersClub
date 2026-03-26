-- ── Update RLS for Guest Access ───────────────────────────────

-- 1. Allow unauthenticated users to see waiting games in the lobby
drop policy if exists "Waiting games visible to all authenticated" on public.games;
create policy "Waiting games visible to all (including guests)"
  on public.games for select
  using (status = 'waiting' or public.is_game_participant(id));

-- 2. Allow unauthenticated users to see players in waiting games
drop policy if exists "Game players visible to participants or waiting games" on public.game_players;
create policy "Game players visible to all for waiting games"
  on public.game_players for select
  using (
    public.is_game_participant(game_id)
    or exists (
      select 1 from public.games where id = game_id and status = 'waiting'
    )
  );

-- Note: Players and Battle Maps are already publicly readable based on existing policies.
