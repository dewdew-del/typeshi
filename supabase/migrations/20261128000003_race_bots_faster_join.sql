-- Quick race finds players faster: some bots are there at once, others trickle in, like real people.
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
  last_at timestamptz := p_from;
  i int;
begin
  for i in 1..p_n loop
    m := mults[1 + floor(random() * array_length(mults, 1))::int];
    select b.user_id into bot
    from private.bots b
    where not exists (select 1 from public.room_players rp where rp.room_id = p_room and rp.user_id = b.user_id)
      and not exists (
        select 1 from public.room_players rp join public.rooms r on r.id = rp.room_id
        where rp.user_id = b.user_id and r.status <> 'done' and r.created_at > now() - interval '1 hour')
    order by abs(b.base_wpm - p_ref * m) + random() * 8
    limit 1;
    exit when bot is null;
    insert into public.room_players (room_id, user_id, joined_at) values (p_room, bot, t_at);
    last_at := t_at;
    -- 40% join almost together with the one before, the rest after a short, uneven wait.
    t_at := t_at + make_interval(secs => case when random() < 0.4 then 0.1 + random() * 0.3 else p_gap_s * (0.4 + random()) end);
  end loop;
  return last_at;
end;
$$;
revoke all on function private.add_bots(uuid, int, real, timestamptz, real) from public, anon, authenticated;

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
  -- The first bot is already there; the countdown starts a moment after the last one arrives.
  last_join := private.add_bots(rid, 3 + floor(random() * 2)::int, private.player_wpm(uid), now(), 1.6);
  update public.rooms set status = 'racing', starts_at = last_join + interval '5.8 seconds' where id = rid;
  perform private.plan_race_bots(rid);
  return rid;
end;
$$;
