-- No waiting for computer players: once every real player in a room has a result, the bots' results
-- (already decided at the start) show at once and the race is over.
create or replace function private.reveal_bot_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id in (select user_id from private.bots) then return new; end if;
  if exists (
    select 1 from public.room_players p
    where p.room_id = new.room_id
      and p.user_id not in (select user_id from private.bots)
      and not exists (select 1 from public.race_results r where r.room_id = p.room_id and r.user_id = p.user_id)
  ) then return new; end if;
  update public.race_results set created_at = now() where room_id = new.room_id and created_at > now();
  update public.rooms set status = 'done' where id = new.room_id and status = 'racing';
  return new;
end;
$$;
revoke all on function private.reveal_bot_results() from public, anon, authenticated;

create trigger race_results_reveal_bots after insert on public.race_results
  for each row execute function private.reveal_bot_results();
