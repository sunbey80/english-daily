/**
 * 查词兜底：库里没有的词，用 LLM 现生成「中文释义 + 美式音标」。
 * 结果由调用方写入 word 表缓存，下次直接命中。
 * 经 OpenRouter（直接 fetch，不引 SDK，保持 Worker 轻量）。仅服务端使用。
 */
const MODEL = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6';

export interface WordDefinition {
  zh_gloss: string;
  phonetic_us: string | null;
}

export async function defineWord(word: string): Promise<WordDefinition | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const w = word.toLowerCase().trim();
  if (!apiKey || !/^[a-z]+(?:-[a-z]+)*$/.test(w)) {
    return null;
  }

  const prompt = `给英文单词 "${w}" 输出：
- zh_gloss：简洁中文释义，格式"词性缩写 + 释义"（如 "v. 弯曲；使弯曲"）。若是某词的不规则变位/变形，按其含义释义并可注明原形。
- phonetic_us：美式音标，词典常规写法，用一对斜线包裹（如 /bent/）；用 r 不用 ɹ，DRESS 元音用 e 不用 ɛ。
只输出合法 JSON：{"zh_gloss":"...","phonetic_us":"/.../"}，不要任何其它文字或代码围栏。`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return null;
    }
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const gloss = typeof obj.zh_gloss === 'string' ? obj.zh_gloss.trim() : '';
    if (!gloss) {
      return null;
    }
    let phonetic = typeof obj.phonetic_us === 'string' ? obj.phonetic_us.trim() : '';
    phonetic = phonetic.replace(/ɹ/g, 'r').replace(/ɛ/g, 'e'); // 兜底归一
    return { zh_gloss: gloss, phonetic_us: phonetic || null };
  } catch {
    return null;
  }
}
