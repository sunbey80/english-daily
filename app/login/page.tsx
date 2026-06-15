import { LoginClient } from '@/app/login/LoginClient';

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '52px 20px 80px' }}>
      <p style={{ color: '#64d2c8', margin: '0 0 8px', fontSize: 14 }}>Account</p>
      <h1 style={{ fontSize: 32, margin: 0 }}>登录 English Daily</h1>
      <p style={{ color: '#b9aaa0', marginTop: 10 }}>保存生词本，从每天确认加入的词开始复现。</p>
      <LoginClient />
    </main>
  );
}
