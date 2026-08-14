-- contact_messages: the inbox behind /contact — screen 6.
--
-- The about page has offered an email address since it was written, which works
-- for the people who already trust the product enough to open a mail client.
-- A form asks for less, and it is also the only place a signed-out visitor can
-- report that something is broken.
--
-- Two decisions worth stating.
--
-- **Nobody can read this table through the API.** RLS is on and there is no
-- select policy at all, so `select` returns nothing for anon and for every
-- signed-in user, including the person who wrote the message. Only a
-- service-role connection — the dashboard, or a job — sees the contents. A
-- table that accepts writes from the open internet and hands them back on
-- request is a public mailbox.
--
-- **Writes go through a function, not an insert grant.** A bare insert
-- permission is an open pipe: anything with the anon key can fill this table as
-- fast as it can post. `submit_contact_message` is the only way in, and it does
-- the length checks and the rate limit inside the database, where a caller
-- cannot skip them.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  -- Null for a signed-out visitor, and null again if the account is later
  -- deleted: the message stays, detached, because a support thread that
  -- vanishes mid-conversation helps nobody.
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  /** The page they wrote from, when the form knows it. Nothing else is logged. */
  source_path text,
  created_at timestamptz not null default now(),
  /** Set by whoever answers it. The only column a human edits. */
  handled_at timestamptz,

  constraint contact_messages_name_len check (char_length(name) between 1 and 80),
  constraint contact_messages_email_len check (char_length(email) between 3 and 254),
  -- Not a validator, just a shape: a full RFC 5322 check belongs nowhere, and
  -- Zod has already run on the way in.
  constraint contact_messages_email_shape check (position('@' in email) > 1),
  constraint contact_messages_message_len check (char_length(message) between 10 and 4000),
  constraint contact_messages_source_len check (source_path is null or char_length(source_path) <= 200),
  constraint contact_messages_topic check (
    topic in ('support', 'bug', 'privacy', 'billing', 'security', 'feedback', 'other')
  )
);

comment on table public.contact_messages is
  'Messages sent from /contact. Write-only through submit_contact_message(); '
  'readable by service_role only.';

-- The rate limit's lookup, and the order an inbox is read in.
create index contact_messages_email_recent_idx
  on public.contact_messages (email, created_at desc);
create index contact_messages_unhandled_idx
  on public.contact_messages (created_at desc)
  where handled_at is null;

alter table public.contact_messages enable row level security;

-- Deliberately no policies. With RLS enabled and none defined, every operation
-- through the Data API is refused for anon and authenticated alike; service_role
-- bypasses RLS and so still reads. Removing this comment does not remove the
-- behaviour, but explains why the file looks unfinished.

revoke all on table public.contact_messages from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The only way in
-- ---------------------------------------------------------------------------

/**
 * Records one message, or refuses it.
 *
 * `security definer` so it can write to a table nobody has rights on. The
 * search_path is pinned, without which a caller could shadow the table name.
 *
 * The rate limit is per email address per hour. It is not a serious defence
 * against a determined flood — that needs a check the database cannot make,
 * against an address the database is never told — but it is enough to stop a
 * stuck retry loop or a bored visitor from writing a thousand rows, and it
 * costs one indexed count.
 */
create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_topic text,
  p_message text,
  p_source_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
  v_recent int;
  v_id uuid;
begin
  select count(*) into v_recent
  from public.contact_messages
  where email = v_email
    and created_at > now() - interval '1 hour';

  -- A distinct SQLSTATE, so the Server Action can tell "too many" from "the
  -- message was too short" without matching on English.
  if v_recent >= 5 then
    raise exception 'contact rate limit reached' using errcode = 'P0001';
  end if;

  insert into public.contact_messages (user_id, name, email, topic, message, source_path)
  values (auth.uid(), btrim(p_name), v_email, p_topic, btrim(p_message), p_source_path)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.submit_contact_message(text, text, text, text, text) is
  'Records a /contact message. Rate limited to 5 per email address per hour.';

-- The function is the grant. Nothing else on this table is reachable.
-- (`service_role` needs no line here: 20260813000400 grants it every table in
-- this schema, present and future, because it bypasses RLS anyway.)
grant execute on function public.submit_contact_message(text, text, text, text, text)
  to anon, authenticated;
