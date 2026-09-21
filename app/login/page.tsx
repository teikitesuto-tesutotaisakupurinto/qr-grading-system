"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithGoogle } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function login() {
    try {
      setLoading(true);
      setError("");

      await loginWithGoogle();

      router.replace("/dashboard");
    } catch (error) {
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
        <h1>QR答案採点システム</h1>

        <p>
          登録済みのGoogleアカウントで
          ログインしてください。
        </p>

        <button
          type="button"
          className="googleLoginButton"
          disabled={loading}
          onClick={login}
        >
          <img
            src="/google-logo.svg"
            alt=""
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
          <div className="errorMessage">
            {error}
          </div>
        )}

        <small>
          登録済みユーザーのみ利用できます。
        </small>
      </section>
    </main>
  );
}
