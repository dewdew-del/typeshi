-- Race bots: computer players that look like real people, so races and leaderboards are never empty.
-- Everything that marks an account as a bot lives in the private schema, which the browser cannot read.
--   1. Bot accounts with human-looking names and a personality each (private.bots).
--   2. Bots post solo casual scores through the day (pg_cron), so they appear on the boards with a history.
--   3. Race bots: picked near the player's speed, results decided when the race starts, with a streak breaker.
--   4. quick_race(): a race against bots that starts after a short "finding players" wait.
--   5. fill_room(): bots join a public room when its host has been waiting alone.
-- Bot rows in room_players and race_results are written with a future joined_at / created_at and stay
-- hidden until that moment, so bots seem to join one by one and finish at their own pace.

-- ---------------------------------------------------------------- 1. bot accounts
create table private.bots (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  base_wpm real not null,
  style text not null check (style in ('fader', 'steady', 'sprinter')),
  consistency real not null, -- spread of speed between runs (0.04 = steady, 0.12 = all over the place)
  accuracy real not null,
  quit_chance real not null,
  peak_hour smallint not null, -- Manila hour this bot plays most
  posts_per_day real not null
);
revoke all on private.bots from public, anon, authenticated;

do $$
declare
  filipino text[] := array['kuya_migs', 'ate_bea', 'JuanDLC', 'ma_ria08', 'jhunjhun', 'princess.mae', 'kenneth_rg', 'aljon23',
    'rizza.mae', 'paolo.dz', 'jhayvee', 'bryle_x', 'mikay_sg', 'carlo.reyes', 'nicole_tan', 'enzo.cruz', 'janjan_17',
    'kath.bernardo', 'lj.santos', 'migo_vidal', 'tisay_ana', 'jomar.p', 'ricoyy', 'shiela_m', 'angelo_dlr', 'trixie.ph',
    'dave_cabs', 'renz.go', 'yanyan_09', 'joshua.lim', 'bea.alonzo_', 'kimpoy22', 'jerome.v', 'aira_mae', 'nonoy.b',
    'inday_cris', 'marvin.tz', 'cheska_r', 'jayson.dc', 'gelai.m', 'pao_lopez', 'neneng.b', 'rafael.c', 'joanna.yu',
    'macmac_14', 'lyka.ann', 'dindo_r', 'chinchin.g', 'arvin_sy', 'kristel.p', 'bimbo.t', 'mayet_23', 'kiko.dl',
    'hazel.mndz', 'jun_reyes'];
  gamer text[] := array['ShadowKeys', 'xVelocity', 'NightOwl_TV', 'KeyRider', 'PixelNinja', 'frostbyte_', 'Zer0Lag',
    'TurboThumbs', 'NovaStrike', 'clutchkid', 'Rykn', 'hexed_', 'VortexV', 'Aimless_Ace', 'Kaizen99', 'Blitzz', 'lowping_',
    'ArcLight', 'Neon.Fox', 'sn1per_mode', 'Riftwalker', 'MoonLoot', 'Tempo_x', 'dr1ftking', 'Vexis', 'ByteStorm',
    'Quickfire_', 'OrbitZ', 'KeyLord', 'Sable.gg', 'Crimson_Q', 'echo_one', 'FluxRunner', 'Valkyr', 'Sp3ctre', 'IronTap',
    'zenkai_', 'GlitchMob', 'nitro_neo', 'SolarFlare', 'Hyperion_x', 'Kodachi', 'StaticVoid', 'Wraith.exe'];
  troll text[] := array['ctrl_alt_defeat', 'typo_king', 'backspace_abuser', 'capslock_crying', 'qwertyuiop', 'asdfghjkl',
    'keyboard_smash', 'slowpoke.exe', 'i_type_w_feet', 'hunt_and_peck', 'autocorrect_victim', 'fat_fingers', 'spacebar_hero',
    'delete_this', 'wpm_what', 'one_finger_andy', 'enter_key_slammer', 'homerow_who', 'tab_tab_tab', 'escape_artist',
    'num_lock_on', 'f5_spammer', 'alt_f4_pro', 'typing_w_mittens', 'lag_is_my_excuse', 'press_any_key', 'semicolon_sam',
    'shift_happens', 'caps_lock_karen', 'wasd_only', 'insert_key_fan', 'mouse_typist', 'zzz_keyboard'];
  countries text[] := array['PH', 'PH', 'PH', 'PH', 'PH', 'PH', 'PH', 'US', 'ID', 'IN', 'MY', 'SG'];
  names text[] := '{}';
  kinds text[] := '{}';
  n text;
  kind text;
  i int;
  uid uuid;
  joined timestamptz;
  wpm real;
begin
  -- 88 guests, then the named pools.
  for i in 1..88 loop
    names := names || ('Guest-' || lpad((floor(random() * 10000))::int::text, 4, '0'));
    kinds := kinds || 'guest'::text;
  end loop;
  foreach n in array filipino loop names := names || n; kinds := kinds || 'filipino'::text; end loop;
  foreach n in array gamer loop names := names || n; kinds := kinds || 'gamer'::text; end loop;
  foreach n in array troll loop names := names || n; kinds := kinds || 'troll'::text; end loop;

  for i in 1..array_length(names, 1) loop
    n := names[i];
    kind := kinds[i];
    continue when exists (select 1 from public.profiles p where p.username = n::extensions.citext);
    uid := gen_random_uuid();
    joined := now() - (random() * interval '90 days');
    -- No password and an unroutable email: nobody can sign in as a bot. Not anonymous, so the guest cleanup keeps them.
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_anonymous, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'bot-' || uid || '@bots.invalid', '',
      '{"provider":"email","providers":["email"]}', jsonb_build_object('username', n, 'country',
        case when kind = 'filipino' then 'PH' else countries[1 + floor(random() * array_length(countries, 1))::int] end),
      joined, joined, false, '', '', '', '');
    update public.profiles set is_guest = (kind = 'guest'), created_at = joined, updated_at = joined where id = uid;

    -- Speed: most people type 25-70 WPM; gamers a bit faster, guests a bit slower; a few are very fast.
    wpm := 22 + 60 * power(random(), 1.5)
      + case kind when 'gamer' then 10 when 'guest' then -4 else 0 end
      + case when random() < 0.07 then 45 + random() * 25 else 0 end;
    insert into private.bots (user_id, base_wpm, style, consistency, accuracy, quit_chance, peak_hour, posts_per_day)
    values (uid, greatest(18, wpm),
      case when random() < 0.7 then 'fader' when random() < 0.67 then 'steady' else 'sprinter' end,
      0.04 + random() * 0.08,
      least(99.5, 91 + random() * 8 - case when kind = 'guest' then 1.5 else 0 end),
      0.02 + random() * 0.06,
      case when random() < 0.7 then (17 + floor(random() * 8))::int % 24 else floor(random() * 24)::int end,
      0.8 + random() * 4);
  end loop;
end;
$$;

-- Roughly normal noise with mean 0 and standard deviation about 1.
create or replace function private.gauss()
returns double precision
language sql
volatile
set search_path = ''
as $$
  select (random() + random() + random() + random() - 2) * 1.73;
$$;

-- ---------------------------------------------------------------- 2. bots post casual scores
create or replace function private.bot_post_scores()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b private.bots%rowtype;
  h_now int := extract(hour from now() at time zone 'Asia/Manila')::int;
  today date := (now() at time zone 'Asia/Manila')::date;
  near boolean;
  dur smallint;
  lang text;
  wpm real;
  acc real;
  iid uuid;
begin
  -- Runs every 10 minutes (144 times a day). Busier around each bot's favourite hour.
  for b in select * from private.bots loop
    near := least(abs(h_now - b.peak_hour), 24 - abs(h_now - b.peak_hour)) <= 3;
    continue when random() > b.posts_per_day / 144.0 * case when near then 2.5 else 0.4 end;

    dur := (array[10, 30, 30, 60, 60, 120, 120])[1 + floor(random() * 7)::int];
    lang := case when random() < 0.85 then 'en' else 'fil' end;
    wpm := greatest(10, b.base_wpm * (1 + b.consistency * private.gauss())
      * case dur when 10 then 1.08 when 120 then 0.97 else 1 end
      * case lang when 'fil' then 0.93 else 1 end);
    acc := least(100, greatest(82, b.accuracy + private.gauss() * 1.5));

    insert into public.test_issues (user_id, kind, lang, duration_s, text, issued_at, consumed_at)
    values (b.user_id, 'casual', lang, dur, '-', now() - make_interval(secs => dur + 3), now())
    returning id into iid;
    insert into public.results (user_id, issue_id, kind, lang, duration_s, wpm, raw_wpm, accuracy, keystrokes, typed_ms)
    values (b.user_id, iid, 'casual', lang, dur, round(wpm::numeric, 1), round((wpm * (1 + (100 - acc) / 60))::numeric, 1),
      round(acc::numeric, 1), round(wpm * (1 + (100 - acc) / 60) * 5 * dur / 60), dur * 1000);

    -- Practice streak, like touch_streak() does for real players.
    update public.profiles set
      streak_current = case when last_practice_date = today then streak_current when last_practice_date = today - 1 then streak_current + 1 else 1 end,
      last_practice_date = today
    where id = b.user_id;
    update public.profiles set streak_best = greatest(streak_best, streak_current) where id = b.user_id;

    -- Slow improvement over the months, like a real person who keeps practising.
    update private.bots set base_wpm = least(150, base_wpm * 1.0005) where user_id = b.user_id;
  end loop;
end;
$$;
revoke all on function private.bot_post_scores() from public, anon, authenticated;

select cron.unschedule('typeright-bot-scores') where exists (select 1 from cron.job where jobname = 'typeright-bot-scores');
select cron.schedule('typeright-bot-scores', '*/10 * * * *', 'select private.bot_post_scores()');

-- A starting history so the boards and bot profiles are not empty on day one: about a week of runs.
do $$
declare
  b private.bots%rowtype;
  k int;
  dur smallint;
  lang text;
  wpm real;
  acc real;
  t_at timestamptz;
  iid uuid;
begin
  for b in select * from private.bots loop
    for k in 1..floor(b.posts_per_day * 7 * random())::int loop
      t_at := now() - random() * interval '7 days';
      dur := (array[10, 30, 30, 60, 60, 120, 120])[1 + floor(random() * 7)::int];
      lang := case when random() < 0.85 then 'en' else 'fil' end;
      wpm := greatest(10, b.base_wpm * (1 + b.consistency * private.gauss()) * case lang when 'fil' then 0.93 else 1 end);
      acc := least(100, greatest(82, b.accuracy + private.gauss() * 1.5));
      insert into public.test_issues (user_id, kind, lang, duration_s, text, issued_at, consumed_at)
      values (b.user_id, 'casual', lang, dur, '-', t_at - make_interval(secs => dur + 3), t_at)
      returning id into iid;
      insert into public.results (user_id, issue_id, kind, lang, duration_s, wpm, raw_wpm, accuracy, keystrokes, typed_ms, created_at)
      values (b.user_id, iid, 'casual', lang, dur, round(wpm::numeric, 1), round((wpm * (1 + (100 - acc) / 60))::numeric, 1),
        round(acc::numeric, 1), round(wpm * (1 + (100 - acc) / 60) * 5 * dur / 60), dur * 1000, t_at);
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- 3. race bots
-- Bot rows become visible to the room only when their time comes.
drop policy "Room members see each other" on public.room_players;
create policy "Room members see each other" on public.room_players for select to authenticated
  using (private.is_room_member(room_id) and joined_at <= now());
drop policy "Room members see race results" on public.race_results;
create policy "Room members see race results" on public.race_results for select to authenticated
  using (private.is_room_member(room_id) and created_at <= now());

-- How each bot's progress bar moves (read by room members through room_sync()).
create table private.race_bot_pace (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_ms integer not null, -- first key after the start signal
  end_ms integer not null,   -- finished, quit or hit the time cap
  end_pos real not null,     -- 0 to 1 of the text reached at end_ms
  style text not null,
  seed integer not null,
  primary key (room_id, user_id)
);
revoke all on private.race_bot_pace from public, anon, authenticated;

-- A player's usual speed: their last 10 races and casual runs. 35 WPM for someone new.
create or replace function private.player_wpm(p_user uuid)
returns real
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(avg(w), 35)::real from (
    (select r.wpm as w from public.race_results r where r.user_id = p_user and r.finished order by r.created_at desc limit 10)
    union all
    (select r.wpm from public.results r where r.user_id = p_user and r.kind = 'casual' and r.accuracy >= 85 order by r.created_at desc limit 10)
  ) x;
$$;

-- Wins (positive) or losses (negative) in a row in the player's latest races.
create or replace function private.player_streak(p_user uuid)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  won boolean;
  first_won boolean;
  n int := 0;
begin
  for won in
    select me.finished and not exists (
      select 1 from public.race_results o
      where o.room_id = me.room_id and o.user_id <> me.user_id and o.finished and o.finish_ms < me.finish_ms)
    from public.race_results me
    where me.user_id = p_user and me.created_at <= now()
    order by me.created_at desc
    limit 6
  loop
    if first_won is null then first_won := won; end if;
    exit when won <> first_won;
    n := n + 1;
  end loop;
  return case when first_won then n else -n end;
end;
$$;

-- Adds n bots to a room, spread around the reference speed, joining one by one from p_from.
create or replace function private.add_bots(p_room uuid, p_n int, p_ref real, p_from timestamptz, p_gap_s real)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  mults real[] := array[0.72, 0.86, 0.95, 1.04, 1.15, 1.32];
  m real;
  bot uuid;
  t_at timestamptz := p_from;
  i int;
begin
  for i in 1..p_n loop
    m := mults[1 + floor(random() * array_length(mults, 1))::int];
    select b.user_id into bot
    from private.bots b
    where not exists (select 1 from public.room_players rp where rp.room_id = p_room and rp.user_id = b.user_id)
      -- A bot is never in two live rooms at once.
      and not exists (
        select 1 from public.room_players rp join public.rooms r on r.id = rp.room_id
        where rp.user_id = b.user_id and r.status <> 'done' and r.created_at > now() - interval '1 hour')
    order by abs(b.base_wpm - p_ref * m) + random() * 8
    limit 1;
    exit when bot is null;
    insert into public.room_players (room_id, user_id, joined_at) values (p_room, bot, t_at);
    t_at := t_at + make_interval(secs => p_gap_s * (0.5 + random()));
  end loop;
  return t_at;
end;
$$;

-- Decides every bot's result the moment a race starts. The player still has to type well to win:
-- bot speeds are fixed for the race, only nudged by the streak breaker.
create or replace function private.plan_race_bots(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms%rowtype;
  len int;
  ref real;
  streak int;
  b record;
  wpm real;
  acc real;
  reaction int;
  typing double precision;
  frac double precision;
  cap_ms int;
  fastest uuid;
begin
  select * into r from public.rooms where id = p_room;
  len := char_length(r.text);
  cap_ms := r.cap_s * 1000;
  delete from public.race_results x where x.room_id = p_room and x.user_id in (select user_id from private.bots);
  delete from private.race_bot_pace where room_id = p_room;

  select avg(private.player_wpm(p.user_id)), min(private.player_streak(p.user_id)) filter (where true)
  into ref, streak
  from public.room_players p
  where p.room_id = p_room and p.user_id not in (select user_id from private.bots);
  ref := coalesce(ref, 35);
  streak := coalesce(streak, 0);

  -- Streak breaker: after 2+ losses the fast bots have an off day; after 3+ wins the fastest bot is a real threat.
  select bb.user_id into fastest from public.room_players p join private.bots bb on bb.user_id = p.user_id
  where p.room_id = p_room order by bb.base_wpm desc limit 1;

  for b in
    select x.* from public.room_players p join private.bots x on x.user_id = p.user_id where p.room_id = p_room
  loop
    wpm := b.base_wpm * (1 + b.consistency * private.gauss());
    if streak <= -2 then wpm := least(wpm, ref * (0.86 + random() * 0.1)); end if;
    if streak >= 3 and b.user_id = fastest then wpm := greatest(wpm, ref * (1.1 + random() * 0.12)); end if;
    wpm := greatest(12, wpm);
    acc := least(100, greatest(84, b.accuracy + private.gauss() * 1.5));
    reaction := 200 + floor(random() * 500)::int;
    typing := len / 5.0 / wpm * 60000;

    if random() < b.quit_chance then
      frac := 0.3 + random() * 0.5;
      insert into public.race_results (room_id, user_id, finished, progress, finish_ms, wpm, accuracy, created_at)
      values (p_room, b.user_id, false, floor(len * frac), null, round(wpm::numeric, 1), round(acc::numeric, 1),
        r.starts_at + make_interval(secs => (reaction + typing * frac) / 1000));
      insert into private.race_bot_pace values (p_room, b.user_id, reaction, round(reaction + typing * frac), frac, b.style, floor(random() * 2147483647));
    elsif reaction + typing > cap_ms then
      frac := (cap_ms - reaction) / typing;
      insert into public.race_results (room_id, user_id, finished, progress, finish_ms, wpm, accuracy, created_at)
      values (p_room, b.user_id, false, floor(len * frac), null, round(wpm::numeric, 1), round(acc::numeric, 1),
        r.starts_at + make_interval(secs => cap_ms / 1000.0));
      insert into private.race_bot_pace values (p_room, b.user_id, reaction, cap_ms, frac, b.style, floor(random() * 2147483647));
    else
      -- Under the accuracy floor counts as not finished, same rule as for people.
      insert into public.race_results (room_id, user_id, finished, progress, finish_ms, wpm, accuracy, created_at)
      values (p_room, b.user_id, acc >= 90, len, case when acc >= 90 then round(reaction + typing) end,
        round(wpm::numeric, 1), round(acc::numeric, 1), r.starts_at + make_interval(secs => (reaction + typing) / 1000));
      insert into private.race_bot_pace values (p_room, b.user_id, reaction, round(reaction + typing), 1, b.style, floor(random() * 2147483647));
    end if;
  end loop;
end;
$$;

-- Bots in the room the caller can see, with how their bar moves once the race runs.
create or replace function public.room_sync(p_room uuid)
returns table (user_id uuid, start_ms integer, end_ms integer, end_pos real, style text, seed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, s.start_ms, s.end_ms, s.end_pos, s.style, s.seed
  from public.room_players p
  join private.bots b on b.user_id = p.user_id
  left join private.race_bot_pace s on s.room_id = p.room_id and s.user_id = p.user_id
  where p.room_id = p_room and p.joined_at <= now() and private.is_room_member(p_room);
$$;

-- start_race: same as before, then plan the bots.
create or replace function public.start_race(p_room uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  t timestamptz;
begin
  if (select count(*) from public.room_players p where p.room_id = p_room and p.joined_at <= now()) < 2 then
    raise exception 'A race needs at least 2 players';
  end if;
  update public.rooms
  set status = 'racing', starts_at = now() + interval '5 seconds'
  where id = p_room and host_id = (select auth.uid()) and status = 'lobby'
  returning starts_at into t;
  if t is null then raise exception 'Only the host can start the race'; end if;
  -- Bots still on their way in are dropped, so nobody appears after the start.
  delete from public.room_players p where p.room_id = p_room and p.joined_at > now();
  perform private.plan_race_bots(p_room);
  return t;
end;
$$;

-- reset_room: same as before, plus the bots' pace.
create or replace function public.reset_room(p_room uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.rooms
  set status = 'lobby', starts_at = null, text = p_text
  where id = p_room and host_id = (select auth.uid()) and status <> 'lobby';
  if not found then raise exception 'Only the host can start a new round'; end if;
  delete from public.race_results where room_id = p_room;
  delete from private.race_bot_pace where room_id = p_room;
end;
$$;

-- leave_room: a bot never becomes host; a room with only bots left closes.
create or replace function public.leave_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  next_host uuid;
begin
  delete from public.room_players where room_id = p_room and user_id = uid;
  if (select host_id from public.rooms where id = p_room) = uid then
    select p.user_id into next_host from public.room_players p
    where p.room_id = p_room and p.user_id not in (select user_id from private.bots)
    order by p.joined_at limit 1;
    if next_host is null then
      delete from public.rooms where id = p_room;
    else
      update public.rooms set host_id = next_host where id = p_room;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------- 4. quick race
-- Bots join one by one over a few seconds, then the 5-second countdown runs.
create or replace function public.quick_race(p_text_type text, p_text text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c text;
  rid uuid;
  last_join timestamptz;
begin
  if uid is null then raise exception 'Sign in to race'; end if;
  if (select count(*) from public.rooms r where r.host_id = uid and r.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many races started. Try again later';
  end if;
  loop
    c := private.random_code(5);
    exit when not exists (select 1 from public.rooms r where r.code = c);
  end loop;
  insert into public.rooms (code, host_id, visibility, text_type, text)
  values (c, uid, 'private', p_text_type, p_text)
  returning id into rid;
  insert into public.room_players (room_id, user_id) values (rid, uid);
  last_join := private.add_bots(rid, 3 + floor(random() * 2)::int, private.player_wpm(uid), now() + interval '1.5 seconds', 2.2);
  update public.rooms set status = 'racing', starts_at = last_join + interval '5.5 seconds' where id = rid;
  perform private.plan_race_bots(rid);
  return rid;
end;
$$;

-- ---------------------------------------------------------------- 5. bots fill a lonely public room
create or replace function public.fill_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.rooms r
    where r.id = p_room and r.host_id = uid and r.visibility = 'public' and r.status = 'lobby'
      and r.created_at < now() - interval '10 seconds')
  then return; end if;
  if (select count(*) from public.room_players p where p.room_id = p_room) > 1 then return; end if;
  perform private.add_bots(p_room, 2 + floor(random() * 3)::int, private.player_wpm(uid), now() + interval '1 second', 5);
end;
$$;

revoke execute on function public.room_sync(uuid), public.quick_race(text, text), public.fill_room(uuid) from public, anon;
grant execute on function public.room_sync(uuid), public.quick_race(text, text), public.fill_room(uuid) to authenticated;
revoke all on function private.gauss(), private.player_wpm(uuid), private.player_streak(uuid),
  private.add_bots(uuid, int, real, timestamptz, real), private.plan_race_bots(uuid) from public, anon, authenticated;
