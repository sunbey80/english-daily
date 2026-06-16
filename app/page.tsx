/**
 * 营销落地页。讲清价值主张与卖点，提供进入今日阅读 / 全部篇章 / 生词本的入口。
 */
import Link from 'next/link';

export const metadata = {
  title: 'English Daily — 每日连载式分级英语阅读',
  description: '每天一篇分级英语连载，在读故事中自然习得生词。i+1 难度控制、生词自动复现、逐句中文对照、点词即查。',
};

const FEATURES = [
  {
    icon: '📖',
    title: '每日连载，读故事学英语',
    desc: '一条持续推进的故事线，每天一章。你追着剧情读，生词在情节里自然遇到，不用背单词卡。',
  },
  {
    icon: '🎯',
    title: 'i+1 难度控制',
    desc: '每篇约 98% 是你已掌握的词 + 少量新词。读起来无痛理解，又能稳稳带着你往上走。',
  },
  {
    icon: '🔁',
    title: '生词自动复现',
    desc: '你点过的生词，会在后续章节里再次出现。复习藏进继续读故事里，遗忘前刚好再见一面。',
  },
  {
    icon: '🇨🇳',
    title: '逐句中文对照 + 点词即查',
    desc: '不确定就点词，立刻看到释义与美式音标；需要时一键开逐句中文对照，读得踏实。',
  },
];

const linkBase = {
  display: 'inline-block',
  textDecoration: 'none',
  borderRadius: 10,
  padding: '13px 22px',
  fontSize: 16,
  fontWeight: 600,
} as const;

export default function LandingPage() {
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px 96px' }}>
      {/* Hero */}
      <section style={{ paddingTop: 28, textAlign: 'center' }}>
        <p style={{ color: '#64d2c8', margin: '0 0 14px', fontSize: 14, letterSpacing: 1 }}>
          每日连载式分级英语阅读
        </p>
        <h1 style={{ fontSize: 42, lineHeight: 1.15, margin: 0 }}>
          在读故事的过程中,
          <br />
          自然练好英语
        </h1>
        <p
          style={{
            color: '#b9aaa0',
            fontSize: 17,
            lineHeight: 1.7,
            maxWidth: 560,
            margin: '20px auto 0',
          }}
        >
          每天一篇分级英语连载小说。难度刚好贴着你的水平,生词在情节里自然遇到、
          在后续章节自动复现——把"阅读"和"复习"合并成同一件愉快的事。
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 30 }}>
          <Link href="/today" style={{ ...linkBase, background: '#f6c453', color: '#241a07' }}>
            开始今日阅读 →
          </Link>
          <Link
            href="/chapters"
            style={{ ...linkBase, background: '#211a23', color: '#f7efe4', border: '1px solid #4a3f48' }}
          >
            浏览全部篇章
          </Link>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          marginTop: 64,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            style={{
              background: '#19141b',
              border: '1px solid #3a3038',
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div style={{ fontSize: 26 }}>{f.icon}</div>
            <h3 style={{ margin: '12px 0 8px', fontSize: 18 }}>{f.title}</h3>
            <p style={{ color: '#b9aaa0', margin: 0, fontSize: 15, lineHeight: 1.65 }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Secondary CTA */}
      <section
        style={{
          marginTop: 56,
          textAlign: 'center',
          background: '#19141b',
          border: '1px solid #3a3038',
          borderRadius: 16,
          padding: '36px 24px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24 }}>今天的故事已经更新</h2>
        <p style={{ color: '#b9aaa0', margin: '12px 0 24px', fontSize: 15 }}>
          点过的生词会进生词本,在接下来的章节里和你再见面。
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/today" style={{ ...linkBase, background: '#f6c453', color: '#241a07' }}>
            开始阅读
          </Link>
          <Link
            href="/notebook"
            style={{ ...linkBase, background: 'transparent', color: '#64d2c8', border: '1px solid #335' }}
          >
            我的生词本
          </Link>
        </div>
      </section>
    </main>
  );
}
