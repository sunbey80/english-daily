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
        maxWidth: 760,
        margin: '0 auto',
        padding: '20px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        alignItems: 'center',
        color: '#b9aaa0',
        fontSize: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 4,
          border: '1px solid #3a3038',
          borderRadius: 999,
          background: '#19141b',
          flexShrink: 0,
        }}
      >
        <a
          href="/today"
          style={{ color: '#f7efe4', textDecoration: 'none', padding: '7px 9px', whiteSpace: 'nowrap' }}
        >
          今日
        </a>
        <a
          href="/chapters"
          style={{ color: '#f7efe4', textDecoration: 'none', padding: '7px 9px', whiteSpace: 'nowrap' }}
        >
          篇章
        </a>
        <a
          href="/notebook"
          style={{ color: '#64d2c8', textDecoration: 'none', padding: '7px 9px', whiteSpace: 'nowrap' }}
        >
          生词本
        </a>
      </div>
      {session ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            title={session.user.email}
            style={{
              color: '#d8cabe',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {session.user.email}
          </span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            style={{
              border: '1px solid #4a3f48',
              borderRadius: 8,
              background: '#211a23',
              color: '#f7efe4',
              cursor: 'pointer',
              padding: '6px 10px',
              font: 'inherit',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            退出
          </button>
        </div>
      ) : (
        <a href="/login" style={{ color: '#f6c453', textDecoration: 'none' }}>
          登录
        </a>
      )}
    </nav>
  );
}
