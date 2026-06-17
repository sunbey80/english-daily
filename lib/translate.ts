/**
 * 章节中文翻译 + 目标词释义生成（生成管线落库前调用，结果存数据库）。
 * 经 OpenRouter（OpenAI 兼容）调用 LLM。仅服务端/脚本使用。
 */
import OpenAI from 'openai';

export interface TranslationUnit {
  en: string;
  zh: string;
  paragraph: number;
}

function client() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');
  return new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
}

const MODEL = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6';

function extractJson(text: string, open: '[' | '{'): string {
  const close = open === '[' ? ']' : '}';
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`LLM 返回无法解析为 JSON：${text.slice(0, 120)}`);
  }
  return text.slice(start, end + 1);
}

/** 调 LLM 并解析 JSON；解析失败自动重试一次（LLM 偶尔吐非法 JSON）。 */
async function chatJson<T>(prompt: string, open: '[' | '{', temperature: number): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
    });
    const text = res.choices[0]?.message?.content ?? '';
    try {
      return JSON.parse(extractJson(text, open)) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('chatJson 解析失败');
}

/**
 * 把整章英文正文做"逐句"中英对照，返回 TranslationUnit[]。
 * 段落以空行分隔，paragraph 从 0 递增；便条行（*...— R*）整条作为一句。
 */
export async function translateChapter(body: string): Promise<TranslationUnit[]> {
  const prompt = `把下面的英文连载小说章节做"逐句"中英对照，用于分级阅读。要求：
- 按空行分段，paragraph 从 0 开始编号，每多一个段落 +1。
- 每个句子单独一条；保留英文原句与标点。
- 便条行（以 * 包裹、通常以 — R 署名）整条作为一句：en 保留两侧星号，zh 用中文引号「“」「”」包裹、署名写作"——R"。
- zh 为自然流畅的简体中文，贴合语气，不要逐字硬译。
- 中文里一律用中文标点（，。；：？！“”），不要在字符串里出现未转义的英文半角双引号。
- 只输出**合法 JSON 数组**，每项形如 {"paragraph": 0, "en": "...", "zh": "..."}，不要任何额外文字、注释或代码围栏。

章节正文：
${body}`;

  const parsed = await chatJson<unknown>(prompt, '[', 0.2);
  if (!Array.isArray(parsed)) throw new Error('翻译结果不是数组');
  return parsed
    .filter(
      (u): u is TranslationUnit =>
        u != null &&
        typeof u === 'object' &&
        typeof (u as TranslationUnit).en === 'string' &&
        typeof (u as TranslationUnit).zh === 'string' &&
        typeof (u as TranslationUnit).paragraph === 'number',
    )
    .map((u) => ({ en: u.en, zh: u.zh, paragraph: u.paragraph }));
}

/**
 * 为目标词生成简洁中文释义（词典风格：词性缩写 + 释义）。
 * 返回 { lemma: zh_gloss }。
 */
export async function glossWords(words: string[]): Promise<Record<string, string>> {
  if (words.length === 0) return {};
  const prompt = `给下面英文单词各写一条简洁的中文词典释义，格式为"词性缩写 + 释义"，例如 adj. 布满灰尘的、n./v. 闪烁；摇曳、n. 阁楼。
释义里用中文标点，不要出现未转义的英文半角双引号。
只输出**合法 JSON 对象**，键为单词、值为释义，不要任何额外文字或代码围栏。
单词：${words.join(', ')}`;

  const obj = await chatJson<Record<string, unknown>>(prompt, '{', 0.2);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k.toLowerCase()] = v;
  }
  return out;
}

/**
 * 为单词生成美式音标（IPA，词典常规写法）。返回 { lemma: '/.../'}。
 * 例：tarnished → /ˈtɑːrnɪʃt/（用 r 不用 ɹ，长音用 ː，前后加斜线）。
 */
export async function phoneticizeWords(words: string[]): Promise<Record<string, string>> {
  if (words.length === 0) return {};
  const prompt = `给下面英文单词各写一个**美式音标**（American English IPA），要求：
- 采用词典常规写法（如朗文/韦氏美音风格），形如 /ˈtɑːrnɪʃt/、/ˈmɜːrmər/、/ˈskrɪbəl/；
- 用 r 表示卷舌音（不要用 ɹ），长元音保留长音符 ː；
- 整个音标用一对斜线 / / 包裹。
只输出**合法 JSON 对象**，键为单词、值为音标字符串，不要任何额外文字或代码围栏。
单词：${words.join(', ')}`;

  const obj = await chatJson<Record<string, unknown>>(prompt, '{', 0.2);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.trim()) out[k.toLowerCase()] = v.trim();
  }
  return out;
}
