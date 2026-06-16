/**
 * 今日阅读页（最新已发布章节）。从落地页 / 导航进入。
 */
import { ReadingClient } from '@/app/ReadingClient';
import { getTodayChapter } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const chapter = await getTodayChapter();

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '52px 20px 80px' }}>
      <p style={{ color: '#64d2c8', margin: '0 0 8px', fontSize: 14 }}>Today · 今日阅读</p>
      <h1 style={{ fontSize: 34, margin: 0, letterSpacing: 0 }}>English Daily</h1>
      <p style={{ color: '#b9aaa0', marginTop: 10 }}>每日连载 · 在读故事中自然习得生词</p>

      {chapter ? (
        <ReadingClient chapter={chapter} />
      ) : (
        <section
          style={{
            marginTop: 32,
            padding: 24,
            background: '#211a23',
            border: '1px solid #3a3038',
            borderRadius: 12,
          }}
        >
          <p style={{ color: '#b9aaa0', margin: 0 }}>今日章节还未发布。</p>
        </section>
      )}
    </main>
  );
}
