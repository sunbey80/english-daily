'use client';

import { useEffect, useMemo, useState } from 'react';

import { createBrowserClient } from '@/lib/supabase';
import type { NotebookItem } from '@/lib/notebook';

type NotebookResponse =
  | {
      authenticated: boolean;
      items: NotebookItem[];
    }
  | {
      error: string;
    };

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; authenticated: boolean; items: NotebookItem[] }
  | { status: 'error'; message: string };

export function NotebookClient() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [removingWordId, setRemovingWordId] = useState<number | null>(null);

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (data.session?.access_token) {
      headers.authorization = `Bearer ${data.session.access_token}`;
    }
    return headers;
  }

  useEffect(() => {
    let active = true;

    async function loadNotebook() {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/notebook', { headers });
        const payload = (await response.json().catch(() => null)) as NotebookResponse | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload || 'error' in payload) {
          setState({ status: 'error', message: '生词本暂时无法读取' });
          return;
        }

        setState({
          status: 'loaded',
          authenticated: payload.authenticated,
          items: payload.items,
        });
      } catch {
        if (active) {
          setState({ status: 'error', message: '生词本请求失败，稍后再试' });
        }
      }
    }

    void loadNotebook();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleRemove(item: NotebookItem) {
    setRemovingWordId(item.word_id);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/notebook', {
        method: 'DELETE',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ word_id: item.word_id }),
      });

      if (!response.ok) {
        setState({ status: 'error', message: '移除失败，请稍后再试' });
        return;
      }

      setState((current) => {
        if (current.status !== 'loaded') {
          return current;
        }

        return {
          ...current,
          items: current.items.filter((word) => word.word_id !== item.word_id),
        };
      });
    } catch {
      setState({ status: 'error', message: '移除失败，请稍后再试' });
    } finally {
      setRemovingWordId(null);
    }
  }

  if (state.status === 'loading') {
    return <EmptyPanel text="生词本读取中..." />;
  }

  if (state.status === 'error') {
    return <EmptyPanel text={state.message} />;
  }

  if (!state.authenticated) {
    return <EmptyPanel text="当前未登录。登录接入后，这里会展示你点过的生词。" />;
  }

  if (state.items.length === 0) {
    return <EmptyPanel text="还没有学习中的生词。回到今日章节，点一下不认识的词试试。" />;
  }

  return (
    <section style={{ marginTop: 28, display: 'grid', gap: 12 }}>
      {state.items.map((item) => (
        <article
          key={item.word_id}
          style={{
            padding: 18,
            background: '#fff',
            border: '1px solid #e7e5e4',
            borderRadius: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              alignItems: 'baseline',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22 }}>{item.lemma}</h2>
            <button
              type="button"
              onClick={() => void handleRemove(item)}
              disabled={removingWordId === item.word_id}
              style={{
                border: '1px solid #d6d3d1',
                borderRadius: 8,
                background: '#fff',
                color: '#57534e',
                cursor: removingWordId === item.word_id ? 'default' : 'pointer',
                padding: '6px 10px',
                font: 'inherit',
                fontSize: 13,
              }}
            >
              {removingWordId === item.word_id ? '移除中...' : '移除'}
            </button>
          </div>
          <p style={{ margin: '10px 0 0', color: '#57534e', lineHeight: 1.7 }}>
            {item.zh_gloss ?? '暂无中文释义'}
          </p>
          {item.source_chapter ? (
            <p style={{ margin: '12px 0 0', color: '#a8a29e', fontSize: 13 }}>
              来自 Chapter {item.source_chapter.seq}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <section
      style={{
        marginTop: 28,
        padding: 24,
        background: '#fff',
        border: '1px solid #e7e5e4',
        borderRadius: 12,
      }}
    >
      <p style={{ color: '#78716c', margin: 0 }}>{text}</p>
    </section>
  );
}
