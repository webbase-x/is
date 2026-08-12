-- ResearchStat workspace schema. Apply to the approved Supabase project only.
create table if not exists public.research_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'expert' check (role in ('viewer','expert','editor')),
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists public.research_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  preview_json jsonb,
  import_status text not null default 'confirmed' check (import_status in ('confirmed','processing','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.research_datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_file_id uuid references public.research_files(id) on delete set null,
  name text not null,
  columns_json jsonb not null default '[]'::jsonb,
  rows_json jsonb not null default '[]'::jsonb,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.research_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  analysis_type text not null,
  title text not null,
  input_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists research_projects_owner_idx on public.research_projects(owner_id, updated_at desc);
create index if not exists research_members_user_idx on public.research_project_members(user_id);
create index if not exists research_files_project_idx on public.research_files(project_id, created_at desc);
create index if not exists research_datasets_project_idx on public.research_datasets(project_id, created_at desc);
create index if not exists research_analyses_project_idx on public.research_analyses(project_id, created_at desc);

alter table public.research_projects enable row level security;
alter table public.research_project_members enable row level security;
alter table public.research_files enable row level security;
alter table public.research_datasets enable row level security;
alter table public.research_analyses enable row level security;

create policy research_projects_select on public.research_projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_projects_insert on public.research_projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy research_projects_update on public.research_projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy research_projects_delete on public.research_projects for delete to authenticated using ((select auth.uid()) = owner_id);

create policy research_members_select on public.research_project_members for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.research_projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
create policy research_members_insert on public.research_project_members for insert to authenticated with check (
  exists (select 1 from public.research_projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
create policy research_members_delete on public.research_project_members for delete to authenticated using (
  exists (select 1 from public.research_projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);

create policy research_files_select on public.research_files for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_files_insert on public.research_files for insert to authenticated with check (
  (select auth.uid()) = owner_id and exists (select 1 from public.research_projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
create policy research_files_delete on public.research_files for delete to authenticated using ((select auth.uid()) = owner_id);

create policy research_datasets_select on public.research_datasets for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_datasets_insert on public.research_datasets for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy research_datasets_update on public.research_datasets for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy research_datasets_delete on public.research_datasets for delete to authenticated using ((select auth.uid()) = owner_id);

create policy research_analyses_select on public.research_analyses for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_analyses_insert on public.research_analyses for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy research_analyses_update on public.research_analyses for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy research_analyses_delete on public.research_analyses for delete to authenticated using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.research_projects, public.research_project_members, public.research_files, public.research_datasets, public.research_analyses to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('research-documents','research-documents',false,26214400,array['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv','text/plain'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy research_docs_select on storage.objects for select to authenticated using (bucket_id='research-documents' and owner_id=(select auth.uid()::text));
create policy research_docs_insert on storage.objects for insert to authenticated with check (bucket_id='research-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy research_docs_update on storage.objects for update to authenticated using (bucket_id='research-documents' and owner_id=(select auth.uid()::text)) with check (bucket_id='research-documents' and owner_id=(select auth.uid()::text));
create policy research_docs_delete on storage.objects for delete to authenticated using (bucket_id='research-documents' and owner_id=(select auth.uid()::text));
