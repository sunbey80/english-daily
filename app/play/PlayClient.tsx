'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createBrowserClient } from '@/lib/supabase';
import type { PlayQuestion } from '@/lib/play';

type SessionResponse =
  | { authenticated: boolean; questions: PlayQuestion[] }
  | { error: string };

type Phase = 'idle' | 'loading' | 'playing' | 'result';

const ROUND_SECONDS = 90;
const BASE_SCORE = 10;
const FEEDBACK_MS = 1100;

const C = {
  panel: '#211a23',
  panelDeep: '#19141b',
  border: '#3a3038',
  text: '#f7efe4',
  muted: '#b9aaa0',
  faint: '#9b8d83',
  teal: '#64d2c8',
  gold: '#f6c453',
  green: '#5fcf80',
  red: '#e8806f',
} as const;

/** 浏览器 TTS 朗读单词（免费、客户端）。 */
function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  } catch {
    /* 忽略不支持的环境 */
  }
}

export function PlayClient() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [phase, setPhase] = useState<Phase>('idle');
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [questions, setQuestions] = useState<PlayQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [feedback, setFeedback] = useState<null | { correct: boolean; answer: string }>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (data.session?.access_token) {
      headers.authorization = `Bearer ${data.session.access_token}`;
    }
    return headers;
  }, [supabase]);

  // 登录态探测（决定 idle 文案）。
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setAuthed(Boolean(data.session));
      }
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  // 倒计时
  useEffect(() => {
    if (phase !== 'playing') {
      return;
    }
    if (secondsLeft <= 0) {
      setPhase('result');
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, secondsLeft]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    };
  }, []);

  async function startGame() {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/play/session', { headers });
      const payload = (await res.json().catch(() => null)) as SessionResponse | null;
      if (!res.ok || !payload || 'error' in payload) {
        setErrorMsg('题目加载失败，稍后再试');
        setPhase('idle');
        return;
      }
      setAuthed(payload.authenticated);
      if (!payload.authenticated) {
        setPhase('idle');
        return;
      }
      if (payload.questions.length === 0) {
        setErrorMsg('暂无可复习的生词。先去阅读里点一些不认识的词吧。');
        setPhase('idle');
        return;
      }
      setQuestions(payload.questions);
      setIndex(0);
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setCorrectCount(0);
      setSecondsLeft(ROUND_SECONDS);
      setFeedback(null);
      setPhase('playing');
    } catch {
      setErrorMsg('网络异常，稍后再试');
      setPhase('idle');
    }
  }

  const current = questions[index];

  const submitAnswer = useCallback(
    async (correct: boolean) => {
      if (!current || feedback) {
        return;
      }

      speak(current.answer);

      let nextCombo = 0;
      if (correct) {
        nextCombo = combo + 1;
        setCombo(nextCombo);
        setMaxCombo((m) => Math.max(m, nextCombo));
        setCorrectCount((c) => c + 1);
        setScore((s) => s + BASE_SCORE + (nextCombo - 1) * 2);
      } else {
        setCombo(0);
      }

      setFeedback({ correct, answer: current.answer });

      // 回写 FSRS（不阻塞 UI）。
      void (async () => {
        try {
          const headers = await getAuthHeaders();
          await fetch('/api/play/answer', {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({ word_id: current.word_id, correct }),
          });
        } catch {
          /* 答题进度回写失败不影响本局体验 */
        }
      })();

      advanceTimer.current = setTimeout(() => {
        setFeedback(null);
        if (index + 1 >= questions.length) {
          setPhase('result');
        } else {
          setIndex((i) => i + 1);
        }
      }, FEEDBACK_MS);
    },
    [current, feedback, combo, getAuthHeaders, index, questions.length],
  );

  // ---------- 渲染 ----------

  if (phase === 'idle') {
    return (
      <Panel>
        {authed === false ? (
          <p style={{ color: C.muted, margin: 0 }}>
            登录后即可开始闯关。<a href="/login" style={{ color: C.gold }}>去登录</a>
          </p>
        ) : (
          <>
            <p style={{ color: C.muted, margin: '0 0 18px', lineHeight: 1.7 }}>
              一局抽 8–12 个到期生词，限时 {ROUND_SECONDS} 秒。情境填空、看中选英、听音抓词
              三种题型混合，连击越高得分越多。
            </p>
            {errorMsg ? (
              <p style={{ color: C.red, margin: '0 0 16px', fontSize: 14 }}>{errorMsg}</p>
            ) : null}
            <PrimaryButton onClick={() => void startGame()}>开始闯关</PrimaryButton>
          </>
        )}
      </Panel>
    );
  }

  if (phase === 'loading') {
    return (
      <Panel>
        <p style={{ color: C.muted, margin: 0 }}>正在组题…</p>
      </Panel>
    );
  }

  if (phase === 'result') {
    const total = questions.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <Panel>
        <p style={{ color: C.teal, margin: '0 0 6px', fontSize: 14 }}>本局结算</p>
        <div style={{ fontSize: 44, fontWeight: 700, color: C.gold, lineHeight: 1.1 }}>{score}</div>
        <div style={{ display: 'flex', gap: 24, marginTop: 18, flexWrap: 'wrap' }}>
          <Stat label="复习词数" value={`${total}`} />
          <Stat label="答对" value={`${correctCount} / ${total}`} />
          <Stat label="正确率" value={`${accuracy}%`} />
          <Stat label="最高连击" value={`${maxCombo}`} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
          <PrimaryButton onClick={() => void startGame()}>再来一局</PrimaryButton>
          <SecondaryLink href="/today">返回阅读</SecondaryLink>
        </div>
      </Panel>
    );
  }

  // playing
  if (!current) {
    return (
      <Panel>
        <p style={{ color: C.muted, margin: 0 }}>没有更多题目了。</p>
      </Panel>
    );
  }

  return (
    <section style={{ marginTop: 28 }}>
      {/* 顶部状态条 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ color: C.faint, fontSize: 14 }}>
          第 {index + 1} / {questions.length} 题
        </span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {combo >= 2 ? (
            <span style={{ color: C.gold, fontSize: 14, fontWeight: 600 }}>连击 ×{combo}</span>
          ) : null}
          <span style={{ color: C.teal, fontSize: 14, fontWeight: 600 }}>得分 {score}</span>
          <span
            style={{
              color: secondsLeft <= 10 ? C.red : C.muted,
              fontSize: 14,
              fontWeight: 600,
              minWidth: 30,
              textAlign: 'right',
            }}
          >
            {secondsLeft}s
          </span>
        </div>
      </div>
      <div style={{ height: 4, background: C.panelDeep, borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${(secondsLeft / ROUND_SECONDS) * 100}%`,
            background: secondsLeft <= 10 ? C.red : C.teal,
            transition: 'width 1s linear',
          }}
        />
      </div>

      <QuestionCard
        key={current.word_id}
        question={current}
        feedback={feedback}
        onAnswer={submitAnswer}
      />
    </section>
  );
}

function QuestionCard({
  question,
  feedback,
  onAnswer,
}: {
  question: PlayQuestion;
  feedback: null | { correct: boolean; answer: string };
  onAnswer: (correct: boolean) => void;
}) {
  const [input, setInput] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  // 听音题：进入时自动朗读一次。
  useEffect(() => {
    if (question.type === 'listen') {
      speak(question.answer);
    }
  }, [question]);

  const locked = Boolean(feedback);

  function handleChoice(option: string) {
    if (locked) {
      return;
    }
    setPicked(option);
    onAnswer(option.toLowerCase() === question.answer);
  }

  function handleClozeSubmit() {
    if (locked) {
      return;
    }
    onAnswer(input.trim().toLowerCase() === question.answer);
  }

  const cardStyle: React.CSSProperties = {
    marginTop: 18,
    padding: 24,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    boxShadow: '0 18px 44px rgba(0, 0, 0, 0.18)',
  };

  return (
    <article style={cardStyle}>
      <TypeTag type={question.type} />

      {question.type === 'cloze' && question.sentence ? (
        <>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7, margin: '14px 0 0' }}>
            {question.sentence.zh}
          </p>
          <p style={{ color: C.text, fontSize: 18, lineHeight: 1.8, margin: '12px 0 0' }}>
            {question.sentence.en}
          </p>
          <p style={{ color: C.faint, fontSize: 13, margin: '10px 0 0' }}>
            首字母提示：<b style={{ color: C.gold }}>{question.hint}</b>
            {question.zh_gloss ? `（${question.zh_gloss}）` : ''}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <input
              autoFocus
              value={input}
              disabled={locked}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleClozeSubmit();
                }
              }}
              placeholder="拼出这个词"
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.panelDeep,
                color: C.text,
                font: 'inherit',
                fontSize: 16,
                outline: 'none',
              }}
            />
            <button type="button" onClick={handleClozeSubmit} disabled={locked} style={primaryBtnStyle(locked)}>
              提交
            </button>
          </div>
        </>
      ) : null}

      {(question.type === 'choice' || question.type === 'listen') && question.options ? (
        <>
          {question.type === 'choice' ? (
            <p style={{ color: C.text, fontSize: 20, fontWeight: 600, margin: '14px 0 0' }}>
              {question.zh_gloss ?? '选出对应的英文词'}
            </p>
          ) : (
            <div style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => speak(question.answer)}
                style={{ ...secondaryBtnStyle, fontSize: 15 }}
              >
                ▶ 再听一遍
              </button>
              <span style={{ color: C.faint, fontSize: 13 }}>听到的是哪个词？</span>
            </div>
          )}
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {question.options.map((opt) => {
              const isAnswer = opt.toLowerCase() === question.answer;
              const isPicked = picked === opt;
              let bg: string = C.panelDeep;
              let borderColor: string = C.border;
              let color: string = C.text;
              if (locked && isAnswer) {
                bg = 'rgba(95, 207, 128, 0.14)';
                borderColor = C.green;
                color = C.green;
              } else if (locked && isPicked && !isAnswer) {
                bg = 'rgba(232, 128, 111, 0.14)';
                borderColor = C.red;
                color = C.red;
              }
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleChoice(opt)}
                  disabled={locked}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: `1px solid ${borderColor}`,
                    background: bg,
                    color,
                    font: 'inherit',
                    fontSize: 17,
                    cursor: locked ? 'default' : 'pointer',
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {feedback ? (
        <div
          style={{
            marginTop: 18,
            padding: '12px 14px',
            borderRadius: 10,
            background: feedback.correct ? 'rgba(95, 207, 128, 0.12)' : 'rgba(232, 128, 111, 0.12)',
            color: feedback.correct ? C.green : C.red,
            fontSize: 15,
          }}
        >
          {feedback.correct ? '答对了！' : '答错了 — '}
          {!feedback.correct ? (
            <span style={{ color: C.text }}>
              正确答案：<b style={{ color: C.gold }}>{question.answer}</b>
              {question.zh_gloss ? `（${question.zh_gloss}）` : ''}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function TypeTag({ type }: { type: PlayQuestion['type'] }) {
  const label = type === 'cloze' ? '情境填空' : type === 'choice' ? '看中选英' : '听音抓词';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        background: C.panelDeep,
        border: `1px solid ${C.border}`,
        color: C.teal,
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: C.faint, fontSize: 13 }}>{label}</div>
      <div style={{ color: C.text, fontSize: 22, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        marginTop: 28,
        padding: 24,
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
      }}
    >
      {children}
    </section>
  );
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    border: 'none',
    borderRadius: 10,
    background: disabled ? '#7a6a3a' : C.gold,
    color: '#1a1410',
    cursor: disabled ? 'default' : 'pointer',
    padding: '12px 20px',
    font: 'inherit',
    fontSize: 16,
    fontWeight: 600,
  };
}

const secondaryBtnStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  background: C.panelDeep,
  color: C.text,
  cursor: 'pointer',
  padding: '10px 16px',
  font: 'inherit',
  fontWeight: 500,
};

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={primaryBtnStyle(false)}>
      {children}
    </button>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ ...secondaryBtnStyle, textDecoration: 'none', display: 'inline-block' }}>
      {children}
    </a>
  );
}
