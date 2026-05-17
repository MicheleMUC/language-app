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
  feedback jsonb,
  created_at timestamptz not null default now()
);

-- indexes for history screen (most recent first per user)
create index if not exists sessions_user_created on sessions (user_id, created_at desc);
create index if not exists scenarios_user_created on scenarios (user_id, created_at desc);

-- user_preferences: one row per user storing their CEFR level
create table if not exists user_preferences (
  user_id text primary key,
  level text not null default 'A2',
  updated_at timestamptz not null default now()
);

-- alter table user_preferences enable row level security;
-- create policy "users own prefs" on user_preferences for all
--   using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- user_vocabulary: deduplicated vocabulary bank across all sessions
create table if not exists user_vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  italian text not null,
  english text not null,
  example text,
  actively_used boolean not null default false,
  first_seen_at timestamptz not null default now(),
  constraint user_vocabulary_unique unique (user_id, italian)
);

create index if not exists user_vocab_user on user_vocabulary (user_id, first_seen_at desc);

-- pregenerated_scenarios: one pre-built scenario per user per intent, deleted when played
create table if not exists pregenerated_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  intent text not null,
  data jsonb not null,
  generated_at timestamptz not null default now(),
  constraint pregenerated_scenarios_unique unique (user_id, intent)
);

create index if not exists pregen_user on pregenerated_scenarios (user_id);

-- learning_goals: one active goal per user (trip prep curriculum)
create table if not exists learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  destination text not null,
  trip_date text,
  curriculum jsonb not null default '[]',
  grammar_milestones jsonb not null default '[]',
  estimated_weeks int not null default 4,
  completed_intents text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists learning_goals_user on learning_goals (user_id, created_at desc);

-- learner_profile: one row per user, updated after each session
create table if not exists learner_profile (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  weakness_map jsonb not null default '{}',
  strong_patterns text[] not null default '{}',
  vocab_to_reuse jsonb not null default '[]',
  user_context jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  constraint learner_profile_user_unique unique (user_id),
  constraint vocab_to_reuse_max_50 check (jsonb_array_length(vocab_to_reuse) <= 50)
);

create index if not exists learner_profile_user on learner_profile (user_id);

-- Row Level Security (apply after enabling auth)
-- alter table sessions enable row level security;
-- create policy "users own sessions" on sessions for all
--   using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
-- alter table scenarios enable row level security;
-- create policy "users own scenarios" on scenarios for all
--   using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
-- alter table user_vocabulary enable row level security;
-- create policy "users own vocab" on user_vocabulary for all
--   using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
-- alter table learner_profile enable row level security;
-- create policy "users own profile" on learner_profile for all
--   using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
-- Note: server-side upserts use SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
