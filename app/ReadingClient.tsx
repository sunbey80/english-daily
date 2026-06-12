'use client';

import { useMemo, useState } from 'react';

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
  message: string;
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
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus | null>(null);

  async function handleWordClick(word: string) {
    const normalized = word.toLowerCase();
    setSelectedWord(normalized);
    setLookupStatus({ word, message: '查询中...' });

    try {
      const response = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          payload.error === 'word_not_found'
        ) {
          setLookupStatus({ word, message: '词表暂未收录' });
          return;
        }

        setLookupStatus({
          word,
          message: `lookup 请求未完成（${response.status}）`,
        });
        return;
      }

      const gloss =
        payload && typeof payload === 'object' && 'zh_gloss' in payload
          ? String(payload.zh_gloss)
          : '已记录';
      setLookupStatus({ word, message: gloss });
    } catch {
      setLookupStatus({ word, message: 'lookup 请求失败，稍后再试' });
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
          <span style={{ marginLeft: 8 }}>{lookupStatus.message}</span>
        </div>
      ) : null}
    </article>
  );
}
