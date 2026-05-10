-- scenarios: one row per generated scenario
create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'anonymous',
  intent text not null,
  character_name text not null,
  character_description text not null,
  setting text not null,
  difficulty text not null,
  vocabulary jsonb not null default '[]',
  likely_phrases jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- sessions: one row per completed conversation
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null,
  user_id text not null default 'anonymous',
  turns jsonb not null default '[]',
  started_at bigint not null,
  ended_at bigint,
  new_vocabulary jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- indexes for history screen (most recent first per user)
create index if not exists sessions_user_created on sessions (user_id, created_at desc);
create index if not exists scenarios_user_created on scenarios (user_id, created_at desc);
