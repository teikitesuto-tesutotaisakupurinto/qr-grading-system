"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  getCurrentUser,
  type UserRole,
} from "@/lib/auth";

type RoleGuardProps = {
  children: ReactNode;

  allowedRoles: UserRole[];
};

export default function RoleGuard({
  children,
  allowedRoles,
}: RoleGuardProps) {
  const router =
    useRouter();

  const [checking, setChecking] =
    useState(true);

  const [allowed, setAllowed] =
    useState(false);

  useEffect(() => {
    let cancelled =
      false;

    async function check() {
      try {
        const user =
          await getCurrentUser();

        if (cancelled) {
          return;
        }

        if (!user) {
          router.replace(
            "/login"
          );
          return;
        }

        if (
          !allowedRoles.includes(
            user.role
          )
        ) {
          setAllowed(false);
          setChecking(false);

          router.replace(
            "/dashboard"
          );

          return;
        }

        setAllowed(true);
        setChecking(false);
      } catch {
        if (!cancelled) {
          router.replace(
            "/login"
          );
        }
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [
    allowedRoles,
    router,
  ]);

  if (checking) {
    return (
      <main
        style={{
          minHeight:
            "100vh",
          display:
            "grid",
          placeItems:
            "center",
        }}
      >
        認証情報を確認しています...
      </main>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
