'use client';

import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserClient } from '@/lib/supabase';

export function AuthNav() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  return (
    <nav
      style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: '18px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        alignItems: 'center',
        color: '#78716c',
        fontSize: 14,
      }}
    >
      <div style={{ display: 'flex', gap: 14 }}>
        <a href="/" style={{ color: '#57534e', textDecoration: 'none' }}>
          今日阅读
        </a>
        <a href="/notebook" style={{ color: '#57534e', textDecoration: 'none' }}>
          生词本
        </a>
      </div>
      {session ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{session.user.email}</span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            style={{
              border: '1px solid #d6d3d1',
              borderRadius: 8,
              background: '#fff',
              color: '#57534e',
              cursor: 'pointer',
              padding: '6px 10px',
              font: 'inherit',
            }}
          >
            退出
          </button>
        </div>
      ) : (
        <a href="/login" style={{ color: '#57534e', textDecoration: 'none' }}>
          登录
        </a>
      )}
    </nav>
  );
}
