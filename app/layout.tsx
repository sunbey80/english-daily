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
          background: '#fafaf9',
          color: '#1c1917',
        }}
      >
        <AuthNav />
        {children}
      </body>
    </html>
  );
}
