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

      router.replace(
        "/"
      );
    } catch (
      error
    ) {
      console.error(
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
          24,

        background:
          "#f7f7f7",
      }}
    >
      <section
        style={{
          width:
            "100%",

          maxWidth:
            440,

          background:
            "#fff",

          border:
            "1px solid #ddd",

          borderRadius:
            12,

          padding:
            40,

          boxShadow:
            "0 8px 30px rgba(0,0,0,.06)",
        }}
      >
        <div
          style={{
            textAlign:
              "center",

            marginBottom:
              32,
          }}
        >
          <h1
            style={{
              margin:
                "0 0 12px",
            }}
          >
            QR答案採点システム
          </h1>

          <p
            style={{
              margin: 0,

              color:
                "#666",

              lineHeight:
                1.7,
            }}
          >
            登録済みのGoogleアカウントで
            ログインしてください。
          </p>
        </div>

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
              52,

            border:
              "1px solid #ccc",

            borderRadius:
              8,

            background:
              "#fff",

            color:
              "#222",

            fontSize:
              16,

            fontWeight:
              600,

            cursor:
              loading
                ? "default"
                : "pointer",

            opacity:
              loading
                ? 0.6
                : 1,
          }}
        >
          {loading
            ? "Googleでログインしています..."
            : "Googleでログイン"}
        </button>

        {error && (
          <div
            style={{
              marginTop:
                20,

              padding:
                14,

              border:
                "1px solid #e5b5b5",

              borderRadius:
                8,

              background:
                "#fff5f5",

              color:
                "#9b1c1c",

              lineHeight:
                1.6,

              fontSize:
                14,
            }}
          >
            {error}
          </div>
        )}

        <p
          style={{
            marginTop:
              24,

            textAlign:
              "center",

            fontSize:
              12,

            color:
              "#888",

            lineHeight:
              1.6,
          }}
        >
          このシステムは登録済みユーザーのみ利用できます。
        </p>
      </section>
    </main>
  );
}
