"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { observeAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe =
      observeAuth(
        (user) => {
          if (user) {
            router.replace(
              "/dashboard"
            );
          } else {
            router.replace(
              "/login"
            );
          }
        },
        () => {
          router.replace(
            "/login"
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [router]);

  return null;
}
