import type {
  Metadata,
} from "next";

import "./globals.css";

import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Tsystem",
  description:
    "Tsystem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
