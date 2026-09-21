"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  observeAuth,
  type AppUser,
} from "@/lib/auth";

type AuthGuardProps = {
  children: ReactNode;
};

export default function AuthGuard({
  children,
}: AuthGuardProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [user, setUser] =
    useState<AppUser | null>(
      null
    );

  const [checking, setChecking] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (
      pathname === "/login"
    ) {
      setChecking(false);
      return;
    }

    const unsubscribe =
      observeAuth(
        (appUser) => {
          if (!appUser) {
            setUser(null);
            setChecking(false);

            router.replace(
              `/login?next=${encodeURIComponent(
                pathname
              )}`
            );

            return;
          }

          setUser(appUser);
          setError("");
          setChecking(false);
        },
        (authError) => {
          setUser(null);
          setChecking(false);
          setError(
            authError.message
          );

          router.replace(
            "/login"
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    pathname,
    router,
  ]);

  if (
    pathname === "/login"
  ) {
    return <>{children}</>;
  }

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
          background:
            "#f6f7f9",
        }}
      >
        <div
          style={{
            textAlign:
              "center",
          }}
        >
          <p>
            認証情報を確認しています...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
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
        {error ? (
          <p>
            {error}
          </p>
        ) : (
          <p>
            ログイン画面へ移動しています...
          </p>
        )}
      </main>
    );
  }

  return <>{children}</>;
}
