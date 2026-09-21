"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { observeAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    return observeAuth(
      (user) => {
        if (user) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      },
      () => {
        router.replace("/login");
      }
    );
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      認証情報を確認しています...
    </main>
  );
}
