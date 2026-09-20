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
    try {
      setLoading(true);
      setError("");

      await loginWithGoogle();

      router.replace("/");
    } catch (error) {
      console.error(
        "Google login error:",
        error
      );

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
    <main
      style={{
        minHeight:
          "100vh",

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding:
          "24px",

        background:
          "#f7f8fa",
      }}
    >
      <section
        style={{
          width:
            "100%",

          maxWidth:
            "440px",

          background:
            "#ffffff",

          border:
            "1px solid #e5e7eb",

          borderRadius:
            "16px",

          padding:
            "42px 40px",

          boxShadow:
            "0 10px 35px rgba(0, 0, 0, 0.06)",
        }}
      >
        {/* ロゴ・タイトル */}
        <div
          style={{
            textAlign:
              "center",

            marginBottom:
              "32px",
          }}
        >
          <div
            style={{
              width:
                "64px",

              height:
                "64px",

              margin:
                "0 auto 20px",

              borderRadius:
                "14px",

              background:
                "#111827",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              color:
                "#ffffff",

              fontSize:
                "24px",

              fontWeight:
                700,
            }}
          >
            QR
          </div>

          <h1
            style={{
              margin:
                "0 0 12px",

              fontSize:
                "24px",

              lineHeight:
                1.4,

              fontWeight:
                700,

              color:
                "#111827",
            }}
          >
            QR答案採点システム
          </h1>

          <p
            style={{
              margin: 0,

              fontSize:
                "14px",

              lineHeight:
                1.7,

              color:
                "#6b7280",
            }}
          >
            登録済みのGoogleアカウントで
            <br />
            ログインしてください。
          </p>
        </div>

        {/* Googleログイン */}
        <button
          type="button"
          disabled={
            loading
          }
          onClick={
            handleGoogleLogin
          }
          style={{
            width:
              "100%",

            height:
              "52px",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            gap:
              "12px",

            padding:
              "0 20px",

            border:
              "1px solid #dadce0",

            borderRadius:
              "8px",

            background:
              "#ffffff",

            color:
              "#3c4043",

            fontSize:
              "15px",

            fontWeight:
              600,

            cursor:
              loading
                ? "default"
                : "pointer",

            opacity:
              loading
                ? 0.65
                : 1,

            transition:
              "background 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(
            event
          ) => {
            if (!loading) {
              event.currentTarget.style.background =
                "#f8f9fa";

              event.currentTarget.style.boxShadow =
                "0 1px 3px rgba(60,64,67,.15)";
            }
          }}
          onMouseLeave={(
            event
          ) => {
            event.currentTarget.style.background =
              "#ffffff";

            event.currentTarget.style.boxShadow =
              "none";
          }}
        >
          <img
            src="/google-logo.svg"
            alt=""
            width={20}
            height={20}
            style={{
              display:
                "block",

              flexShrink:
                0,
            }}
          />

          <span>
            {loading
              ? "Googleでログインしています..."
              : "Googleでログイン"}
          </span>
        </button>

        {/* エラー */}
        {error && (
          <div
            role="alert"
            style={{
              marginTop:
                "18px",

              padding:
                "14px 16px",

              border:
                "1px solid #fecaca",

              borderRadius:
                "8px",

              background:
                "#fef2f2",

              color:
                "#991b1b",

              fontSize:
                "14px",

              lineHeight:
                1.6,
            }}
          >
            {error}
          </div>
        )}

        {/* 注意書き */}
        <p
          style={{
            margin:
              "24px 0 0",

            textAlign:
              "center",

            fontSize:
              "12px",

            lineHeight:
              1.7,

            color:
              "#9ca3af",
          }}
        >
          このシステムは登録済みユーザーのみ
          <br />
          利用できます。
        </p>
      </section>
    </main>
  );
}
