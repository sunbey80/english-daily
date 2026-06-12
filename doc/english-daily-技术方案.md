# English Daily —— 代码端技术方案

> 产品定位：每日连载式分级英语阅读。用户在读故事的过程中自然接触目标生词，系统按各人词汇画像动态控制文本难度，并在后续章节中安排生词复现，把"阅读"和"复习"合并成同一个动作。
>
> 本文档面向开发，约定技术栈、数据模型、核心算法（生成管线 + 复现引擎）、定时任务、目录结构与分阶段落地清单。

---

## 0. 设计前提（先达成共识再写代码）

1. **护城河在数据，不在生成**。任何人都能让大模型写一篇四级文章。我们的壁垒是「用户词汇画像」随使用越积越准，文本越来越贴合个人，迁移成本越来越高。所以**词表追踪的正确性是第一优先级**，从第一天就要做对（含词形还原）。
2. **等级挂考纲，不挂 CEFR**。难度档位用：四级 / 六级 / 考研 / 雅思。理由是国内用户有直觉认知，且利于 SEO 与小红书选题。
3. **内容只来自两类来源**：① AI 原创连载；② 公版作品 AI 降级改写。当代版权书一律不碰。
4. **MVP 范围**：一条原创连载故事线 × 一个等级（四级）× 网页端 + 公众号图文分发。功能三件套——每日章节、点词入生词本、次日复现。

---

## 1. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 / 全栈框架 | Next.js (App Router) | 部署到 Cloudflare Pages |
| 边缘函数 / API | Cloudflare Workers / Pages Functions | 生成接口、查词、SRS 调度 |
| 定时任务 | Cloudflare Cron Triggers | 每日预生成与发布 |
| 数据库 | Supabase (Postgres，区域选新加坡) | 自带 Auth，省去登录系统 |
| LLM | OpenRouter（OpenAI 兼容网关，模型可配置） | 见 §4；env `OPENROUTER_MODEL`，默认 `anthropic/claude-opus-4-8`。一个 key 可切换 Claude/GPT 等 |
| 词形还原 | wink-pos-tagger + wink-lemmatizer（服务端） | 见 §3.3。决定词表准确性，核心 |
| TTS（第二期） | API 级 TTS | 听读同步，通勤场景 |

域名已购、服务器已定，DNS/部署细节略，本文只覆盖代码端。

---

## 2. 系统架构

```
                    ┌─────────────────────────┐
   每日 08:00 ───▶ │ Cron: 章节预生成 & 发布   │
                    └───────────┬─────────────┘
                                │ 调用生成管线
                                ▼
   用户浏览器 ──▶ Cloudflare Pages (Next.js)
        │              │
        │ 点词/读完     │ SSR 渲染当日章节
        ▼              ▼
   Pages Functions ──▶ Supabase (Postgres)
   ├ /api/lookup  查词、写入生词本
   ├ /api/known   更新已知词状态
   ├ /api/review  返回当日待复现词
   └ /api/generate（内部，供 Cron 调用）
```

数据流核心闭环：
**用户读章节 → 点生词（标记 unknown）/ 读完未点的词（隐式提升熟悉度）→ 写入 user_word 状态 → 次日生成时读取该用户待习得词作为目标词 → 新章节自然复现。**

---

## 3. 数据模型

### 3.1 表结构（Postgres / Supabase）

```sql
-- 用户（沿用 Supabase auth.users，这里存业务字段）
create table profile (
  id           uuid primary key references auth.users(id),
  level        text not null default 'cet4',  -- cet4|cet6|kaoyan|ielts
  created_at   timestamptz default now()
);

-- 词条主表（全局共享，词汇知识库）
create table word (
  id          bigserial primary key,
  lemma       text unique not null,    -- 已做词形还原的原形，如 run
  cefr        text,                    -- 估计的 CEFR 等级
  in_cet4     boolean default false,   -- 是否在四级考纲
  in_cet6     boolean default false,
  in_kaoyan   boolean default false,
  in_ielts    boolean default false,
  zh_gloss    text                     -- 中文释义（缓存，减少查词调用）
);

-- 用户-词 状态表（画像核心，决定个性化）
create table user_word (
  user_id        uuid references profile(id),
  word_id        bigint references word(id),
  state          smallint default 0,    -- 0=未接触 1=学习中 2=已习得
  exposures      int default 0,         -- 累计接触次数
  last_seen_at   timestamptz,
  due_at         timestamptz,           -- FSRS 排期的下次应复现时间
  stability      real default 0,        -- FSRS 记忆稳定度
  difficulty     real default 5,        -- FSRS 难度
  primary key (user_id, word_id)
);

-- 故事线
create table story (
  id        bigserial primary key,
  title     text,
  level     text,
  source    text default 'original',  -- original | public_domain
  synopsis  text                       -- 给生成模型的世界观/人设/已发生剧情摘要
);

-- 章节
create table chapter (
  id          bigserial primary key,
  story_id    bigint references story(id),
  seq         int not null,             -- 第几节
  user_id     uuid,                     -- NULL=通用版；非空=该用户个性化版
  body        text not null,            -- 正文
  target_words jsonb,                   -- 本章目标词 [{lemma, count}]
  publish_at  timestamptz,
  unique (story_id, seq, user_id)
);
```

### 3.2 冷启动：怎么得到初始词汇画像

新用户没有任何 `user_word` 记录，用两步快速估计：

1. **选等级**（用户自报四级/六级/…）→ 把对应考纲及以下的词批量写入 `user_word`，`state=2`（默认已习得），更高等级词 `state=0`。
2. **15 词自测**（可选）：从该等级边界词里抽 15 个让用户标"认识/不认识"，用结果微调边界。

这样首篇文章就能合理地控制在 98% 覆盖率，避免开局体验崩。

### 3.3 词形还原（必须做对，否则画像全废）

`run / ran / running / runs` 必须归并成同一个 `lemma=run`，否则同一个词会被当成四个词反复"教"。

- 选型：`wink-pos-tagger`（分词 + Penn Treebank 词性标注）+ `wink-lemmatizer`（按词性还原）。纯 JS、可跑在 Worker。
- 流程：分词 → 词性标注 → 按词性还原（动词/名词/形容词）→ 过滤 → 查 `word` 表。
- 缩写、专有名词（NNP/NNPS）、数字（CD）、非纯字母 token 过滤，不计入词表。

> **实战踩坑（已在 `lib/lemmatize.ts` + `lib/coverage.ts` 修复，务必保留）**：
> 1. **过度还原**：wink-lemmatizer 会把形容词 `crooked` 误还原成 `crook`，导致与目标词 `crooked` 对不上。
>    → 校验时对每个 token 同时保留 `lemma` 与原形小写 `rawLower`，**任一匹配**即算命中。
> 2. **大写误判专名**：标牌/句首的普通词（如标牌 `Attic`）被标成 NNP 而被过滤，目标词漏计。
>    → 传入「已知词 + 目标词」小写集合 `rescue`，被判为 NNP 但其小写形在 `rescue` 中的词救回当普通词；真正人名地名仍过滤。
>
> 教训印证 §0：同一段模型输出，修这两个 bug 前判不通过，修后覆盖率 99%+ 通过——**词表追踪正确性是第一优先级**。

---

## 4. 生成管线（产品的核心价值）

### 4.1 目标

给定 `用户已知词表 + N 个本章目标词 + 故事上下文`，产出一节：
- 约 300 词；
- **已知词覆盖率 ≥ 98%**（i+1 原则，保证无痛理解 + 附带习得）；
- 每个目标词自然复现 2–3 次（朝着「单词需复现 7–12 次才习得」的总账户累积）；
- 句子偏短（均长 ~11 词），降低语法负担，让认知资源留给词汇；
- 章末留悬念钩子 + 标注次日更新时间。

### 4.2 流程（生成 → 校验 → 回填，失败重试）

```
1. 选目标词
   从 user_word 中筛 due_at <= 今天 的"待复现词"（复习优先）
   + 从 state=0 中按等级顺序取少量"新词"
   合并为本章 target_words（建议 5 个，复习:新 ≈ 3:2）

2. 取上下文
   story.synopsis + 最近 1–2 章正文摘要（保证剧情连贯）

3. 调用 LLM 生成正文（prompt 见 §4.3）

4. 校验（关键，不能信模型自报）
   a. 词形还原全文 → 统计每个词
   b. 计算已知词覆盖率：known_tokens / total_tokens
      - < 98% → 把超纲新词列出，要求模型替换后重生成
   c. 检查每个 target_word 复现次数是否落在 2–3
      - 不达标 → 反馈具体缺漏，要求改写

5. 回填
   写 chapter；更新 synopsis（追加本章剧情摘要）；
   更新 user_word：target_words 的 exposures += 实际次数，
   跑 FSRS 重排 due_at（见 §5）
```

### 4.3 生成 Prompt 骨架

```
你是一名英语分级阅读作者。请写一节连载故事正文。

【故事背景】{story.synopsis}
【上一节梗概】{prev_summary}
【难度】所有词必须落在以下"允许词表"内，
        允许词表 = 四级核心词（附表）+ 这些目标词：{target_words}
【目标词要求】下列每个词必须在本节自然出现 2–3 次，语境各不相同：
        {target_words}
【硬约束】
- 约 300 词；句子平均不超过 12 词。
- 除目标词外，不得使用允许词表以外的词。如必须用，选更简单的同义表达。
- 结尾留一个悬念钩子，让读者想看下一节。
- 只输出正文，不要解释、不要标题。
```

> 注意：模型不会 100% 遵守覆盖率，所以 **§4.2 第 4 步的程序化校验是必须的**，不能省。把校验当成生成管线的一部分，失败自动重试（建议上限 2 次，仍不达标降级用通用版）。

**实现现状**（`lib/generate.ts`）：`callLLM` 经 OpenRouter（baseURL `https://openrouter.ai/api/v1`，OpenAI 兼容）调用 `OPENROUTER_MODEL`；`generateChapter` 跑「生成→`checkCoverage`校验→把缺漏整理成中文反馈→重试」循环，上限 3 次（首次 + 2 重试）。允许词表由 `lib/vocab.ts` 的 `loadCet4Lemmas()` 提供（MVP=四级词；个性化版后续改为用户 `state=2` 的 lemma 集合）。
> 首篇实测：覆盖率 98–99%、5 个目标词均复现 2–3 次、约 300 词，第 1 次失败→带准确反馈第 2 次通过。

### 4.4 个性化 vs 通用版的取舍（重要的成本决策）

- **MVP / 低活跃期**：只生成 1 个**通用版**章节（`chapter.user_id = NULL`），所有人读同一篇，目标词取"该等级的群体最优集合"。成本极低（每天 1 次调用）。
- **验证成立后**：对高活跃用户切换为**个性化版**（`user_id` 非空，目标词来自其个人 `due_at`）。可在 Cron 里批量预生成，错峰调用 API 压低成本。

先跑通用版验证内容质量，个性化是第二阶段的"加深护城河"动作，不要一开始就上。

---

## 5. 复现引擎（SRS：把"复习"藏进"读故事"）

这是和薄荷/流利阅读最本质的差异——用户从不打开生词卡，复习发生在"继续读时又遇到了这个词"。

- 采用 **FSRS** 算法（比传统 SM-2 更准，开源实现多）。
- 每个 `user_word` 维护 `stability / difficulty / due_at`。
- 调度逻辑：
  - 用户**点了某词**（不认识）→ 视为 again，stability 降，due_at 拉近（很快在后续章节再现）。
  - 用户**读完整章未点某目标词** → 视为 good/隐式正确，stability 升，due_at 推远。
  - 每日生成选目标词时，**优先选 `due_at <= today` 的词**作为本章复现对象——于是"到期该复习的词"恰好被编进今天的新章节。
- `exposures` 达到阈值（如 7–12）且连续多次未被点 → `state` 置 2（已习得），退出复现池。

```
点词(不认识) ──▶ FSRS: again ──▶ due_at 拉近 ──▶ 明天章节强制复现
读完没点     ──▶ FSRS: good  ──▶ due_at 推远 ──▶ 隔几天再自然出现
exposures≥阈值且稳定 ──▶ state=2 已习得，移出复现池
```

---

## 6. API 设计（Pages Functions）

| 路径 | 方法 | 作用 |
|---|---|---|
| `/api/today` | GET | 返回当前用户当日章节（个性化版优先，无则通用版） |
| `/api/lookup` | POST | 入参 `{word}`：还原→查 `word` 表→返回释义；同时把该词在该用户的 `user_word` 标记为"学习中/不认识"，触发 FSRS again |
| `/api/finish` | POST | 入参 `{chapter_id}`：标记读完，对本章未被点的目标词触发 FSRS good |
| `/api/notebook` | GET | 返回用户生词本（state=1 的词 + 出处章节） |
| `/api/generate` | POST | **内部接口**，仅 Cron 调用，跑 §4 管线 |

鉴权统一走 Supabase Auth 的 JWT；`/api/generate` 用独立密钥保护，不对外暴露。

---

## 7. 定时任务（Cron Triggers）

```
# wrangler.toml
[triggers]
crons = ["0 0 * * *"]   # UTC 00:00 = 北京时间 08:00
```

每日任务流程：
1. 遍历进行中的故事线，确定下一节 `seq`。
2. 生成通用版章节（MVP 阶段）；若已开个性化，批量为活跃用户生成。
3. 设置 `publish_at = 当日 08:00`，校验通过后落库。
4.（第二期）触发公众号/邮件推送。

建议生成放在更早时间（如北京时间 06:00 生成、08:00 发布），给校验重试和人工抽查留缓冲。

---

## 8. 目录结构（建议）

```
english-daily/
├─ app/                      # Next.js App Router
│  ├─ page.tsx               # 今日章节阅读页
│  ├─ notebook/page.tsx      # 生词本
│  └─ api/
│     ├─ today/route.ts
│     ├─ lookup/route.ts
│     ├─ finish/route.ts
│     ├─ notebook/route.ts
│     └─ generate/route.ts   # 内部
├─ lib/
│  ├─ supabase.ts            # 客户端(publishable)/服务端(secret) client
│  ├─ lemmatize.ts           # 词形还原（核心，含专名救回/原形兜底）
│  ├─ coverage.ts            # 覆盖率/复现次数校验
│  ├─ vocab.ts               # 允许词表加载（loadCet4Lemmas）
│  ├─ fsrs.ts                # SRS 调度
│  └─ generate.ts            # LLM 生成管线（OpenRouter + prompt + 校验重试）
├─ data/
│  └─ cet4.json              # 四级词表 4530 词，含 zh_gloss（来源 mahavivo/english-wordlists）
├─ scripts/
│  ├─ build-cet4.ts          # 从原始 txt 解析生成 cet4.json
│  ├─ import-cet4.ts         # 把 cet4.json 灌入 word 表（npm run import:cet4）
│  └─ generate-chapter.ts    # 端到端生成第一章并校验/落库（--save）
├─ workers/
│  └─ cron.ts                # 每日生成与发布
├─ db/
│  └─ schema.sql             # §3 建表语句
├─ .env.local.example        # 环境变量模板（见 §12）
├─ wrangler.toml
└─ next.config.js
```

---

## 9. 分阶段落地清单

**第 0 周 · 内容验证（不写正式代码）**
- [ ] 手动用模型生成 3–5 章，人工读，确认难度与故事节奏对路
- [ ] 在小红书/公众号发出去，看真实阅读完成率和催更反馈

**第 1–2 周 · MVP（通用版）**
- [ ] 建库（§3 schema），导入四级词表
- [ ] 实现 `lemmatize` + `coverage` 校验（先把这两个做扎实）
- [ ] 实现 `generate` 管线（生成 + 校验 + 重试）
- [ ] 阅读页 + 点词查词 + 生词本
- [ ] Cron 每日生成通用版章节
- [ ] 接入 Supabase Auth 登录
- [ ] 上线，公众号图文同步分发

**第 3–4 周 · 留存与复现**
- [ ] 接入 FSRS，打通"点词→拉近 due_at→次日复现"闭环
- [ ] `finish` 接口 + 隐式熟悉度提升
- [ ] 数据看板：完成率、次日留存、人均接触词数

**第二阶段 · 加深护城河**
- [ ] 高活跃用户切个性化生成（按个人 due_at 选目标词）
- [ ] TTS 听读同步
- [ ] 多故事线 / 多等级
- [ ] 付费墙（连载存档 + 复现引擎 + 多故事线）

---

## 10. 风险与对策（代码相关）

| 风险 | 对策 |
|---|---|
| 模型不遵守覆盖率约束 | §4.2 程序化校验 + 自动重试，绝不信模型自报 |
| 词形还原不准导致画像污染 | 用成熟 lemmatizer + POS；专名/数字过滤；上线后抽样人工核对 |
| 个性化生成 API 成本失控 | MVP 只做通用版；个性化仅对高活跃用户开，批量错峰预生成 |
| 公版改写仍触版权 | 只用原文进入 public domain 的作品；保留情节即演绎作品，注意改写而非"换语言搬运" |
| 被通用大模型替代 | 防御不在生成本身，在累积的个人词汇画像数据 → 词表追踪从第一天做对 |

---

## 11. 落地决策记录（与实际开发对齐）

开发过程中明确/微调的具体决策，作为本文档蓝图的补充：

| 项 | 决策 | 说明 |
|---|---|---|
| Supabase 项目 | 新建 `english-daily`，区域新加坡 `ap-southeast-1` | 旧项目已 paused>90 天无法恢复，弃用重建 |
| Supabase 密钥 | 用**新版** Publishable / Secret key（非 legacy anon/service_role） | 新建项目默认开 automatic RLS |
| LLM 网关 | OpenRouter（OpenAI 兼容），模型走 env 可配 | 一个 key 切多模型，低频生成场景中转开销可忽略；订阅套餐无法程序化调用，必须用 API key |
| 词形还原库 | wink-pos-tagger + wink-lemmatizer | 见 §3.3，已修两处还原 bug |
| 四级词表 | 4530 词，开源 mahavivo/english-wordlists，自带中文释义灌入 `word.zh_gloss` | `data/cet4.json` |
| RLS | 五表均启用，策略见 `db/schema.sql` | 服务端用 secret key 绕过 RLS 做生成/灌库 |

**待优化（已知、不阻塞）**：覆盖率统计中 `an` 未归并到 `a`、比较级副词 `faster/earlier` 未还原，会被误判超纲。当前覆盖率仍 98%+，后续加停用词/比较级处理即可。

## 12. 环境变量（`.env.local`）

| 变量 | 用途 | 敏感级 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | 公开 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 前端 client（受 RLS 约束） | 公开 |
| `SUPABASE_SECRET_KEY` | 服务端 client（绕过 RLS） | **高敏感**，仅服务端 |
| `OPENROUTER_API_KEY` | 调模型生成 | 高敏感，仅服务端 |
| `OPENROUTER_MODEL` | 模型名，默认 `anthropic/claude-opus-4-8` | 公开 |
| `GENERATE_SECRET` | 保护内部 `/api/generate`，与 Cron 对暗号（自定义随机串） | 高敏感 |

> 进度清单见 `doc/english-daily-todo.md`。

---

*本方案为 0→1 验证期蓝图。技术栈、数据模型、生成与复现逻辑可直接据此开工；备案/迁移属部署侧，另行处理。*
