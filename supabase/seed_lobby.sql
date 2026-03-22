-- ============================================================
-- Crusaders Club — Game Lobby Seed Data
-- Run this in the Supabase SQL editor to populate your DB
-- ============================================================

DO $$
DECLARE
    -- User UUIDs
    u1 UUID := '11111111-1111-4111-8111-111111111111';
    u2 UUID := '22222222-2222-4222-8222-222222222222';
    u3 UUID := '33333333-3333-4333-8333-333333333333';
    u4 UUID := '44444444-4444-4444-8444-444444444444';
    u5 UUID := '55555555-5555-4555-8555-555555555555';
    u6 UUID := '66666666-6666-4666-8666-666666666666';

    -- Map UUIDs
    m1 UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    m2 UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    m3 UUID := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    m4 UUID := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    m5 UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    m6 UUID := 'ffffffff-ffff-4fff-8fff-ffffffffffff';

    -- Game UUIDs
    g1 UUID := '10000000-0000-4000-8000-000000000001';
    g2 UUID := '10000000-0000-4000-8000-000000000002';
    g3 UUID := '10000000-0000-4000-8000-000000000003';
    g4 UUID := '10000000-0000-4000-8000-000000000004';
    g5 UUID := '10000000-0000-4000-8000-000000000005';
    g6 UUID := '10000000-0000-4000-8000-000000000006';

BEGIN
    -- ============================================================
    -- 1. Create Mock Users in auth.users
    -- ============================================================
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES
        (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ironfist@example.com', 'crypt', now(), '{"provider":"email","providers":["email"]}', '{"username":"IronFist"}', now(), now(), '', '', '', ''),
        (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seawolf@example.com', 'crypt', now(), '{"provider":"email","providers":["email"]}', '{"username":"SeaWolf"}', now(), now(), '', '', '', ''),
        (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'baron@example.com', 'crypt', now(), '{"provider":"email","providers":["email"]}', '{"username":"Baron"}', now(), now(), '', '', '', ''),
        (u4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sandstorm@example.com', 'crypt', now(), '{"provider":"email","providers":["email"]}', '{"username":"SandStorm"}', now(), now(), '', '', '', ''),
        (u5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'valhalla@example.com', 'crypt', now(), '{"provider":"email","providers":["email"]}', '{"username":"Valhalla"}', now(), now(), '', '', '', ''),
        (u6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'corsair@example.com', 'crypt', now(), '{"provider":"email","providers":["email"]}', '{"username":"Corsair"}', now(), now(), '', '', '', '')
    ON CONFLICT (id) DO NOTHING;

    -- NOTE: Inserting into auth.users triggers the handle_new_user() trigger which automatically inserts into public.players.
    -- To ensure our explicit test player IDs are handled properly in case triggers didn't run, we can optionally UPSERT the players.
    
    INSERT INTO public.players (id, username, elo, games_played, games_won, games_lost)
    VALUES
        (u1, 'IronFist', 1200,   15, 10, 5),
        (u2, 'SeaWolf',  1350,   40, 25, 15),
        (u3, 'Baron',    1100,   8,  3,  5),
        (u4, 'SandStorm', 1450,  60, 42, 18),
        (u5, 'Valhalla', 1280,   25, 14, 11),
        (u6, 'Corsair',  1310,   32, 18, 14)
    ON CONFLICT (id) DO UPDATE SET 
        username = EXCLUDED.username, 
        games_played = EXCLUDED.games_played, 
        games_won = EXCLUDED.games_won, 
        games_lost = EXCLUDED.games_lost;

    -- ============================================================
    -- 2. Mock Battle Maps
    -- ============================================================
    INSERT INTO public.battle_maps (id, name, description, author_id, region_name, region_bounds, territories, is_public, play_count)
    VALUES
        (m1, 'Europe Classic',  'A balanced 42-territory map representing WWII Europe.', u1, 'Europe', '{"minLat":35,"maxLat":70,"minLon":-10,"maxLon":40}', '[]', true, 2100),
        (m2, 'Pacific Islands', 'Island hopping strategy map.',                          u2, 'Pacific', '{"minLat":-30,"maxLat":30,"minLon":110,"maxLon":-140}', '[]', true, 1450),
        (m3, 'Africa Sands',    'Vast desert operations and coastal invasions.',         u4, 'Africa', '{"minLat":-35,"maxLat":37,"minLon":-20,"maxLon":50}', '[]', true, 980),
        (m4, 'Rhine Valley',    'A tight 12-territory close quarters combat scenario.',  u3, 'Europe', '{"minLat":47,"maxLat":52,"minLon":5,"maxLon":9}', '[]', true, 540),
        (m5, 'Nordic Fjords',   'Challenging terrain in the frozen north.',              u5, 'Europe', '{"minLat":55,"maxLat":72,"minLon":4,"maxLon":32}', '[]', true, 300),
        (m6, 'Caribbean',       'Pirate coves and naval dominance.',                     u6, 'Americas', '{"minLat":10,"maxLat":28,"minLon":-85,"maxLon":-60}', '[]', true, 800)
    ON CONFLICT (id) DO NOTHING;

    -- Adjust fake territory counts slightly without full polygons, but let's mock the territories array length so it appears in the UI
    UPDATE public.battle_maps SET territories = (SELECT jsonb_agg('{}'::jsonb) FROM generate_series(1, 42)) WHERE id = m1;
    UPDATE public.battle_maps SET territories = (SELECT jsonb_agg('{}'::jsonb) FROM generate_series(1, 28)) WHERE id = m2;
    UPDATE public.battle_maps SET territories = (SELECT jsonb_agg('{}'::jsonb) FROM generate_series(1, 35)) WHERE id = m3;
    UPDATE public.battle_maps SET territories = (SELECT jsonb_agg('{}'::jsonb) FROM generate_series(1, 12)) WHERE id = m4;
    UPDATE public.battle_maps SET territories = (SELECT jsonb_agg('{}'::jsonb) FROM generate_series(1, 24)) WHERE id = m5;
    UPDATE public.battle_maps SET territories = (SELECT jsonb_agg('{}'::jsonb) FROM generate_series(1, 18)) WHERE id = m6;


    -- ============================================================
    -- 3. Mock Games
    -- ============================================================
    INSERT INTO public.games (id, map_id, name, mode, status, max_players, current_players, created_by, created_at)
    VALUES
        (g1, m1, 'Western Front',   'lightning', 'waiting', 4, 1, u1, now() - interval '2 minutes'),
        (g2, m2, 'Pacific Storm',   'slow_day',  'waiting', 6, 2, u2, now() - interval '10 minutes'),
        (g3, m4, 'Clash at Rhine',  'lightning', 'waiting', 3, 1, u3, now() - interval '30 seconds'),
        (g4, m3, 'Desert Conquest', 'slow_hour', 'active',  4, 4, u4, now() - interval '1 hour'),
        (g5, m5, 'Nordic Campaign', 'slow_day',  'waiting', 5, 2, u5, now() - interval '15 minutes'),
        (g6, m6, 'Island Hopping',  'lightning', 'waiting', 6, 2, u6, now() - interval '3 minutes')
    ON CONFLICT (id) DO NOTHING;


    -- ============================================================
    -- 4. Mock Game Players (Populating the rooms)
    -- ============================================================
    -- Game 1: 1 player (IronFist), 1 AI
    INSERT INTO public.game_players (game_id, player_id, username, color, is_ai, ai_difficulty, turn_order)
    VALUES
        (g1, u1,   'IronFist', '#E74C3C', false, null,     1),
        (g1, null, 'Bot Alpha', '#3498DB', true,  'medium', 2)
    ON CONFLICT (game_id, player_id) DO NOTHING;

    -- Game 2: 2 players (SeaWolf, Corsair), 1 AI
    INSERT INTO public.game_players (game_id, player_id, username, color, is_ai, ai_difficulty, turn_order)
    VALUES
        (g2, u2,   'SeaWolf', '#3498DB', false, null, 1),
        (g2, u6,   'Corsair', '#E74C3C', false, null, 2),
        (g2, null, 'Bot Beta',  '#2ECC71', true,  'hard', 3)
    ON CONFLICT (game_id, player_id) DO NOTHING;

    -- Game 3: 1 player (Baron)
    INSERT INTO public.game_players (game_id, player_id, username, color, is_ai, turn_order)
    VALUES
        (g3, u3, 'Baron', '#2ECC71', false, 1)
    ON CONFLICT (game_id, player_id) DO NOTHING;

    -- Game 4: 4 players (active game) (SandStorm, SeaWolf, Baron, IronFist)
    INSERT INTO public.game_players (game_id, player_id, username, color, is_ai, turn_order)
    VALUES
        (g4, u4, 'SandStorm', '#F39C12', false, 1),
        (g4, u2, 'SeaWolf',   '#3498DB', false, 2),
        (g4, u3, 'Baron',     '#2ECC71', false, 3),
        (g4, u1, 'IronFist',  '#E74C3C', false, 4)
    ON CONFLICT (game_id, player_id) DO NOTHING;

    -- Game 5: 2 players (Valhalla, IronFist), 1 AI
    INSERT INTO public.game_players (game_id, player_id, username, color, is_ai, ai_difficulty, turn_order)
    VALUES
        (g5, u5,   'Valhalla', '#9B59B6', false, null, 1),
        (g5, u1,   'IronFist', '#E74C3C', false, null, 2),
        (g5, null, 'Bot Gamma','#F39C12', true, 'easy', 3)
    ON CONFLICT (game_id, player_id) DO NOTHING;

    -- Game 6: 2 players (Corsair, SandStorm)
    INSERT INTO public.game_players (game_id, player_id, username, color, is_ai, turn_order)
    VALUES
        (g6, u6, 'Corsair',   '#1ABC9C', false, 1),
        (g6, u4, 'SandStorm', '#F39C12', false, 2)
    ON CONFLICT (game_id, player_id) DO NOTHING;

END $$;

SELECT 'Successfully created seed data for lobby and games!' as message;
