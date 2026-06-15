'use client';

import type { MouseEvent } from 'react';
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

type PopoverPosition = {
  top: number;
  left: number;
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
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

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

  function placePopover(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const top = Math.min(rect.bottom + 10, window.innerHeight - 180);
    const left = Math.min(Math.max(rect.left, 12), window.innerWidth - 340);
    setPopoverPosition({ top: Math.max(top, 12), left });
  }

  function closeLookup() {
    setSelectedWord(null);
    setLookupStatus(null);
    setPopoverPosition(null);
  }

  async function handleWordClick(word: string, event: MouseEvent<HTMLButtonElement>) {
    placePopover(event);
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
              onClick={(event) => void handleWordClick(token.value, event)}
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

      {lookupStatus && popoverPosition ? (
        <div
          style={{
            position: 'fixed',
            top: popoverPosition.top,
            left: popoverPosition.left,
            zIndex: 20,
            width: 'min(320px, calc(100vw - 24px))',
            padding: '14px',
            borderRadius: 8,
            background: '#fff',
            border: '1px solid #d6d3d1',
            boxShadow: '0 12px 30px rgba(28, 25, 23, 0.14)',
            color: '#57534e',
            fontSize: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div>
              <strong style={{ color: '#292524', fontSize: 18 }}>{lookupStatus.word}</strong>
              {lookupStatus.gloss ? (
                <p style={{ margin: '8px 0 0', lineHeight: 1.6 }}>{lookupStatus.gloss}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="关闭查词结果"
              onClick={closeLookup}
              style={{
                border: 0,
                background: 'transparent',
                color: '#78716c',
                cursor: 'pointer',
                fontSize: 20,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '10px 0 0', lineHeight: 1.6 }}>{lookupStatus.message}</p>
          {lookupStatus.canSave ? (
            <button
              type="button"
              onClick={() => void handleSaveWord()}
              style={{
                marginTop: 12,
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
            <a href="/notebook" style={{ display: 'inline-block', marginTop: 12, color: '#57534e' }}>
              查看生词本
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
