'use client';

import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserClient } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

async function ensureProfile(session: Session | null) {
  const token = session?.access_token;
  if (!token) {
    return;
  }

  await fetch('/api/profile', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
}

export function LoginClient() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [mode, setMode] = useState<Mode>('signin');
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('登录后点词会写入你的生词本。');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) {
        return;
      }

      setSession(data.session);
      await ensureProfile(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await ensureProfile(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(mode === 'signin' ? '正在登录...' : '正在创建账号...');

    try {
      const result =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      setSession(result.data.session);
      await ensureProfile(result.data.session);

      if (result.data.session) {
        setMessage('已登录，可以回到今日阅读点词。');
      } else {
        setMessage('账号已创建，请按 Supabase 邮件设置完成确认后再登录。');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
    setMessage('已退出登录。');
  }

  return (
    <section
      style={{
        marginTop: 28,
        padding: 26,
        background: '#211a23',
        border: '1px solid #3a3038',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.24)',
      }}
    >
      {session ? (
        <div>
          <p style={{ marginTop: 0, color: '#d8cabe' }}>当前账号：{session.user.email}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/today" style={linkButtonStyle}>
              回到今日阅读
            </a>
            <button type="button" onClick={() => void handleSignOut()} style={buttonStyle}>
              退出登录
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button
              type="button"
              onClick={() => setMode('signin')}
              style={mode === 'signin' ? activeTabStyle : tabStyle}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              style={mode === 'signup' ? activeTabStyle : tabStyle}
            >
              注册
            </button>
          </div>

          <label style={labelStyle}>
            邮箱
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={inputStyle}
              autoComplete="email"
            />
          </label>
          <label style={labelStyle}>
            密码
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={inputStyle}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>

          <button type="submit" disabled={submitting} style={buttonStyle}>
            {submitting ? '处理中...' : mode === 'signin' ? '登录' : '注册'}
          </button>
        </form>
      )}

      <p style={{ margin: '18px 0 0', color: '#b9aaa0', fontSize: 14 }}>{message}</p>
    </section>
  );
}

const labelStyle = {
  display: 'grid',
  gap: 6,
  color: '#d8cabe',
  fontSize: 14,
  marginBottom: 14,
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #4a3f48',
  borderRadius: 8,
  padding: '10px 12px',
  font: 'inherit',
  color: '#f7efe4',
  background: '#151117',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #f6c453',
  borderRadius: 8,
  background: '#f6c453',
  color: '#1a1416',
  cursor: 'pointer',
  padding: '10px 14px',
  font: 'inherit',
} satisfies React.CSSProperties;

const linkButtonStyle = {
  ...buttonStyle,
  display: 'inline-block',
  textDecoration: 'none',
} satisfies React.CSSProperties;

const tabStyle = {
  border: '1px solid #4a3f48',
  borderRadius: 8,
  background: '#151117',
  color: '#d8cabe',
  cursor: 'pointer',
  padding: '8px 12px',
  font: 'inherit',
} satisfies React.CSSProperties;

const activeTabStyle = {
  ...tabStyle,
  borderColor: '#64d2c8',
  color: '#64d2c8',
} satisfies React.CSSProperties;
