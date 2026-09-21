"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  loginWithGoogle,
  getAppUser,
} from "@/lib/auth";

export default function LoginPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loggingIn,
    setLoggingIn,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     すでにログイン済みなら
     ログイン画面を表示しない
     ======================================================= */

  useEffect(() => {
    let disposed =
      false;

    async function checkSession() {
      try {
        const user =
          await getAppUser();

        if (
          disposed
        ) {
          return;
        }

        if (
          user
        ) {
          router.replace(
            getDashboardPath(
              user.role
            )
          );

          return;
        }
      } catch (
        error
      ) {
        console.error(
          "Login session check error:",
          error
        );
      } finally {
        if (
          !disposed
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void checkSession();

    return () => {
      disposed =
        true;
    };
  }, [
    router,
  ]);

  /* =======================================================
     Google Login
     ======================================================= */

  async function handleGoogleLogin() {
    if (
      loggingIn
    ) {
      return;
    }

    try {
      setLoggingIn(
        true
      );

      setError("");

      const user =
        await loginWithGoogle();

      router.replace(
        getDashboardPath(
          user.role
        )
      );
    } catch (
      error
    ) {
      console.error(
        "Google login error:",
        error
      );

      setError(
        getLoginErrorMessage(
          error
        )
      );

      setLoggingIn(
        false
      );
    }
  }

  /* =======================================================
     Session checking
     ======================================================= */

  if (
    loading
  ) {
    return (
      <main className="loginPage">
        <section className="loginCard">
          <div
            className="loginSystemName"
          >
            テストシステム
          </div>

          <div
            className="loginLoading"
          >
            ログイン状態を確認しています...
          </div>
        </section>
      </main>
    );
  }

  /* =======================================================
     Login
     ======================================================= */

  return (
    <main className="loginPage">
      <section className="loginCard">

        <div className="loginHeader">
          <div className="loginSystemName">
            テストシステム
          </div>

          <h1>
            ログイン
          </h1>

          <p>
            登録済みのGoogleアカウントで
            <br />
            ログインしてください。
          </p>
        </div>

        <button
          type="button"
          className="googleLoginButton"
          disabled={
            loggingIn
          }
          onClick={
            handleGoogleLogin
          }
          aria-busy={
            loggingIn
          }
        >
          <img
            src="/google-logo.svg"
            alt=""
            width={20}
            height={20}
          />

          <span>
            {loggingIn
              ? "ログインしています..."
              : "Googleでログイン"}
          </span>
        </button>

        {error && (
          <div
            className="loginError"
            role="alert"
          >
            {
              error
            }
          </div>
        )}

        <p className="loginNotice">
          登録済みユーザーのみ利用できます。
        </p>

      </section>
    </main>
  );
}

/* =========================================================
   Dashboard by role
   ========================================================= */

function getDashboardPath(
  role:
    | string
    | null
) {
  switch (
    role
  ) {
    case "本部管理者":
      return "/dashboard/head-office";

    case "校舎管理者":
      return "/dashboard/school";

    case "講師":
      return "/dashboard/teacher";

    case "生徒":
      return "/dashboard/student";

    default:
      return "/dashboard";
  }
}

/* =========================================================
   Login error
   ========================================================= */

function getLoginErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      "object"
  ) {
    const value =
      error as {
        code?: string;
        message?: string;
      };

    switch (
      value.code
    ) {
      case "auth/popup-closed-by-user":
        return "Googleログインをキャンセルしました。";

      case "auth/popup-blocked":
        return "Googleログイン画面がブロックされました。ポップアップを許可してください。";

      case "auth/unauthorized-domain":
        return "現在のサイトがFirebase Authenticationの承認済みドメインに登録されていません。";

      case "auth/operation-not-allowed":
        return "FirebaseでGoogleログインが有効になっていません。";

      case "auth/network-request-failed":
        return "ネットワーク通信に失敗しました。";

      default:
        return (
          value.message ??
          "Googleログインに失敗しました。"
        );
    }
  }

  return "Googleログインに失敗しました。";
}
