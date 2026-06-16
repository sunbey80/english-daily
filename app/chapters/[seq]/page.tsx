/**
 * 历史篇章阅读页 /chapters/[seq]。复用 ReadingClient 渲染指定章节。
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ReadingClient } from '@/app/ReadingClient';
import { getChapterBySeq } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function ChapterPage({ params }: { params: Promise<{ seq: string }> }) {
  const { seq } = await params;
  const seqNum = Number(seq);
  if (!Number.isInteger(seqNum) || seqNum < 1) {
    notFound();
  }

  const chapter = await getChapterBySeq(seqNum);
  if (!chapter) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '52px 20px 80px' }}>
      <Link href="/chapters" style={{ color: '#64d2c8', textDecoration: 'none', fontSize: 14 }}>
        ← 全部篇章
      </Link>
      <h1 style={{ fontSize: 30, margin: '12px 0 0' }}>第 {chapter.seq} 章</h1>
      <p style={{ color: '#b9aaa0', marginTop: 8 }}>English Daily · 连载阅读</p>

      <ReadingClient chapter={chapter} />
    </main>
  );
}
