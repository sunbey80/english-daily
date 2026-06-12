/**
 * 今日章节阅读页。
 * SSR 直接复用服务端查询 helper，避免 fetch 自己的 API 时依赖部署域名。
 */
import { ReadingClient } from '@/app/ReadingClient';
import { getTodayChapter } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const chapter = await getTodayChapter();

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>English Daily</h1>
      <p style={{ color: '#78716c', marginTop: 0 }}>每日连载 · 在读故事中自然习得生词</p>

      {chapter ? (
        <ReadingClient chapter={chapter} />
      ) : (
        <section
          style={{
            marginTop: 32,
            padding: 24,
            background: '#fff',
            border: '1px solid #e7e5e4',
            borderRadius: 12,
          }}
        >
          <p style={{ color: '#78716c', margin: 0 }}>今日章节还未发布。</p>
        </section>
      )}
    </main>
  );
}
