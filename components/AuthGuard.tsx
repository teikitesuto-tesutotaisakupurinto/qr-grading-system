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

  allowedRoles?: Array<
    NonNullable<
      AppUser["role"]
    >
  >;
};

export default function AuthGuard({
  children,
  allowedRoles,
}: AuthGuardProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    user,
    setUser,
  ] =
    useState<AppUser | null>(
      null
    );

  const [
    checking,
    setChecking,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    let disposed =
      false;

    const unsubscribe =
      observeAuth(
        (
          appUser
        ) => {
          if (
            disposed
          ) {
            return;
          }

          setUser(
            appUser
          );

          setChecking(
            false
          );
        },
        (
          authError
        ) => {
          if (
            disposed
          ) {
            return;
          }

          console.error(
            "AuthGuard error:",
            authError
          );

          setUser(
            null
          );

          setError(
            "認証情報を確認できませんでした。"
          );

          setChecking(
            false
          );
        }
      );

    return () => {
      disposed =
        true;

      unsubscribe();
    };
  }, []);

  /* =======================================================
     Checking
     ======================================================= */

  if (
    checking
  ) {
    return (
      <div className="ts-loading">
        <div className="ts-loading-inner">
          <div className="ts-brand">
            テストシステム
          </div>

          <div className="ts-loading-text">
            ログイン状態を確認しています...
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     Not logged in
     ======================================================= */

  if (
    !user
  ) {
    if (
      typeof window !==
      "undefined"
    ) {
      const next =
        pathname ||
        "/dashboard";

      router.replace(
        `/login?next=${encodeURIComponent(
          next
        )}`
      );
    }

    return null;
  }

  /* =======================================================
     Role missing
     ======================================================= */

  if (
    !user.role
  ) {
    return (
      <ForbiddenScreen
        title="権限が設定されていません"
        message={
          error ||
          "管理者にアカウントの権限設定を確認してください。"
        }
      />
    );
  }

  /* =======================================================
     Role check
     ======================================================= */

  if (
    allowedRoles &&
    !allowedRoles.includes(
      user.role
    )
  ) {
    return (
      <ForbiddenScreen
        title="この画面は利用できません"
        message="現在のアカウントには、この画面を利用する権限がありません。"
      />
    );
  }

  return (
    <>
      {children}
    </>
  );
}

/* =========================================================
   Forbidden
   ========================================================= */

function ForbiddenScreen({
  title,
  message,
}: {
  title: string;

  message: string;
}) {
  const router =
    useRouter();

  return (
    <main className="ts-center">
      <section className="ts-error-card">
        <div className="ts-brand">
          テストシステム
        </div>

        <h1>
          {title}
        </h1>

        <p>
          {message}
        </p>

        <button
          type="button"
          className="ts-primary"
          onClick={() =>
            router.replace(
              "/dashboard"
            )
          }
        >
          ダッシュボードへ
        </button>
      </section>
    </main>
  );
}
