"use client";

import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleGoogleLogin() {
    try {
      setLoading(true);
      setError("");

      // Firebaseをクリック時まで読み込まない
      const authModule =
        await import("@/lib/auth");

      await authModule.loginWithGoogle();

      window.location.href =
        "/dashboard";
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Googleログインに失敗しました。"
      );

      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f5f6f8",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #e2e5e9",
          borderRadius: "16px",
          padding: "40px",
          boxShadow:
            "0 12px 35px rgba(0,0,0,.07)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "26px",
              fontWeight: 700,
              color: "#171717",
            }}
          >
            答案採点システム
          </h1>

          <p
            style={{
              margin: 0,
              color: "#666",
              fontSize: "14px",
              lineHeight: 1.8,
            }}
          >
            登録済みのGoogleアカウントで
            <br />
            ログインしてください。
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleLogin}
          style={{
            width: "100%",
            height: "52px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            border:
              "1px solid #dadce0",
            borderRadius: "8px",
            background: "#fff",
            color: "#3c4043",
            fontSize: "15px",
            fontWeight: 600,
            cursor: loading
              ? "default"
              : "pointer",
            opacity: loading
              ? 0.6
              : 1,
          }}
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
            style={{
              marginTop: "18px",
              padding: "13px 15px",
              border:
                "1px solid #efb5b5",
              borderRadius: "8px",
              background: "#fff4f4",
              color: "#9b1c1c",
              fontSize: "14px",
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}

        <p
          style={{
            margin: "22px 0 0",
            textAlign: "center",
            color: "#888",
            fontSize: "12px",
          }}
        >
          登録済みユーザーのみ利用できます。
        </p>
      </section>
    </main>
  );
}
