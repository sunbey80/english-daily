import type { ReactNode } from 'react';

import { AuthNav } from '@/app/AuthNav';

export const metadata = {
  title: 'English Daily',
  description: '每日连载式分级英语阅读',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          background: '#100d12',
          color: '#f7efe4',
          minHeight: '100vh',
        }}
      >
        <AuthNav />
        {children}
      </body>
    </html>
  );
}
