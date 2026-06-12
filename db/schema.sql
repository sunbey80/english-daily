-- English Daily —— 数据库 schema（§3 技术方案）
-- 在 Supabase SQL Editor 执行。表均建在 public schema。
-- 注意：建项目时已开启 automatic RLS，新表会自动 enable RLS，
--       因此这里显式补齐策略，否则客户端访问会被全部拒绝。

-- =========================================================
-- 1. profile：业务用户信息（沿用 Supabase auth.users）
-- =========================================================
create table if not exists public.profile (
  id          uuid primary key references auth.users(id) on delete cascade,
  level       text not null default 'cet4',   -- cet4|cet6|kaoyan|ielts
  created_at  timestamptz not null default now()
);

-- =========================================================
-- 2. word：全局词条主表（词汇知识库，所有人共享）
-- =========================================================
create table if not exists public.word (
  id          bigserial primary key,
  lemma       text unique not null,           -- 词形还原后的原形，如 run
  cefr        text,                           -- 估计的 CEFR 等级
  in_cet4     boolean not null default false, -- 是否在四级考纲
  in_cet6     boolean not null default false,
  in_kaoyan   boolean not null default false,
  in_ielts    boolean not null default false,
  zh_gloss    text                            -- 中文释义缓存
);

-- =========================================================
-- 3. user_word：用户-词状态（画像核心，FSRS 字段在此）
-- =========================================================
create table if not exists public.user_word (
  user_id       uuid not null references public.profile(id) on delete cascade,
  word_id       bigint not null references public.word(id) on delete cascade,
  state         smallint not null default 0,  -- 0=未接触 1=学习中 2=已习得
  exposures     int not null default 0,       -- 累计接触次数
  last_seen_at  timestamptz,
  due_at        timestamptz,                  -- FSRS 下次应复现时间
  stability     real not null default 0,      -- FSRS 记忆稳定度
  difficulty    real not null default 5,      -- FSRS 难度
  primary key (user_id, word_id)
);

-- 选目标词时按 due_at 过滤，建索引加速
create index if not exists user_word_due_idx
  on public.user_word (user_id, due_at);

-- =========================================================
-- 4. story：故事线
-- =========================================================
create table if not exists public.story (
  id        bigserial primary key,
  title     text,
  level     text,
  source    text not null default 'original', -- original | public_domain
  synopsis  text                              -- 世界观/人设/已发生剧情摘要
);

-- =========================================================
-- 5. chapter：章节
-- =========================================================
create table if not exists public.chapter (
  id           bigserial primary key,
  story_id     bigint not null references public.story(id) on delete cascade,
  seq          int not null,                  -- 第几节
  user_id      uuid references public.profile(id) on delete cascade, -- NULL=通用版
  body         text not null,                 -- 正文
  target_words jsonb,                          -- [{lemma, count}]
  publish_at   timestamptz,
  unique (story_id, seq, user_id)
);

-- 取当日章节：按发布时间检索
create index if not exists chapter_publish_idx
  on public.chapter (publish_at);

-- =========================================================
-- RLS 策略
-- =========================================================
alter table public.profile   enable row level security;
alter table public.word      enable row level security;
alter table public.user_word enable row level security;
alter table public.story     enable row level security;
alter table public.chapter   enable row level security;

-- profile：用户只能读写自己的行
create policy "profile_select_own" on public.profile
  for select using (auth.uid() = id);
create policy "profile_insert_own" on public.profile
  for insert with check (auth.uid() = id);
create policy "profile_update_own" on public.profile
  for update using (auth.uid() = id);

-- word：所有登录用户可读（全局知识库）；写入仅服务端（service_role 绕过 RLS）
create policy "word_select_all" on public.word
  for select using (auth.role() = 'authenticated');

-- user_word：用户只能读写自己的词状态
create policy "user_word_select_own" on public.user_word
  for select using (auth.uid() = user_id);
create policy "user_word_insert_own" on public.user_word
  for insert with check (auth.uid() = user_id);
create policy "user_word_update_own" on public.user_word
  for update using (auth.uid() = user_id);

-- story：所有登录用户可读
create policy "story_select_all" on public.story
  for select using (auth.role() = 'authenticated');

-- chapter：通用版（user_id 为 NULL）所有人可读；个性化版仅本人可读
create policy "chapter_select_general_or_own" on public.chapter
  for select using (
    user_id is null or auth.uid() = user_id
  );
