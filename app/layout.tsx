import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "答案採点システム",
  description:
    "答案採点・管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
