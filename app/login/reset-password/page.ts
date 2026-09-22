"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";

import {
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  auth,
} from "@/lib/firebase";

/* =========================================================
   Page
   ========================================================= */

export default function ResetPasswordPage() {
  const [
    email,
    setEmail,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    completed,
    setCompleted,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     Submit
     ======================================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      loading
    ) {
      return;
    }

    try {
      setLoading(true);

      setError("");

      setCompleted(false);

      const normalizedEmail =
        email.trim();

      if (
        !normalizedEmail
      ) {
        throw new Error(
          "メールアドレスを入力してください。"
        );
      }

      await sendPasswordResetEmail(
        auth,
        normalizedEmail
      );

      setCompleted(true);
    } catch (
      error
    ) {
      console.error(
        "Password reset error:",
        error
      );

      setError(
        getResetErrorMessage(
          error
        )
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Render
     ======================================================= */

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

        background:
          "#f7f7f7",

        padding:
          20,
      }}
    >
      <section
        style={{
          width:
            "100%",

          maxWidth:
            420,

          background:
            "#fff",

          border:
            "1px solid #e5e5e5",

          borderRadius:
            12,

          padding:
            30,
        }}
      >
        {/* =================================================
            Header
            ================================================= */}

        <header
          style={{
            textAlign:
              "center",

            marginBottom:
              24,
          }}
        >
          <div
            style={{
              fontSize:
                11,

              color:
                "#777",
            }}
          >
            テストシステム
          </div>

          <h1
            style={{
              margin:
                "7px 0 0",

              fontSize:
                22,
            }}
          >
            パスワード再設定
          </h1>

          <p
            className="muted"
            style={{
              margin:
                "8px 0 0",

              fontSize:
                12,

              lineHeight:
                1.7,
            }}
          >
            登録されているメールアドレスに
            パスワード再設定用のメールを送信します。
          </p>
        </header>

        {/* =================================================
            Error
            ================================================= */}

        {error && (
          <div
            role="alert"
            className="errorMessage"
            style={{
              marginBottom:
                16,
            }}
          >
            {
              error
            }
          </div>
        )}

        {/* =================================================
            Completed
            ================================================= */}

        {completed ? (
          <section
            style={{
              padding:
                16,

              borderRadius:
                8,

              background:
                "#e8f5e9",

              fontSize:
                12,

              lineHeight:
                1.7,
            }}
          >
            <strong>
              メールを送信しました。
            </strong>

            <p
              style={{
                margin:
                  "7px 0 0",
              }}
            >
              メールボックスを確認して、
              パスワードを再設定してください。
            </p>

            <p
              style={{
                margin:
                  "7px 0 0",
              }}
            >
              メールが届かない場合は、
              迷惑メールフォルダも確認してください。
            </p>
          </section>
        ) : (
          /* ===============================================
             Form
             =============================================== */

          <form
            onSubmit={
              handleSubmit
            }
          >
            <label
              style={{
                display:
                  "block",
              }}
            >
              <span
                style={{
                  display:
                    "block",

                  marginBottom:
                    6,

                  fontSize:
                    12,

                  fontWeight:
                    600,
                }}
              >
                メールアドレス
              </span>

              <input
                type="email"
                value={
                  email
                }
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target
                      .value
                  )
                }
                autoComplete="email"
                placeholder="example@example.com"
                required
                disabled={
                  loading
                }
                style={{
                  width:
                    "100%",
                }}
              />
            </label>

            <button
              type="submit"
              className="button primary"
              disabled={
                loading
              }
              style={{
                width:
                  "100%",

                marginTop:
                  16,

                minHeight:
                  44,
              }}
            >
              {loading
                ? "送信中..."
                : "再設定メールを送信"}
            </button>
          </form>
        )}

        {/* =================================================
            Login
            ================================================= */}

        <div
          style={{
            marginTop:
              22,

            paddingTop:
              16,

            borderTop:
              "1px solid #eee",

            textAlign:
              "center",
          }}
        >
          <Link
            href="/login"
            style={{
              fontSize:
                12,

              color:
                "#333",

              textDecoration:
                "none",
            }}
          >
            ログイン画面へ
          </Link>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   Error message
   ========================================================= */

function getResetErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    const code =
      (
        error as {
          code?: string;
        }
      ).code;

    switch (
      code
    ) {
      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません。";

      case "auth/user-not-found":
        return "登録されているメールアドレスを確認してください。";

      case "auth/too-many-requests":
        return "送信回数が多すぎます。しばらくしてから再度お試しください。";

      case "auth/network-request-failed":
        return "ネットワークエラーが発生しました。";

      default:
        return (
          error.message ||
          "パスワード再設定メールを送信できませんでした。"
        );
    }
  }

  return "パスワード再設定メールを送信できませんでした。";
}
