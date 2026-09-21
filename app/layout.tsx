import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "答案採点システム",
  description:
    "学校・塾向け答案採点システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}
