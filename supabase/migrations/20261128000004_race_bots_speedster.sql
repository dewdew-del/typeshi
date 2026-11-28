-- About 1 race in 3 has a very fast player: 1.5x to 1.9x the player's usual speed.
create or replace function private.add_bots(p_room uuid, p_n int, p_ref real, p_from timestamptz, p_gap_s real)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  mults real[] := array[0.72, 0.86, 0.95, 1.04, 1.15, 1.32];
  speedster boolean := random() < 0.33;
  m real;
  bot uuid;
  t_at timestamptz := p_from;
  last_at timestamptz := p_from;
  i int;
begin
  for i in 1..p_n loop
    m := case when i = p_n and speedster then 1.5 + random() * 0.4 else mults[1 + floor(random() * array_length(mults, 1))::int] end;
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
