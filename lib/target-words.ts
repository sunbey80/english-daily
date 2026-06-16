/**
 * 目标词自动选取（生成管线 / 每日定时用）。
 *
 * 策略：让 LLM 根据故事背景与上一节，提议「四级之上、能自然融入下一节场景」的新词，
 * 再程序化校验：① 确实在四级之上（不在 cet4 词表）② 未教过（不在 word 表 in_cet4=false 行）。
 * 比从词频表里机械取词更贴合故事（高频词多为新闻/商业词，clash 故事调性）。
 *
 * 仅服务端/脚本使用（依赖 OpenRouter + service client）。
 */
import OpenAI from 'openai';

import { loadCet4Lemmas } from './vocab';
import { createServiceClient } from './supabase';

const MODEL = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6';

function client() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');
  return new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
}

/** word 表中 in_cet4=false 的词，即已教过的目标词。 */
async function taughtLemmas(): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('word').select('lemma').eq('in_cet4', false);
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r.lemma as string).toLowerCase()));
}

function extractArray(text: string): string[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1)) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function propose(count: number, synopsis: string, prevSummary: string, taught: string[]): Promise<string[]> {
  const prompt = `你在为一个连载英语分级故事挑选"本章要教的新词"。
【故事背景】${synopsis}
【上一节梗概】${prevSummary}
请提议 ${count} 个英语单词，要求：
- 难度在大学英语四级**之上**（不是四级常见词）；
- 能自然融入这个故事下一节的场景，偏具体可感的名词/动词/形容词，利于叙事；
- 不要这些已教过的词：${taught.join(', ') || '（暂无）'}。
只输出一个 JSON 数组，元素为小写英文单词，不要任何其它文字。`;

  const res = await client().chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  return extractArray(res.choices[0]?.message?.content ?? '');
}

export interface SelectContext {
  synopsis: string;
  prevSummary: string;
}

/**
 * 选 count 个合格目标词（四级之上 + 未教过）。LLM 提议 → 校验 → 不足则再提议一次。
 */
export async function selectTargetWords(count: number, ctx: SelectContext): Promise<string[]> {
  const cet4 = loadCet4Lemmas();
  const taught = await taughtLemmas();
  const taughtList = [...taught];

  const isValid = (w: string) =>
    /^[a-z]+$/.test(w) && w.length >= 4 && !cet4.has(w) && !taught.has(w);

  const picks = new Set<string>();
  for (let attempt = 0; attempt < 2 && picks.size < count; attempt++) {
    const proposed = await propose(count + 4, ctx.synopsis, ctx.prevSummary, taughtList);
    for (const w of proposed) {
      const lw = w.toLowerCase();
      if (isValid(lw) && !picks.has(lw)) {
        picks.add(lw);
        if (picks.size >= count) break;
      }
    }
  }
  return [...picks].slice(0, count);
}
