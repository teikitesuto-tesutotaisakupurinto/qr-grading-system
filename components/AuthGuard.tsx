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

  /*
   * 認証必須がデフォルト。
   * loginなど公開ページではfalseにできる。
   */
  requireAuth?: boolean;

  /*
   * 指定した権限だけ許可。
   * 未指定ならログイン済みユーザー全員。
   */
  allowedRoles?: Array<
    NonNullable<AppUser["role"]>
  >;
};

export default function AuthGuard({
  children,
  requireAuth = true,
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

  /* =======================================================
     Authentication
     ======================================================= */

  useEffect(() => {
    if (
      !requireAuth
    ) {
      setChecking(
        false
      );

      return;
    }

    setChecking(
      true
    );

    const unsubscribe =
      observeAuth(
        (
          appUser
        ) => {
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
      unsubscribe();
    };
  }, [
    requireAuth,
  ]);

  /* =======================================================
     Public page
     ======================================================= */

  if (
    !requireAuth
  ) {
    return (
      <>
        {children}
      </>
    );
  }

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
            認証情報を確認しています...
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     Not authenticated
     ======================================================= */

  if (
    !user
  ) {
    return (
      <div className="ts-center">
        <section className="ts-error-card">
          <div className="ts-brand">
            テストシステム
          </div>

          <h1>
            ログインが必要です
          </h1>

          <p>
            {error ||
              "このページを利用するにはログインしてください。"}
          </p>

          <button
            type="button"
            className="ts-primary"
            onClick={() =>
              router.replace(
                `/login?returnTo=${encodeURIComponent(
                  pathname
                )}`
              )
            }
          >
            ログイン画面へ
          </button>
        </section>
      </div>
    );
  }

  /* =======================================================
     Role missing
     ======================================================= */

  if (
    !user.role
  ) {
    return (
      <div className="ts-center">
        <section className="ts-error-card">
          <div className="ts-brand">
            テストシステム
          </div>

          <h1>
            権限が設定されていません
          </h1>

          <p>
            管理者にアカウントの権限設定を確認してください。
          </p>
        </section>
      </div>
    );
  }

  /* =======================================================
     Role restriction
     ======================================================= */

  if (
    allowedRoles &&
    !allowedRoles.includes(
      user.role
    )
  ) {
    return (
      <ForbiddenScreen />
    );
  }

  /* =======================================================
     Authorized
     ======================================================= */

  return (
    <>
      {children}
    </>
  );
}

/* =========================================================
   Forbidden
   ========================================================= */

function ForbiddenScreen() {
  const router =
    useRouter();

  return (
    <div className="ts-center">
      <section className="ts-error-card">
        <div className="ts-brand">
          テストシステム
        </div>

        <h1>
          権限がありません
        </h1>

        <p>
          このページを利用する権限がありません。
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
          ダッシュボードへ戻る
        </button>
      </section>
    </div>
  );
}
