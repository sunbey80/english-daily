/**
 * 生词闯关入口页（需登录）。题目由 /api/play/session 下发，
 * 答题回写 /api/play/answer（FSRS），与阅读共用同一份词汇画像。
 */
import { PlayClient } from '@/app/play/PlayClient';

export default function PlayPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '52px 20px 80px' }}>
      <p style={{ color: '#64d2c8', margin: '0 0 8px', fontSize: 14 }}>Play</p>
      <h1 style={{ fontSize: 32, margin: 0 }}>生词闯关</h1>
      <p style={{ color: '#b9aaa0', marginTop: 10 }}>
        把生词本里的词放进限时小游戏，反复接触、主动回忆。答题会同步到你的复习进度。
      </p>
      <PlayClient />
    </main>
  );
}
