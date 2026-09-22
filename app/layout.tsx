import type {
  Metadata,
} from "next";

import "./globals.css";

import AppShell from "@/components/AppShell";

/* =========================================================
   Metadata
   ========================================================= */

export const metadata: Metadata = {
  title:
    "テストシステム",

  description:
    "答案・採点・成績管理システム",
};

/* =========================================================
   Root Layout
   ========================================================= */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
    >
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
