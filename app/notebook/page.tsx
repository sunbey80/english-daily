/**
 * 生词本页。当前通过 /api/notebook 读取学习中的词；
 * 登录功能接入前，未登录用户会看到空态。
 */
import { NotebookClient } from '@/app/notebook/NotebookClient';

export default function NotebookPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>生词本</h1>
      <p style={{ color: '#78716c', marginTop: 0 }}>你点过的生词会在这里继续复现。</p>
      <NotebookClient />
    </main>
  );
}
