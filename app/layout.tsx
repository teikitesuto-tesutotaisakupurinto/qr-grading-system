import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR答案採点システム",
  description: "塾向けQR答案採点・成績管理システム",
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
