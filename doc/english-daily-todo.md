# English Daily —— 开发 TODO

> 配合 `english-daily-技术方案.md`。一项一项做，完成打勾。
> 状态：✅ 完成 · 🚧 进行中 · ⬜ 待办

最近更新：2026-06-12

---

## 阶段 0 · 基础设施

- [x] 新建 Supabase 项目（`english-daily`，新加坡区，automatic RLS）
- [x] 写 `db/schema.sql`（五表 + 索引 + RLS 策略），线上执行建表
- [x] 找开源四级词表，解析为 `data/cet4.json`（4530 词，含中文释义）
- [x] `scripts/import-cet4.ts` 灌库，`word` 表 4530 条 `in_cet4=true`

## 阶段 1 · 项目骨架

- [x] Next.js App Router 骨架（`app/` + `package.json` + `tsconfig` + `next.config.js`）
- [x] `wrangler.toml`（Cloudflare Pages + Cron）
- [x] `.gitignore` + `.env.local.example`
- [x] `lib/supabase.ts`（浏览器 publishable / 服务端 secret 两套 client）
- [x] API 路由 stub：today / lookup / finish / notebook / generate
- [x] 阅读页 / 生词本页占位

## 阶段 2 · 核心算法（"第一天做对"）

- [x] `lib/lemmatize.ts` 词形还原（POS + 还原 + 过滤）
- [x] 修 bug：`crooked→crook` 过度还原（原形兜底匹配）
- [x] 修 bug：大写普通词（标牌 `Attic`）被误判专名（rescue 救回）
- [x] `lib/coverage.ts` 覆盖率 + 目标词复现校验
- [x] `lib/vocab.ts` 允许词表加载
- [ ] 精修：`an→a`、比较级副词 `faster/earlier` 等误判（停用词/比较级处理）

## 阶段 3 · 生成管线

- [x] `lib/generate.ts`：prompt 骨架（§4.3）
- [x] 接 OpenRouter（OpenAI 兼容）真实调用
- [x] 「生成→校验→反馈→重试」循环（上限 3 次）
- [x] 端到端实测：第一篇四级文章生成（覆盖率 98%+，目标词全达标）
- [x] `scripts/generate-chapter.ts` 生成并落库（story.id=1, chapter.id=1）
- [ ] 目标词选取逻辑：due 复习词 + state=0 新词合并（§4.2 第 1 步）
- [ ] 回填：更新 `story.synopsis`（追加剧情摘要）
- [ ] `/api/generate` 内部接口接管线（GENERATE_SECRET 保护）

## 阶段 4 · 阅读端（用户能读）

- [x] `/api/today` 返回当日章节（个性化优先，无则通用版）
- [x] 阅读页渲染正文 + 按词分词高亮
- [x] 点词交互 → 调 `/api/lookup`（查 zh_gloss + 标记 user_word）
- [x] 生词本页接 `/api/notebook`

## 阶段 5 · 登录与冷启动

- [x] 接 Supabase Auth 登录
- [ ] 冷启动：选等级 → 批量写 `user_word`（四级及以下 state=2）
- [ ] （可选）15 词自测微调边界

## 阶段 6 · 复现引擎闭环

- [ ] `lib/fsrs.ts` 接入实际调度（当前为简化版，评估替换 ts-fsrs）
- [ ] `/api/lookup` 点词 → FSRS again → 拉近 due_at
- [ ] `/api/finish` 读完未点 → FSRS good → 推远 due_at
- [ ] exposures 达阈值且稳定 → state=2 退出复现池
- [ ] 验证「点词→次日复现」闭环

## 阶段 7 · 定时与发布

- [ ] `workers/cron.ts` 接生成管线，每日通用版预生成
- [ ] publish_at 调度（06:00 生成 / 08:00 发布）
- [ ] （第二期）公众号 / 邮件推送

## 第二阶段 · 加深护城河

- [ ] 高活跃用户切个性化生成（按个人 due_at 选目标词）
- [ ] TTS 听读同步
- [ ] 多故事线 / 多等级
- [ ] 数据看板（完成率、次日留存、人均接触词数）
- [ ] 付费墙
