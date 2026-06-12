# AGENTS.md —— English Daily 开发约束

> 本文件给参与本仓库编码的 AI agent（Codex 等）。动手前先读。
> 产品蓝图见 `doc/english-daily-技术方案.md`，进度见 `doc/english-daily-todo.md`。

## 红线（改了会出事，务必守住）

1. **词形还原的两处修复不可回退**（`lib/lemmatize.ts` / `lib/coverage.ts`）：
   - `rescue` 救回被误判为专名 NNP 的大写普通词（如标牌 `Attic`）；删了目标词会漏计。
   - `coverage` 中对 token 用 `lemma` + `rawLower` **双重匹配**；删了 `crooked→crook` 这类过度还原又会对不上。
   - 背景见技术方案 §3.3，是实测踩坑修出来的。
2. **覆盖率/复现校验必须保留，98% 阈值不得为"让它通过"而下调**。模型自报不可信（§0、§4.2）。
3. **`SUPABASE_SECRET_KEY` / `OPENROUTER_API_KEY` 仅服务端使用**，绝不进前端 bundle、不进 git。前端只用 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
4. **不擅自改 `db/schema.sql` 或线上表结构**——线上库已有数据（4530 词 + story/chapter）。要改先在 PR/说明里标出，等统筹确认。
5. **省着调生成**：`generateChapter` 每次最多调 3 次模型且花钱。不要在循环/测试里反复跑真实生成；调试用固定文本。

## 约定

- 栈：Next.js App Router + TypeScript（strict）+ Supabase JS + Cloudflare。
- **注释与文档用中文**，与现有代码风格一致。
- 目录严格按技术方案 §8：新增 lib 放 `lib/`，一次性脚本放 `scripts/`。
- 跑脚本带环境变量：`tsx --env-file=.env.local scripts/xxx.ts`（Node 24+）。
- Supabase client 统一用 `lib/supabase.ts`：前端 `createBrowserClient()`、服务端 `createServiceClient()`，不要另起 client。
- 允许词表统一用 `lib/vocab.ts` 的 `loadCet4Lemmas()`。
- 环境变量清单见技术方案 §12 与 `.env.local.example`。

## 完成前必须验证

- `npm run typecheck` 必须通过。
- 改动涉及 lemmatize/coverage：用真实文本验证目标词计数（参考 `scripts/generate-chapter.ts` 不带 `--save` 的预览模式）。
- 完成后在 `doc/english-daily-todo.md` 勾掉对应项。
- 一个任务一个 commit，message 写清动了什么。
- 涉及 schema / 新依赖 / 改校验阈值 / 动 lemmatize 核心 → 先经统筹确认，不要自行决定。

---

## 当前任务（阶段 4 · 阅读端）

边界严格限定在"能读 + 能点"，不做登录、不做 FSRS。

### `app/api/today/route.ts` —— GET /api/today
- 返回当日章节：优先 `chapter.user_id = 当前用户 且 publish_at <= now`；无则取 `user_id is null` 的通用版，按 `seq` 取最新已发布。
- 未登录也要能拿到通用版（MVP 先不强制登录）。
- 返回 `{ id, seq, body, target_words }`。

### `app/page.tsx` —— 阅读页
- SSR 取 `/api/today`，正文**按词分词渲染**（每个词可点击），保留段落/换行。
- 点词触发 `/api/lookup`（本任务先做高亮 + 占位调用即可；lookup 的 DB 逻辑属下一个任务）。

### 验收
- 本地 `npm run dev`，首页渲染出 `chapter.id=1` 的正文，词可点击高亮。
- `npm run typecheck` 通过。
