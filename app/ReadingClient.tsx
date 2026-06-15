'use client';

import { useMemo, useState } from 'react';

import { createBrowserClient } from '@/lib/supabase';
import type { TodayChapter } from '@/lib/today';

type Token =
  | {
      type: 'word';
      value: string;
      normalized: string;
      key: string;
    }
  | {
      type: 'text';
      value: string;
      key: string;
    };

type LookupStatus = {
  word: string;
  gloss: string;
  message: string;
  canSave: boolean;
  saved: boolean;
};

const wordPattern = /[A-Za-z]+(?:['’][A-Za-z]+)?/g;

function tokenizeBody(body: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;

  for (const match of body.matchAll(wordPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({
        type: 'text',
        value: body.slice(lastIndex, index),
        key: `text-${tokenIndex}`,
      });
      tokenIndex += 1;
    }

    const value = match[0];
    tokens.push({
      type: 'word',
      value,
      normalized: value.toLowerCase(),
      key: `word-${tokenIndex}`,
    });
    tokenIndex += 1;
    lastIndex = index + value.length;
  }

  if (lastIndex < body.length) {
    tokens.push({
      type: 'text',
      value: body.slice(lastIndex),
      key: `text-${tokenIndex}`,
    });
  }

  return tokens;
}

export function ReadingClient({ chapter }: { chapter: TodayChapter }) {
  const tokens = useMemo(() => tokenizeBody(chapter.body), [chapter.body]);
  const supabase = useMemo(() => createBrowserClient(), []);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus | null>(null);

  async function requestLookup(word: string, save: boolean) {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (data.session?.access_token) {
      headers.authorization = `Bearer ${data.session.access_token}`;
    }

    return fetch('/api/lookup', {
      method: 'POST',
      headers,
      body: JSON.stringify({ word, save }),
    });
  }

  async function handleWordClick(word: string) {
    const normalized = word.toLowerCase();
    setSelectedWord(normalized);
    setLookupStatus({ word, gloss: '', message: '查询中...', canSave: false, saved: false });

    try {
      const response = await requestLookup(word, false);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          payload.error === 'word_not_found'
        ) {
          setLookupStatus({
            word,
            gloss: '',
            message: '词表暂未收录',
            canSave: false,
            saved: false,
          });
          return;
        }

        setLookupStatus({
          word,
          gloss: '',
          message: `lookup 请求未完成（${response.status}）`,
          canSave: false,
          saved: false,
        });
        return;
      }

      const gloss =
        payload && typeof payload === 'object' && 'zh_gloss' in payload && payload.zh_gloss
          ? String(payload.zh_gloss)
          : '释义待补充';
      const authenticated =
        payload &&
        typeof payload === 'object' &&
        'authenticated' in payload &&
        payload.authenticated === true;
      setLookupStatus({
        word,
        gloss,
        message: authenticated ? '需要的话，可以加入生词本。' : '登录后可加入生词本。',
        canSave: authenticated,
        saved: false,
      });
    } catch {
      setLookupStatus({
        word,
        gloss: '',
        message: 'lookup 请求失败，稍后再试',
        canSave: false,
        saved: false,
      });
    }
  }

  async function handleSaveWord() {
    if (!lookupStatus || lookupStatus.saved) {
      return;
    }

    const current = lookupStatus;
    setLookupStatus({ ...current, message: '正在加入生词本...', canSave: false });

    try {
      const response = await requestLookup(current.word, true);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setLookupStatus({
          ...current,
          message: `加入失败（${response.status}）`,
          canSave: current.canSave,
        });
        return;
      }

      const saved =
        payload && typeof payload === 'object' && 'saved' in payload && payload.saved === true;
      const authenticated =
        payload &&
        typeof payload === 'object' &&
        'authenticated' in payload &&
        payload.authenticated === true;

      setLookupStatus({
        ...current,
        message: saved ? '已加入生词本。' : authenticated ? '加入失败，请稍后再试。' : '登录后可加入生词本。',
        canSave: authenticated && !saved,
        saved,
      });
    } catch {
      setLookupStatus({ ...current, message: '加入失败，请稍后再试。', canSave: current.canSave });
    }
  }

  return (
    <article
      style={{
        marginTop: 32,
        padding: 24,
        background: '#fff',
        border: '1px solid #e7e5e4',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(28, 25, 23, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'baseline',
          marginBottom: 24,
          color: '#78716c',
          fontSize: 14,
        }}
      >
        <span>Chapter {chapter.seq}</span>
        <span>ID #{chapter.id}</span>
      </div>

      <div
        style={{
          fontSize: 20,
          lineHeight: 1.85,
          whiteSpace: 'pre-wrap',
          color: '#292524',
        }}
      >
        {tokens.map((token) => {
          if (token.type === 'text') {
            return <span key={token.key}>{token.value}</span>;
          }

          const isSelected = token.normalized === selectedWord;
          return (
            <button
              key={token.key}
              type="button"
              onClick={() => void handleWordClick(token.value)}
              style={{
                appearance: 'none',
                border: 0,
                borderRadius: 6,
                padding: '1px 2px',
                margin: 0,
                background: isSelected ? '#fde68a' : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                font: 'inherit',
                lineHeight: 'inherit',
              }}
            >
              {token.value}
            </button>
          );
        })}
      </div>

      {lookupStatus ? (
        <div
          style={{
            marginTop: 24,
            padding: '12px 14px',
            borderRadius: 8,
            background: '#f5f5f4',
            color: '#57534e',
            fontSize: 14,
          }}
        >
          <strong style={{ color: '#292524' }}>{lookupStatus.word}</strong>
          {lookupStatus.gloss ? <span style={{ marginLeft: 8 }}>{lookupStatus.gloss}</span> : null}
          <span style={{ marginLeft: 8 }}>{lookupStatus.message}</span>
          {lookupStatus.canSave ? (
            <button
              type="button"
              onClick={() => void handleSaveWord()}
              style={{
                marginLeft: 12,
                border: '1px solid #292524',
                borderRadius: 8,
                background: '#292524',
                color: '#fff',
                cursor: 'pointer',
                padding: '6px 10px',
                font: 'inherit',
              }}
            >
              加入生词本
            </button>
          ) : null}
          {lookupStatus.saved ? (
            <a href="/notebook" style={{ marginLeft: 12, color: '#57534e' }}>
              查看生词本
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
