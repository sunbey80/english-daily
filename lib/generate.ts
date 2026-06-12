/**
 * 生成管线（§4）——产品核心价值。
 *
 *   选目标词 → 取上下文 → 调用 LLM 生成 → 程序化校验 → 失败重试 → 回填
 *
 * 校验（§4.2 第 4 步）绝不省：覆盖率 ≥ 98% + 每个目标词复现 2–3 次。
 * 重试上限 2 次，仍不达标则降级（返回 ok=false，由调用方决定用通用版/跳过）。
 *
 * 当前 LLM 调用为 mock。接 OpenRouter 时替换 callLLM 即可（baseURL 指向
 * https://openrouter.ai/api/v1，OpenAI 兼容）。
 */
import OpenAI from 'openai';
import { checkCoverage, type CoverageResult } from './coverage';

export interface GenerateInput {
  storySynopsis: string; // 世界观/人设/已发生剧情
  prevSummary: string; // 上一节梗概
  allowedLemmas: Set<string>; // 允许词表（四级核心词 + 用户已习得词）
  targetWords: string[]; // 本章目标词
}

export interface GenerateResult {
  ok: boolean;
  body: string; // 生成的正文
  attempts: number; // 实际尝试次数
  coverage: CoverageResult; // 最后一次校验结果
}

const MAX_ATTEMPTS = 3; // 首次 + 重试 2 次（§4.3）

/** 生成 Prompt 骨架（§4.3）。 */
export function buildPrompt(input: GenerateInput, feedback?: string): string {
  const targets = input.targetWords.join(', ');
  return [
    '你是一名英语分级阅读作者。请写一节连载故事正文。',
    '',
    `【故事背景】${input.storySynopsis}`,
    `【上一节梗概】${input.prevSummary}`,
    `【难度】所有词必须落在"允许词表"内，允许词表 = 四级核心词 + 这些目标词：${targets}`,
    `【目标词要求】下列每个词必须在本节自然出现 2–3 次，语境各不相同：${targets}`,
    '【硬约束】',
    '- 约 300 词；句子平均不超过 12 词。',
    '- 除目标词外，不得使用允许词表以外的词。如必须用，选更简单的同义表达。',
    '- 结尾留一个悬念钩子，让读者想看下一节。',
    '- 只输出正文，不要解释、不要标题。',
    feedback ? `\n【上一次未达标，请修正】${feedback}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 通过 OpenRouter（OpenAI 兼容）调用大模型生成正文。 */
async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-opus-4-8';
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
  });
  return res.choices[0]?.message?.content ?? '';
}

/** 把校验缺漏整理成给模型的反馈文本（§4.2）。 */
function buildFeedback(cov: CoverageResult): string {
  const parts: string[] = [];
  if (cov.outOfVocab.length) {
    const words = cov.outOfVocab.slice(0, 20).map((w) => w.lemma).join('、');
    parts.push(`这些词超出允许词表，请替换为更简单的表达：${words}`);
  }
  if (cov.targetIssues.length) {
    const issues = cov.targetIssues
      .map((t) => `${t.lemma}(出现${t.count}次，需${t.expected}次)`)
      .join('；');
    parts.push(`这些目标词复现次数不达标：${issues}`);
  }
  return parts.join('。');
}

/**
 * 跑完整生成管线：生成 → 校验 → 重试。返回最终正文与校验结果。
 */
export async function generateChapter(input: GenerateInput): Promise<GenerateResult> {
  let feedback: string | undefined;
  let lastBody = '';
  let lastCov: CoverageResult | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = buildPrompt(input, feedback);
    const body = await callLLM(prompt);
    const cov = checkCoverage(body, input.allowedLemmas, input.targetWords);
    lastBody = body;
    lastCov = cov;

    if (cov.passed) {
      return { ok: true, body, attempts: attempt, coverage: cov };
    }
    feedback = buildFeedback(cov);
  }

  return { ok: false, body: lastBody, attempts: MAX_ATTEMPTS, coverage: lastCov! };
}
