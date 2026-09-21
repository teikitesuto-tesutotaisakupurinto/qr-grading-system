"use client";

import { useState } from "react";

import { loginWithGoogle } from "@/lib/auth";

export default function LoginPage() {
  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleGoogleLogin() {
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      /*
       * Firebase Authentication
       * Googleログイン
       *
       * Firestoreのusers/{uid}確認は
       * ここでは行わない。
       */
      await loginWithGoogle();

      /*
       * Authentication成功後、
       * Dashboardへ移動。
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

  return (
    <main className="loginPage">
      <section className="loginCard">
        {/* ================================================
            Header
            ================================================ */}

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

        {/* ================================================
            Google Login Button
            ================================================ */}

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

        {/* ================================================
            Error
            ================================================ */}

        {error && (
          <div
            className="loginError"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* ================================================
            Notice
            ================================================ */}

        <p className="loginNotice">
          登録済みユーザーのみ利用できます。
        </p>
      </section>
    </main>
  );
}

/* =========================================================
   Login Error
   ========================================================= */

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
      return "FirebaseのAPIキー設定が正しくありません。";

    case "auth/invalid-argument":
    case "auth/argument-error":
      return "Firebase Authenticationの設定を確認してください。";

    case "auth/operation-not-allowed":
      return "FirebaseでGoogleログインが有効になっていません。";

    case "auth/unauthorized-domain":
      return "この公開サイトのドメインがFirebase Authenticationの承認済みドメインに登録されていません。";

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
