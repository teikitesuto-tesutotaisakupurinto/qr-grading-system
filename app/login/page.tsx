"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { loginWithGoogle } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      await loginWithGoogle();

      router.replace("/dashboard");
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Googleログインに失敗しました。"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginHeader">
          <h1>答案採点システム</h1>

          <p>
            登録済みのGoogleアカウントで
            <br />
            ログインしてください。
          </p>
        </div>

        <button
          type="button"
          className="googleLoginButton"
          disabled={loading}
          onClick={handleGoogleLogin}
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

        {error && (
          <div
            className="loginError"
            role="alert"
          >
            {error}
          </div>
        )}

        <p className="loginNotice">
          登録済みユーザーのみ利用できます。
        </p>
      </section>
    </main>
  );
}
