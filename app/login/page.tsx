import { LoginClient } from '@/app/login/LoginClient';

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>登录 English Daily</h1>
      <p style={{ color: '#78716c', marginTop: 0 }}>保存生词本，从每天点过的词开始复现。</p>
      <LoginClient />
    </main>
  );
}
