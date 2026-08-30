create table public.song_handoffs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_label text not null check (pg_catalog.btrim(sender_label) <> ''),
  recipient_label text check (recipient_label is null or pg_catalog.btrim(recipient_label) <> ''),
  token uuid not null unique default pg_catalog.gen_random_uuid(),
  songs jsonb not null check (
    pg_catalog.jsonb_typeof(songs) = 'array'
    and pg_catalog.jsonb_array_length(songs) > 0
  ),
  song_titles jsonb not null check (
    pg_catalog.jsonb_typeof(song_titles) = 'array'
    and pg_catalog.jsonb_array_length(song_titles) > 0
  ),
  attachments_omitted boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null default (pg_catalog.now() + interval '30 days')
);

create index song_handoffs_sender_created
  on public.song_handoffs (sender_id, created_at desc);

create index song_handoffs_pending_expiry
  on public.song_handoffs (expires_at)
  where status = 'pending';

alter table public.song_handoffs enable row level security;

create policy "Senders can read their song handoffs"
on public.song_handoffs for select to authenticated
using ((select auth.uid()) = sender_id);

revoke all on table public.song_handoffs from public;
revoke all on table public.song_handoffs from anon, authenticated;
grant select on table public.song_handoffs to authenticated;

create function public.create_song_handoff(
  p_song_ids uuid[],
  p_sender_label text,
  p_recipient_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender_id uuid := auth.uid();
  v_sender_label text;
  v_recipient_label text;
  v_requested_count integer;
  v_owned_count integer;
  v_songs jsonb;
  v_titles jsonb;
  v_attachments_omitted boolean;
  v_handoff_id uuid;
  v_token uuid := pg_catalog.gen_random_uuid();
  v_created_at timestamptz := pg_catalog.statement_timestamp();
  v_expires_at timestamptz;
begin
  if v_sender_id is null then
    raise exception 'Authentication required';
  end if;

  if p_song_ids is null or pg_catalog.cardinality(p_song_ids) = 0 then
    raise exception 'Select at least one song';
  end if;

  if pg_catalog.array_position(p_song_ids, null::uuid) is not null then
    raise exception 'Song IDs cannot be null';
  end if;

  if p_sender_label is null or pg_catalog.btrim(p_sender_label) = '' then
    raise exception 'Sender label is required';
  end if;

  v_sender_label := pg_catalog.btrim(p_sender_label);
  v_recipient_label := nullif(pg_catalog.btrim(coalesce(p_recipient_label, '')), '');
  v_expires_at := v_created_at + interval '30 days';

  select pg_catalog.count(distinct selected.song_id)::integer
    into v_requested_count
  from pg_catalog.unnest(p_song_ids) as selected(song_id);

  with requested as (
    select
      selected.song_id,
      pg_catalog.min(selected.ordinal_position) as ordinal_position
    from pg_catalog.unnest(p_song_ids) with ordinality
      as selected(song_id, ordinal_position)
    group by selected.song_id
  )
  select
    pg_catalog.count(*)::integer,
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'title', s.title,
        'song_text', s.song_text,
        'meta', coalesce(s.meta, '{}'::jsonb) - array[
          'grooveSheets',
          'tabSheets',
          'melodySheets',
          'grooveMap',
          'tabMap',
          'melodyMap'
        ]::text[]
      )
      order by requested.ordinal_position
    ),
    pg_catalog.jsonb_agg(s.title order by requested.ordinal_position),
    coalesce(
      pg_catalog.bool_or(
        (
          s.meta ? 'grooveSheets'
          and s.meta -> 'grooveSheets' not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb)
        )
        or (
          s.meta ? 'tabSheets'
          and s.meta -> 'tabSheets' not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb)
        )
        or (
          s.meta ? 'melodySheets'
          and s.meta -> 'melodySheets' not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb)
        )
        or (
          s.meta ? 'grooveMap'
          and s.meta -> 'grooveMap' not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb)
        )
        or (
          s.meta ? 'tabMap'
          and s.meta -> 'tabMap' not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb)
        )
        or (
          s.meta ? 'melodyMap'
          and s.meta -> 'melodyMap' not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb)
        )
      ),
      false
    )
    into v_owned_count, v_songs, v_titles, v_attachments_omitted
  from requested
  join public.songs as s
    on s.id = requested.song_id
   and s.user_id = v_sender_id;

  if v_owned_count <> v_requested_count then
    raise exception 'One or more songs were not found or are not owned by you';
  end if;

  insert into public.song_handoffs (
    sender_id,
    sender_label,
    recipient_label,
    token,
    songs,
    song_titles,
    attachments_omitted,
    created_at,
    expires_at
  )
  values (
    v_sender_id,
    v_sender_label,
    v_recipient_label,
    v_token,
    v_songs,
    v_titles,
    v_attachments_omitted,
    v_created_at,
    v_expires_at
  )
  returning id into v_handoff_id;

  return pg_catalog.jsonb_build_object(
    'id', v_handoff_id,
    'token', v_token,
    'song_count', v_owned_count,
    'titles', v_titles,
    'sender_label', v_sender_label,
    'recipient_label', v_recipient_label,
    'status', 'pending',
    'created_at', v_created_at,
    'expires_at', v_expires_at,
    'attachments_omitted', v_attachments_omitted,
    'can_accept', false
  );
end;
$$;

create function public.preview_song_handoff(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_handoff public.song_handoffs%rowtype;
  v_titles jsonb;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if v_viewer_id is null then
    raise exception 'Authentication required';
  end if;

  select handoff.*
    into v_handoff
  from public.song_handoffs as handoff
  where handoff.token = p_token;

  if not found then
    raise exception 'Song handoff not found';
  end if;

  select coalesce(
      pg_catalog.jsonb_agg(snapshot.song ->> 'title' order by snapshot.ordinal_position),
      '[]'::jsonb
    )
    into v_titles
  from pg_catalog.jsonb_array_elements(v_handoff.songs) with ordinality
    as snapshot(song, ordinal_position);

  return pg_catalog.jsonb_build_object(
    'id', v_handoff.id,
    'song_count', pg_catalog.jsonb_array_length(v_handoff.songs),
    'titles', v_titles,
    'sender_label', v_handoff.sender_label,
    'recipient_label', v_handoff.recipient_label,
    'status', case
      when v_handoff.status = 'pending' and v_handoff.expires_at <= v_now then 'expired'
      else v_handoff.status
    end,
    'created_at', v_handoff.created_at,
    'expires_at', v_handoff.expires_at,
    'attachments_omitted', v_handoff.attachments_omitted,
    'can_accept', (
      v_handoff.status = 'pending'
      and v_handoff.expires_at > v_now
      and v_handoff.sender_id <> v_viewer_id
    )
  );
end;
$$;

create function public.accept_song_handoff(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid := auth.uid();
  v_handoff public.song_handoffs%rowtype;
  v_titles jsonb;
  v_song_ids jsonb;
  v_song_count integer;
  v_accepted_at timestamptz := pg_catalog.statement_timestamp();
begin
  if v_recipient_id is null then
    raise exception 'Authentication required';
  end if;

  select handoff.*
    into v_handoff
  from public.song_handoffs as handoff
  where handoff.token = p_token
  for update;

  if not found then
    raise exception 'Song handoff not found';
  end if;

  if v_handoff.sender_id = v_recipient_id then
    raise exception 'You cannot accept your own song handoff';
  end if;

  if v_handoff.status <> 'pending' then
    raise exception 'This song handoff is no longer available';
  end if;

  if v_handoff.expires_at <= v_accepted_at then
    raise exception 'This song handoff has expired';
  end if;

  select coalesce(
      pg_catalog.jsonb_agg(snapshot.song ->> 'title' order by snapshot.ordinal_position),
      '[]'::jsonb
    )
    into v_titles
  from pg_catalog.jsonb_array_elements(v_handoff.songs) with ordinality
    as snapshot(song, ordinal_position);

  with song_snapshots as (
    select snapshot.song, snapshot.ordinal_position
    from pg_catalog.jsonb_array_elements(v_handoff.songs) with ordinality
      as snapshot(song, ordinal_position)
  ),
  inserted_songs as (
    insert into public.songs (user_id, title, song_text, meta)
    select
      v_recipient_id,
      coalesce(nullif(song_snapshots.song ->> 'title', ''), 'Untitled'),
      coalesce(song_snapshots.song ->> 'song_text', ''),
      coalesce(song_snapshots.song -> 'meta', '{}'::jsonb)
    from song_snapshots
    order by song_snapshots.ordinal_position
    returning id
  )
  select
    coalesce(pg_catalog.jsonb_agg(inserted_songs.id), '[]'::jsonb),
    pg_catalog.count(*)::integer
    into v_song_ids, v_song_count
  from inserted_songs;

  update public.song_handoffs
  set
    status = 'accepted',
    accepted_by = v_recipient_id,
    accepted_at = v_accepted_at
  where id = v_handoff.id;

  return pg_catalog.jsonb_build_object(
    'id', v_handoff.id,
    'song_count', v_song_count,
    'titles', v_titles,
    'song_ids', v_song_ids,
    'status', 'accepted',
    'accepted_at', v_accepted_at,
    'attachments_omitted', v_handoff.attachments_omitted
  );
end;
$$;

create function public.cancel_song_handoff(p_handoff_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender_id uuid := auth.uid();
  v_cancelled public.song_handoffs%rowtype;
begin
  if v_sender_id is null then
    raise exception 'Authentication required';
  end if;

  update public.song_handoffs
  set status = 'cancelled'
  where id = p_handoff_id
    and sender_id = v_sender_id
    and status = 'pending'
  returning * into v_cancelled;

  if not found then
    raise exception 'Pending song handoff not found or not owned by you';
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_cancelled.id,
    'status', v_cancelled.status
  );
end;
$$;

revoke all on function public.create_song_handoff(uuid[], text, text) from public;
revoke all on function public.create_song_handoff(uuid[], text, text) from anon;
revoke all on function public.preview_song_handoff(uuid) from public;
revoke all on function public.preview_song_handoff(uuid) from anon;
revoke all on function public.accept_song_handoff(uuid) from public;
revoke all on function public.accept_song_handoff(uuid) from anon;
revoke all on function public.cancel_song_handoff(uuid) from public;
revoke all on function public.cancel_song_handoff(uuid) from anon;

grant execute on function public.create_song_handoff(uuid[], text, text) to authenticated;
grant execute on function public.preview_song_handoff(uuid) to authenticated;
grant execute on function public.accept_song_handoff(uuid) to authenticated;
grant execute on function public.cancel_song_handoff(uuid) to authenticated;
