-- Watches the A2P 10DLC campaign and emails Kari when its status changes.
-- Applied to the kcocares hub project (rhbmuxvbmmlbkjegwtgr) on 2026-09-09.
--
-- Why email and not SMS: the campaign is the thing that makes SMS deliverable, so a text
-- announcing that texting works is the one message guaranteed not to arrive.
--
-- TEMPORARY. Once the campaign is approved and alerts are landing, drop the cron job,
-- this table, and the a2p-watch edge function — they have no purpose past that:
--
--   select cron.unschedule('a2p-watch');
--   drop table public.a2p_watch_state;
--
-- The twilio-status edge function is likewise a diagnostic, not a feature. It briefly
-- had a write path that moved phone numbers between Messaging Services (used once, to
-- move +1 651-273-0113 out of the stale May service into the one the campaign is filed
-- against). That path was removed the same day; it is read-only now and should be
-- deleted once this settles.

create table if not exists public.a2p_watch_state (
  campaign_sid text primary key,
  status       text not null,
  checked_at   timestamptz not null default now()
);

alter table public.a2p_watch_state enable row level security;
-- No policies on purpose: service role only. Nothing in a browser needs this.

create extension if not exists pg_cron;

select cron.unschedule('a2p-watch') where exists (select 1 from cron.job where jobname = 'a2p-watch');

-- Every 15 minutes. Campaigns usually settle within a few hours; frequent enough to
-- catch it quickly, quiet enough to cost nothing. The watcher emails only on a CHANGE.
select cron.schedule(
  'a2p-watch',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://rhbmuxvbmmlbkjegwtgr.supabase.co/functions/v1/a2p-watch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hub-secret', 'ladybug-hub-2026-3f9k2j8h7q-secret'
    ),
    body := '{}'::jsonb
  );
  $$
);
