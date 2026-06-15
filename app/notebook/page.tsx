/**
 * 生词本页。当前通过 /api/notebook 读取学习中的词；
 * 登录功能接入前，未登录用户会看到空态。
 */
import { NotebookClient } from '@/app/notebook/NotebookClient';

export default function NotebookPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '52px 20px 80px' }}>
      <p style={{ color: '#64d2c8', margin: '0 0 8px', fontSize: 14 }}>Notebook</p>
      <h1 style={{ fontSize: 32, margin: 0 }}>生词本</h1>
      <p style={{ color: '#b9aaa0', marginTop: 10 }}>你确认加入的词，会在这里继续复现。</p>
      <NotebookClient />
    </main>
  );
}
