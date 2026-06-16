'use client';

import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserClient } from '@/lib/supabase';

const NAV_ITEMS: { href: string; label: string; isActive: (p: string) => boolean }[] = [
  { href: '/today', label: '今日', isActive: (p) => p === '/today' },
  { href: '/chapters', label: '篇章', isActive: (p) => p === '/chapters' || p.startsWith('/chapters/') },
  { href: '/notebook', label: '生词本', isActive: (p) => p === '/notebook' },
];

export function AuthNav() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const pathname = usePathname();

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
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{
                textDecoration: 'none',
                padding: '7px 11px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                background: active ? '#33292f' : 'transparent',
                color: active ? '#f7efe4' : '#9b8d83',
                fontWeight: active ? 600 : 400,
              }}
            >
              {item.label}
            </Link>
          );
        })}
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
