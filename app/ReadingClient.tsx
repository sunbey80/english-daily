'use client';

import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

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
  phoneticUs: string;
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

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

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
  const paragraphTexts = useMemo(() => chapter.body.split(/\n{2,}/), [chapter.body]);
  const supabase = useMemo(() => createBrowserClient(), []);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== 't' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTypingTarget(event.target) ||
        chapter.translation_units.length === 0
      ) {
        return;
      }

      event.preventDefault();
      setShowTranslation((value) => !value);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapter.translation_units.length]);

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

  function renderClickableText(text: string) {
    return tokenizeBody(text).map((token) => {
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
            color: isSelected ? '#1a1416' : 'inherit',
            cursor: 'pointer',
            font: 'inherit',
            lineHeight: 'inherit',
          }}
        >
          {token.value}
        </button>
      );
    });
  }

  function placePopover(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const popoverWidth = Math.min(360, window.innerWidth - 32);
    const top = Math.min(rect.bottom + 12, window.innerHeight - 220);
    const left = Math.min(Math.max(rect.left, 16), window.innerWidth - popoverWidth - 16);
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
    setLookupStatus({
      word,
      phoneticUs: '',
      gloss: '',
      message: '查询中...',
      canSave: false,
      saved: false,
    });

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
            phoneticUs: '',
            gloss: '',
            message: '词表暂未收录',
            canSave: false,
            saved: false,
          });
          return;
        }

        setLookupStatus({
          word,
          phoneticUs: '',
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
      const phoneticUs =
        payload && typeof payload === 'object' && 'phonetic_us' in payload && payload.phonetic_us
          ? String(payload.phonetic_us)
          : '美式音标待补充';
      const authenticated =
        payload &&
        typeof payload === 'object' &&
        'authenticated' in payload &&
        payload.authenticated === true;
      setLookupStatus({
        word,
        phoneticUs,
        gloss,
        message: authenticated ? '需要的话，可以加入生词本。' : '登录后可加入生词本。',
        canSave: authenticated,
        saved: false,
      });
    } catch {
      setLookupStatus({
        word,
        phoneticUs: '',
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
        padding: 28,
        background: '#211a23',
        border: '1px solid #3a3038',
        borderRadius: 16,
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.26)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'baseline',
          marginBottom: 24,
          color: '#b9aaa0',
          fontSize: 14,
        }}
      >
        <span style={{ color: '#64d2c8' }}>Chapter {chapter.seq}</span>
        <span>ID #{chapter.id}</span>
      </div>

      <div
        style={{
          fontSize: 20,
          lineHeight: 1.85,
          whiteSpace: 'pre-wrap',
          color: '#f7efe4',
        }}
      >
        {showTranslation && chapter.translation_units.length > 0
          ? chapter.translation_units.map((unit, index) => {
              const previous = chapter.translation_units[index - 1];
              const startsParagraph = index === 0 || previous?.paragraph !== unit.paragraph;
              return (
                <div key={`${unit.paragraph}-${index}`} style={{ marginTop: startsParagraph && index > 0 ? 28 : 0 }}>
                  <p style={{ margin: 0 }}>{renderClickableText(unit.en)}</p>
                  <p style={{ margin: '6px 0 14px', color: '#b9aaa0', fontSize: 16, lineHeight: 1.7 }}>
                    {unit.zh}
                  </p>
                </div>
              );
            })
          : paragraphTexts.map((paragraph, index) => (
              <p key={index} style={{ margin: index === 0 ? 0 : '28px 0 0' }}>
                {renderClickableText(paragraph)}
              </p>
            ))}
      </div>

      {lookupStatus && popoverPosition ? (
        <div
          style={{
            position: 'fixed',
            top: popoverPosition.top,
            left: popoverPosition.left,
            zIndex: 20,
            width: 'min(360px, calc(100vw - 32px))',
            padding: '16px',
            borderRadius: 12,
            background: '#2a202b',
            border: '1px solid #f6c453',
            boxShadow: '0 18px 44px rgba(0, 0, 0, 0.36)',
            color: '#d8cabe',
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
              <strong style={{ color: '#f7efe4', fontSize: 18 }}>{lookupStatus.word}</strong>
              {lookupStatus.phoneticUs ? (
                <span style={{ marginLeft: 8, color: '#64d2c8' }}>美 {lookupStatus.phoneticUs}</span>
              ) : null}
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
                color: '#b9aaa0',
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
                border: '1px solid #f6c453',
                borderRadius: 8,
                background: '#f6c453',
                color: '#1a1416',
                cursor: 'pointer',
                padding: '6px 10px',
                font: 'inherit',
              }}
            >
              加入生词本
            </button>
          ) : null}
          {lookupStatus.saved ? (
            <a href="/notebook" style={{ display: 'inline-block', marginTop: 12, color: '#64d2c8' }}>
              查看生词本
            </a>
          ) : null}
        </div>
      ) : null}

      {chapter.translation_units.length > 0 ? (
        <button
          type="button"
          aria-pressed={showTranslation}
          title="按 T 切换中文对照"
          onClick={() => setShowTranslation((value) => !value)}
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 15,
            border: '1px solid #f6c453',
            borderRadius: 999,
            background: showTranslation ? '#f6c453' : '#211a23',
            color: showTranslation ? '#1a1416' : '#f7efe4',
            cursor: 'pointer',
            padding: '11px 16px',
            font: 'inherit',
            fontSize: 14,
            boxShadow: '0 14px 34px rgba(0, 0, 0, 0.34)',
          }}
        >
          {showTranslation ? '隐藏对照' : '中文对照'} · T
        </button>
      ) : null}
    </article>
  );
}
