-- Vision Computational Architectural AI - Supabase Database Schema
-- Run this SQL in the Supabase SQL editor to configure database tables, storage buckets, and RLS policies.

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default now(),
  full_name text,
  username text unique,
  avatar_url text
);

alter table public.profiles enable row level security;

create policy "Allow public read access to profiles"
  on public.profiles for select
  using (true);

create policy "Allow users to update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Allow users to insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Allow users to delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- 2. PROJECTS TABLE
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null default 'Untitled Vastu Layout',
  house_data jsonb not null,
  building_type text default 'single',
  floor_count integer default 1,
  roof_style text default 'rcc_flat',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.projects enable row level security;

create policy "Users can select their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- 3. FLOOR PLANS TABLE
create table public.floor_plans (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  dimensions jsonb,
  walls jsonb,
  openings jsonb,
  rooms jsonb,
  created_at timestamp with time zone default now()
);

alter table public.floor_plans enable row level security;

create policy "Only owners can select floor plans"
  on public.floor_plans for select
  using (auth.uid() = user_id);

create policy "Only owners can insert floor plans"
  on public.floor_plans for insert
  with check (auth.uid() = user_id);

create policy "Only owners can update floor plans"
  on public.floor_plans for update
  using (auth.uid() = user_id);

create policy "Only owners can delete floor plans"
  on public.floor_plans for delete
  using (auth.uid() = user_id);

-- 4. BUILDINGS TABLE
create table public.buildings (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  specs jsonb,
  created_at timestamp with time zone default now()
);

alter table public.buildings enable row level security;

create policy "Only owners can view buildings"
  on public.buildings for select
  using (auth.uid() = user_id);

create policy "Only owners can insert buildings"
  on public.buildings for insert
  with check (auth.uid() = user_id);

create policy "Only owners can update buildings"
  on public.buildings for update
  using (auth.uid() = user_id);

create policy "Only owners can delete buildings"
  on public.buildings for delete
  using (auth.uid() = user_id);

-- 5. AI GENERATIONS LOGS
create table public.ai_generations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  prompt text not null,
  response_config jsonb,
  created_at timestamp with time zone default now()
);

alter table public.ai_generations enable row level security;

create policy "Only owners can view ai generation logs"
  on public.ai_generations for select
  using (auth.uid() = user_id);

create policy "Only owners can write ai log tags"
  on public.ai_generations for insert
  with check (auth.uid() = user_id);

create policy "Only owners can update ai log tags"
  on public.ai_generations for update
  using (auth.uid() = user_id);

create policy "Only owners can delete ai log tags"
  on public.ai_generations for delete
  using (auth.uid() = user_id);

-- 6. UPLOADS TABLE
create table public.uploads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  file_name text not null,
  file_url text not null,
  created_at timestamp with time zone default now()
);

alter table public.uploads enable row level security;

create policy "Only owners can view uploaded blueprints"
  on public.uploads for select
  using (auth.uid() = user_id);

create policy "Only owners can register upload logs"
  on public.uploads for insert
  with check (auth.uid() = user_id);

create policy "Only owners can update upload logs"
  on public.uploads for update
  using (auth.uid() = user_id);

create policy "Only owners can delete upload logs"
  on public.uploads for delete
  using (auth.uid() = user_id);

-- 7. EXPORTS LOGS
create table public.exports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references public.projects on delete cascade,
  export_type text not null, -- 'svg' | 'glb' | 'obj'
  file_url text not null,
  created_at timestamp with time zone default now()
);

alter table public.exports enable row level security;

create policy "Only owners can view export files"
  on public.exports for select
  using (auth.uid() = user_id);

create policy "Only owners can insert export logs"
  on public.exports for insert
  with check (auth.uid() = user_id);

create policy "Only owners can update export logs"
  on public.exports for update
  using (auth.uid() = user_id);

create policy "Only owners can delete export logs"
  on public.exports for delete
  using (auth.uid() = user_id);

-- 8. STORAGE BUCKETS SETUP
-- Create buckets if they do not exist
insert into storage.buckets (id, name, public)
values ('blueprint-uploads', 'blueprint-uploads', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('exported-cad', 'exported-cad', true)
on conflict (id) do nothing;

-- Enable RLS for Storage Objects (just in case)
alter table storage.objects enable row level security;

-- Storage policies for 'blueprint-uploads'
create policy "Allow authenticated inserts to blueprint uploads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blueprint-uploads' and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "Allow owners select access to blueprint uploads"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'blueprint-uploads' and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "Allow owners delete access to blueprint uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'blueprint-uploads' and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "Allow owners update access to blueprint uploads"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'blueprint-uploads' and (auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'blueprint-uploads' and (auth.uid())::text = (storage.foldername(name))[1]);

-- Storage policies for 'exported-cad'
create policy "Allow authenticated inserts to exported cad"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'exported-cad' and (auth.uid())::text = (storage.foldername(name))[2]);

create policy "Allow owners select access to exported cad"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'exported-cad' and (auth.uid())::text = (storage.foldername(name))[2]);

create policy "Allow owners delete access to exported cad"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'exported-cad' and (auth.uid())::text = (storage.foldername(name))[2]);

create policy "Allow owners update access to exported cad"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'exported-cad' and (auth.uid())::text = (storage.foldername(name))[2])
  with check (bucket_id = 'exported-cad' and (auth.uid())::text = (storage.foldername(name))[2]);

-- Trigger profile auto creation on auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
