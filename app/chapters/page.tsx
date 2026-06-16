/**
 * 全部篇章列表。按 seq 倒序展示已发布章节，点进去读历史章节。
 */
import Link from 'next/link';

import { getPublishedChapters } from '@/lib/today';

export const dynamic = 'force-dynamic';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function ChaptersPage() {
  const chapters = await getPublishedChapters();

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '52px 20px 80px' }}>
      <p style={{ color: '#64d2c8', margin: '0 0 8px', fontSize: 14 }}>Library · 全部篇章</p>
      <h1 style={{ fontSize: 32, margin: 0 }}>全部篇章</h1>
      <p style={{ color: '#b9aaa0', marginTop: 10 }}>共 {chapters.length} 章 · 点任意一章开始阅读</p>

      {chapters.length === 0 ? (
        <p style={{ color: '#b9aaa0', marginTop: 32 }}>还没有已发布的章节。</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'grid', gap: 12 }}>
          {chapters.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chapters/${c.seq}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: '#19141b',
                  border: '1px solid #3a3038',
                  borderRadius: 12,
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ color: '#f6c453', fontWeight: 600 }}>第 {c.seq} 章</span>
                  <span style={{ color: '#7d6f66', fontSize: 13 }}>{formatDate(c.publish_at)}</span>
                </div>
                <p style={{ color: '#c9bbb0', margin: '8px 0 0', fontSize: 15, lineHeight: 1.6 }}>{c.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
