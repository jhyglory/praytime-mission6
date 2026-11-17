-- Mission 6 CMS project only. Never apply this or other migrations to Mission 5.
-- Existing 100 native templates were backed up and compared before this additive change.
create table if not exists public.prayers (
  id uuid primary key default gen_random_uuid(),
  source_key text unique check (source_key is null or source_key ~ '^praytime:ko:[A-Za-z0-9_-]{1,120}$'),
  title text not null check (char_length(title) between 1 and 300 and title ~ '[^[:space:]]'),
  content text not null check (char_length(content) between 1 and 20000 and content ~ '[^[:space:]]'),
  category text check (category is null or char_length(category) between 1 and 80),
  category_full text check (category_full is null or char_length(category_full) between 1 and 200),
  keyword text check (keyword is null or char_length(keyword) between 1 and 100),
  scripture_ref text check (scripture_ref is null or char_length(scripture_ref) between 1 and 200),
  scripture_text text check (scripture_text is null or char_length(scripture_text) between 1 and 2000),
  language text not null default 'ko' check (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  image_path text check (image_path is null or image_path ~ '^prayers/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'),
  source_payload jsonb check (source_payload is null or jsonb_typeof(source_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prayers add column if not exists status text not null default 'draft'
  constraint prayers_status_check check (status in ('draft', 'published'));
alter table public.prayers add column if not exists source_order integer
  constraint prayers_source_order_check check (source_order is null or source_order between 0 and 9999999);

create or replace function public.prayers_touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke execute on function public.prayers_touch_updated_at() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid='public.prayers'::regclass and tgname='prayers_updated_at' and not tgisinternal) then
    create trigger prayers_updated_at before update on public.prayers
      for each row execute function public.prayers_touch_updated_at();
  end if;
end $$;

-- Metadata only; existing original text, UUIDs and provenance remain unchanged.
update public.prayers set source_order = substring(source_key from 'guide_([0-9]+)$')::integer - 1
where source_order is null and source_key ~ '^praytime:ko:guide_[0-9]{3}$';

create index if not exists prayers_status_updated_id_idx on public.prayers (status, updated_at desc, id);
create index if not exists prayers_status_category_updated_idx on public.prayers (status, category, updated_at desc, id);
alter table public.prayers enable row level security;
revoke all on table public.prayers from anon, authenticated;
grant select (id, source_key, title, content, category, category_full, keyword,
  scripture_ref, scripture_text, language, image_path, created_at, updated_at, status, source_order)
on public.prayers to anon, authenticated;
grant all on table public.prayers to service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prayers' and policyname='published_prayers_read') then
    create policy published_prayers_read on public.prayers for select to anon, authenticated
      using (status = 'published');
  end if;
end $$;

-- Bucket prayer-covers stays PRIVATE. Configure/create buckets through Storage API only.
-- Unauthenticated clients may sign/read only a published guide's exact referenced object.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='published_prayer_covers_read') then
    create policy published_prayer_covers_read on storage.objects for select to anon, authenticated
      using (bucket_id = 'prayer-covers' and exists (
        select 1 from public.prayers p where p.status='published' and p.image_path=storage.objects.name
      ));
  end if;
end $$;
