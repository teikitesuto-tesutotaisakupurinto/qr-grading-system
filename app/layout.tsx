import type { Metadata } from "next";

import "./globals.css";

import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title:
    "答案採点システム",
  description:
    "学校・塾向け答案採点管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
