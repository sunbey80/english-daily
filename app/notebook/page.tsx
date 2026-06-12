/**
 * 生词本页（占位骨架）。后续接 /api/notebook 渲染 state=1 的词与出处。
 */
export default function NotebookPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontSize: 24 }}>生词本</h1>
      <p style={{ color: '#a8a29e' }}>
        待接入 <code>/api/notebook</code>：展示学习中的词及其出处章节。
      </p>
    </main>
  );
}
