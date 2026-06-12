/**
 * 今日章节阅读页（占位骨架）。
 * 后续接 /api/today 取当日章节，正文按词渲染、支持点词查词（写入 user_word）。
 */
export default function HomePage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>English Daily</h1>
      <p style={{ color: '#78716c', marginTop: 0 }}>每日连载 · 在读故事中自然习得生词</p>

      <section
        style={{
          marginTop: 32,
          padding: 24,
          background: '#fff',
          border: '1px solid #e7e5e4',
          borderRadius: 12,
        }}
      >
        <p style={{ color: '#a8a29e' }}>
          骨架已就位。今日章节将由 <code>/api/today</code> 提供，阅读与点词交互待接入。
        </p>
      </section>
    </main>
  );
}
