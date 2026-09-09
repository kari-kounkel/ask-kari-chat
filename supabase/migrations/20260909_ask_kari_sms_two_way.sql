-- Ask Kari: text alerts to Kari, and replying by text back into the visitor's thread.
-- Applied to the kcocares hub project (rhbmuxvbmmlbkjegwtgr) on 2026-09-09 as three
-- migrations; this file is the resulting state, which is what matters when rebuilding.
--
-- Requires hub v13+: an SMS notify with no 'to' resolves to the hub's KARI_ALERT_NUMBER
-- secret, so no phone number is stored in the database.

-- ---------------------------------------------------------------------------
-- 1. conversations.short_code — the handle an SMS reply uses to pick its thread
-- ---------------------------------------------------------------------------

alter table public.conversations add column if not exists short_code text;

create or replace function public.gen_conversation_short_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  i int;
begin
  for attempt in 1..50 loop
    candidate := '';
    for i in 1..3 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    -- Only collide with conversations still open; codes are free to be reused later.
    if not exists (
      select 1 from public.conversations
      where short_code = candidate and coalesce(status, 'open') <> 'closed'
    ) then
      return candidate;
    end if;
  end loop;
  -- Fall back to something guaranteed unique rather than failing the insert.
  return upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
end;
$$;

create or replace function public.set_conversation_short_code()
returns trigger
language plpgsql
as $$
begin
  if NEW.short_code is null or trim(NEW.short_code) = '' then
    NEW.short_code := public.gen_conversation_short_code();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_conversation_short_code on public.conversations;
create trigger trg_set_conversation_short_code
  before insert on public.conversations
  for each row execute function public.set_conversation_short_code();

update public.conversations
   set short_code = public.gen_conversation_short_code()
 where short_code is null;

create unique index if not exists conversations_short_code_open_idx
  on public.conversations (short_code)
  where coalesce(status, 'open') <> 'closed';

-- ---------------------------------------------------------------------------
-- 2. Visitor message -> email Kari (existing) + text Kari (new)
-- ---------------------------------------------------------------------------

create or replace function public.notify_hub_ask_kari_message()
returns trigger
language plpgsql
security definer
as $function$
declare
  hub_url    text := 'https://rhbmuxvbmmlbkjegwtgr.supabase.co/functions/v1/hub';
  hub_secret text := 'ladybug-hub-2026-3f9k2j8h7q-secret';
  kari_email text := 'kari@karikounkel.com';
  conv       record;
  subject    text;
  body_text  text;
  body_html  text;
  sms_text   text;
  snippet    text;
  is_image   boolean;
  vname      text;
  vsite      text;
  vemail     text;
  vcode      text;
begin
  if NEW.sender is distinct from 'visitor' then return NEW; end if;

  select * into conv from public.conversations where id = NEW.conversation_id;
  vname  := coalesce(conv.visitor_name, 'Anonymous');
  vsite  := coalesce(conv.site_origin, 'unknown');
  vemail := coalesce(conv.visitor_email, '(none provided)');
  vcode  := coalesce(conv.short_code, '');

  is_image := NEW.body ~* '^https?://.+\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$'
           or NEW.body like '%/storage/v1/object/public/support-files/%';

  subject := 'Ask Kari — ' || vname || ' (' || vsite || ')'
             || case when vcode <> '' then ' [' || vcode || ']' else '' end;

  if is_image then
    body_text :=
      vname || ' just sent you an image on Ask Kari.' || E'\n\n' ||
      'View it here: ' || NEW.body || E'\n\n' ||
      'From site: ' || vsite || E'\n' ||
      'Contact:   ' || vemail || E'\n' ||
      case when vcode <> '' then 'Reply by text: "' || vcode || ' your answer"' || E'\n' else '' end ||
      'Conversation ID: ' || NEW.conversation_id::text;
    body_html :=
      '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;color:#1a1614;max-width:640px;margin:0 auto">' ||
      '<p style="margin:0 0 12px"><strong>' || vname || '</strong> just sent you an image on Ask Kari:</p>' ||
      '<a href="' || NEW.body || '" target="_blank"><img src="' || NEW.body || '" alt="Ask Kari attachment" style="max-width:100%;border-radius:8px;border:1px solid #ddd"></a>' ||
      '<p style="margin:14px 0 4px;font-size:13px;color:#6b5e52"><strong>From site:</strong> ' || vsite || '</p>' ||
      '<p style="margin:2px 0;font-size:13px;color:#6b5e52"><strong>Contact:</strong> ' || vemail || '</p>' ||
      case when vcode <> '' then '<p style="margin:8px 0;font-size:13px;color:#6b5e52">Reply by text: <strong>' || vcode || ' your answer</strong></p>' else '' end ||
      '<p style="margin:2px 0;font-size:11px;color:#9a8c7c">Conversation ID: ' || NEW.conversation_id::text || '</p>' ||
      '</div>';
    snippet := 'sent a photo';
  else
    body_text :=
      vname || ' just messaged you:' || E'\n\n' ||
      '"' || NEW.body || '"' || E'\n\n' ||
      'From site: ' || vsite || E'\n' ||
      'Contact:   ' || vemail || E'\n' ||
      case when vcode <> '' then 'Reply by text: "' || vcode || ' your answer"' || E'\n' else '' end ||
      'Conversation ID: ' || NEW.conversation_id::text;
    body_html :=
      '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;color:#1a1614;max-width:640px;margin:0 auto">' ||
      '<p style="margin:0 0 10px"><strong>' || vname || '</strong> just messaged you:</p>' ||
      '<blockquote style="margin:0 0 14px;padding:12px 16px;background:#fdf6f2;border-left:4px solid #e03820;font-family:Georgia,serif;font-size:16px;line-height:1.55;white-space:pre-wrap">' ||
      replace(replace(replace(NEW.body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
      '</blockquote>' ||
      '<p style="margin:2px 0;font-size:13px;color:#6b5e52"><strong>From site:</strong> ' || vsite || '</p>' ||
      '<p style="margin:2px 0;font-size:13px;color:#6b5e52"><strong>Contact:</strong> ' || vemail || '</p>' ||
      case when vcode <> '' then '<p style="margin:8px 0;font-size:13px;color:#6b5e52">Reply by text: <strong>' || vcode || ' your answer</strong></p>' else '' end ||
      '<p style="margin:2px 0;font-size:11px;color:#9a8c7c">Conversation ID: ' || NEW.conversation_id::text || '</p>' ||
      '</div>';
    snippet := left(regexp_replace(NEW.body, '\s+', ' ', 'g'), 90);
  end if;

  perform net.http_post(
    url := hub_url,
    body := jsonb_build_object(
      'action', 'notify', 'channel', 'email',
      'type', 'ask_kari_message', 'source', 'ask_kari',
      'to', kari_email, 'subject', subject,
      'body', body_text, 'html', body_html
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hub-secret', hub_secret)
  );

  -- 'to' omitted on purpose: the hub fills in KARI_ALERT_NUMBER.
  sms_text := vcode || ' · ' || vname || ' (' || vsite || '): ' || snippet
              || E'\n\nReply: ' || vcode || ' your answer';

  perform net.http_post(
    url := hub_url,
    body := jsonb_build_object(
      'action', 'notify', 'channel', 'sms',
      'type', 'ask_kari_message', 'source', 'ask_kari',
      'body', sms_text
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hub-secret', hub_secret)
  );

  return NEW;
end; $function$;

-- ---------------------------------------------------------------------------
-- 3. Kari's reply -> email the visitor, so it reaches them with the tab closed
-- ---------------------------------------------------------------------------

create or replace function public.notify_visitor_of_agent_reply()
returns trigger
language plpgsql
security definer
as $function$
declare
  hub_url    text := 'https://rhbmuxvbmmlbkjegwtgr.supabase.co/functions/v1/hub';
  hub_secret text := 'ladybug-hub-2026-3f9k2j8h7q-secret';
  conv       record;
  back_url   text;
  subject    text;
  body_text  text;
  body_html  text;
  is_image   boolean;
begin
  if NEW.sender is distinct from 'agent' then return NEW; end if;

  select * into conv from public.conversations where id = NEW.conversation_id;
  if conv.visitor_email is null or trim(conv.visitor_email) = '' then return NEW; end if;

  -- The canned greeting the widget posts itself right after the visitor's first message
  -- is not worth an email.
  if NEW.body in (
    'Give me a minute — or seven.',
    'You’re in the queue — I’ll reply right here. ⏳'
  ) or NEW.body like 'You’re in the queue%' then
    return NEW;
  end if;

  is_image := NEW.body ~* '^https?://.+\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$'
           or NEW.body like '%/storage/v1/object/public/support-files/%';

  -- site_origin is sometimes a label ("CARES Works") rather than a URL.
  back_url := case when conv.site_origin ~* '^https?://' then conv.site_origin
                   else 'https://chat.karikounkel.com' end;

  subject := 'Kari replied to your question';

  if is_image then
    body_text := 'Kari sent you something on Ask Kari:' || E'\n\n' || NEW.body ||
                 E'\n\nPick the conversation back up here: ' || back_url;
    body_html :=
      '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;color:#1a1614;max-width:640px;margin:0 auto">' ||
      '<p style="margin:0 0 12px"><strong>Kari</strong> sent you something:</p>' ||
      '<a href="' || NEW.body || '" target="_blank"><img src="' || NEW.body || '" alt="Attachment" style="max-width:100%;border-radius:8px;border:1px solid #ddd"></a>' ||
      '<p style="margin:16px 0 0;font-size:13px"><a href="' || back_url || '" style="color:#e03820">Pick the conversation back up →</a></p>' ||
      '</div>';
  else
    body_text := 'Kari replied:' || E'\n\n"' || NEW.body || '"' ||
                 E'\n\nPick the conversation back up here: ' || back_url;
    body_html :=
      '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;color:#1a1614;max-width:640px;margin:0 auto">' ||
      '<p style="margin:0 0 10px"><strong>Kari replied:</strong></p>' ||
      '<blockquote style="margin:0 0 14px;padding:12px 16px;background:#fdf6f2;border-left:4px solid #e03820;font-family:Georgia,serif;font-size:16px;line-height:1.55;white-space:pre-wrap">' ||
      replace(replace(replace(NEW.body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
      '</blockquote>' ||
      '<p style="margin:16px 0 0;font-size:13px"><a href="' || back_url || '" style="color:#e03820">Pick the conversation back up →</a></p>' ||
      '</div>';
  end if;

  perform net.http_post(
    url := hub_url,
    body := jsonb_build_object(
      'action', 'notify', 'channel', 'email',
      'type', 'ask_kari_reply', 'source', 'ask_kari',
      'to', conv.visitor_email, 'subject', subject,
      'body', body_text, 'html', body_html
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hub-secret', hub_secret)
  );

  return NEW;
end; $function$;

drop trigger if exists trg_notify_visitor_of_agent_reply on public.messages;
create trigger trg_notify_visitor_of_agent_reply
  after insert on public.messages
  for each row execute function public.notify_visitor_of_agent_reply();
