"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  loginWithGoogle,
} from "@/lib/auth";

export default function LoginPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function handleGoogleLogin() {
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      /*
       * Google Authenticationのみ実行。
       */
      await loginWithGoogle();

      /*
       * ログイン成功後はDashboardへ。
       */
      window.location.assign(
        "/dashboard"
      );
    } catch (error) {
      console.error(
        "Google login error:",
        error
      );

      setLoading(false);

      setError(
        getLoginErrorMessage(
          error
        )
      );
    }
  }

  function handleBack() {
    /*
     * 前のページが存在する場合は戻る。
     * 直接/loginを開いた場合はトップへ。
     */
    if (
      window.history.length >
      1
    ) {
      router.back();
      return;
    }

    window.location.assign(
      "/"
    );
  }

  return (
    <main className="loginPage">
      <section className="loginCard">

        {/* =============================================
            戻る
            ============================================= */}

        <button
          type="button"
          onClick={handleBack}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 24,
            padding: 0,
            border: "none",
            background: "transparent",
            color: "#666",
            fontSize: 14,
            cursor: loading
              ? "default"
              : "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ←
          </span>

          <span>
            戻る
          </span>
        </button>

        {/* =============================================
            Header
            ============================================= */}

        <div className="loginHeader">
          <h1>
            答案採点システム
          </h1>

          <p>
            登録済みのGoogleアカウントで
            <br />
            ログインしてください。
          </p>
        </div>

        {/* =============================================
            Google Login
            ============================================= */}

        <button
          type="button"
          className="googleLoginButton"
          disabled={loading}
          onClick={
            handleGoogleLogin
          }
          aria-busy={loading}
        >
          <img
            src="/google-logo.svg"
            alt="Google"
            width={20}
            height={20}
          />

          <span>
            {loading
              ? "ログインしています..."
              : "Googleでログイン"}
          </span>
        </button>

        {/* =============================================
            Error
            ============================================= */}

        {error && (
          <div
            className="loginError"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* =============================================
            Notice
            ============================================= */}

        <p className="loginNotice">
          登録済みユーザーのみ利用できます。
        </p>
      </section>
    </main>
  );
}

/* =====================================================
   Login Error
   ===================================================== */

function getLoginErrorMessage(
  error: unknown
): string {
  if (
    !error ||
    typeof error !==
      "object"
  ) {
    return "Googleログインに失敗しました。";
  }

  const firebaseError =
    error as {
      code?: string;
      message?: string;
    };

  switch (
    firebaseError.code
  ) {
    case "auth/popup-closed-by-user":
      return "Googleログインをキャンセルしました。";

    case "auth/popup-blocked":
      return "Googleログイン画面がブロックされました。ブラウザのポップアップを許可してください。";

    case "auth/cancelled-popup-request":
      return "Googleログイン処理がキャンセルされました。もう一度お試しください。";

    case "auth/account-exists-with-different-credential":
      return "このメールアドレスには別のログイン方法で登録されたアカウントがあります。";

    case "auth/invalid-api-key":
      return "Firebaseの設定を確認してください。";

    case "auth/invalid-argument":
    case "auth/argument-error":
      return "Googleログインの設定を確認してください。";

    case "auth/operation-not-allowed":
      return "FirebaseでGoogleログインが有効になっていません。";

    case "auth/unauthorized-domain":
      return "現在のサイトがFirebase Authenticationの承認済みドメインに登録されていません。";

    case "auth/network-request-failed":
      return "ネットワーク通信に失敗しました。";

    case "auth/internal-error":
      return "Firebase Authenticationで内部エラーが発生しました。";

    default:
      return (
        firebaseError.message ||
        "Googleログインに失敗しました。"
      );
  }
}
