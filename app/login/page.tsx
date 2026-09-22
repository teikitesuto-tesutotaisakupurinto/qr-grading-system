"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

import {
  auth,
  googleProvider,
} from "@/lib/firebase";

import {
  getAppUser,
  getDashboardPath,
  observeAuth,
} from "@/lib/auth";

/* =========================================================
   Page
   ========================================================= */

export default function LoginPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    googleLoading,
    setGoogleLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /* =======================================================
     Existing session
     ======================================================= */

  useEffect(() => {
    let mounted =
      true;

    const unsubscribe =
      observeAuth(
        async (
          user
        ) => {
          if (
            !mounted
          ) {
            return;
          }

          /*
           * 既にログイン済みなら
           * ログイン画面を表示しない。
           */
          if (
            user
          ) {
            const appUser =
              await getAppUser(
                auth.currentUser
              );

            if (
              !mounted
            ) {
              return;
            }

            if (
              appUser &&
              appUser.active !==
                false
            ) {
              router.replace(
                getDashboardPath(
                  appUser.role
                )
              );

              return;
            }
          }

          setLoading(
            false
          );
        },
        (
          observerError
        ) => {
          if (
            !mounted
          ) {
            return;
          }

          console.error(
            "Login auth observer error:",
            observerError
          );

          /*
           * 未ログイン状態なら
           * ログインフォームを表示する。
           */
          setLoading(
            false
          );
        }
      );

    return () => {
      mounted =
        false;

      unsubscribe();
    };
  }, [
    router,
  ]);

  /* =======================================================
     Email login
     ======================================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submitting ||
      googleLoading
    ) {
      return;
    }

    try {
      setSubmitting(
        true
      );

      setError("");

      const normalizedEmail =
        email.trim();

      if (
        !normalizedEmail
      ) {
        throw new Error(
          "メールアドレスを入力してください。"
        );
      }

      if (
        !password
      ) {
        throw new Error(
          "パスワードを入力してください。"
        );
      }

      const credential =
        await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      const appUser =
        await getAppUser(
          credential.user
        );

      if (
        !appUser
      ) {
        await auth.signOut();

        throw new Error(
          "このアカウントはテストシステムに登録されていません。"
        );
      }

      if (
        appUser.active ===
        false
      ) {
        await auth.signOut();

        throw new Error(
          "このアカウントは利用停止されています。"
        );
      }

      router.replace(
        getDashboardPath(
          appUser.role
        )
      );
    } catch (
      error
    ) {
      console.error(
        "Email login error:",
        error
      );

      setError(
        getLoginErrorMessage(
          error
        )
      );

      setSubmitting(
        false
      );
    }
  }

  /* =======================================================
     Google login
     ======================================================= */

  async function handleGoogleLogin() {
    if (
      submitting ||
      googleLoading
    ) {
      return;
    }

    try {
      setGoogleLoading(
        true
      );

      setError("");

      const credential =
        await signInWithPopup(
          auth,
          googleProvider
        );

      const appUser =
        await getAppUser(
          credential.user
        );

      if (
        !appUser
      ) {
        await auth.signOut();

        throw new Error(
          "このGoogleアカウントはテストシステムに登録されていません。"
        );
      }

      if (
        appUser.active ===
        false
      ) {
        await auth.signOut();

        throw new Error(
          "このアカウントは利用停止されています。"
        );
      }

      router.replace(
        getDashboardPath(
          appUser.role
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

      setGoogleLoading(
        false
      );
    }
  }

  /* =======================================================
     Loading
     ======================================================= */

  if (
    loading
  ) {
    return (
      <LoginLoading />
    );
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

          boxShadow:
            "0 8px 30px rgba(0,0,0,.04)",
        }}
      >
        {/* =================================================
            Brand
            ================================================= */}

        <header
          style={{
            textAlign:
              "center",

            marginBottom:
              26,
          }}
        >
          <div
            style={{
              fontSize:
                12,

              color:
                "#777",

              letterSpacing:
                ".08em",
            }}
          >
            TEST SYSTEM
          </div>

          <h1
            style={{
              margin:
                "6px 0 0",

              fontSize:
                27,

              letterSpacing:
                ".04em",
            }}
          >
            テストシステム
          </h1>

          <p
            style={{
              margin:
                "8px 0 0",

              color:
                "#777",

              fontSize:
                12,
            }}
          >
            答案・採点・成績管理
          </p>
        </header>

        {/* =================================================
            Error
            ================================================= */}

        {error && (
          <div
            role="alert"
            style={{
              marginBottom:
                16,

              padding:
                11,

              borderRadius:
                7,

              background:
                "#fff1f1",

              color:
                "#8a2222",

              fontSize:
                12,

              lineHeight:
                1.6,
            }}
          >
            {
              error
            }
          </div>
        )}

        {/* =================================================
            Email login
            ================================================= */}

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
              disabled={
                submitting ||
                googleLoading
              }
              required
              style={{
                width:
                  "100%",
              }}
            />
          </label>

          <label
            style={{
              display:
                "block",

              marginTop:
                14,
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
              パスワード
            </span>

            <input
              type="password"
              value={
                password
              }
              onChange={(
                event
              ) =>
                setPassword(
                  event.target
                    .value
                )
              }
              autoComplete="current-password"
              placeholder="パスワード"
              disabled={
                submitting ||
                googleLoading
              }
              required
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
              submitting ||
              googleLoading
            }
            style={{
              width:
                "100%",

              marginTop:
                18,

              minHeight:
                44,
            }}
          >
            {submitting
              ? "ログイン中..."
              : "ログイン"}
          </button>
        </form>

        {/* =================================================
            Divider
            ================================================= */}

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              10,

            margin:
              "22px 0",

            color:
              "#999",

            fontSize:
              11,
          }}
        >
          <div
            style={{
              flex:
                1,

              height:
                1,

              background:
                "#e5e5e5",
            }}
          />

          <span>
            または
          </span>

          <div
            style={{
              flex:
                1,

              height:
                1,

              background:
                "#e5e5e5",
            }}
          />
        </div>

        {/* =================================================
            Google
            ================================================= */}

        <button
          type="button"
          onClick={
            handleGoogleLogin
          }
          disabled={
            submitting ||
            googleLoading
          }
          style={{
            width:
              "100%",

            minHeight:
              44,

            border:
              "1px solid #d9d9d9",

            borderRadius:
              7,

            background:
              "#fff",

            cursor:
              "pointer",

            fontSize:
              13,

            fontWeight:
              600,
          }}
        >
          {googleLoading
            ? "Googleでログイン中..."
            : "Googleでログイン"}
        </button>

        {/* =================================================
            Footer
            ================================================= */}

        <footer
          style={{
            marginTop:
              24,

            paddingTop:
              16,

            borderTop:
              "1px solid #eee",

            textAlign:
              "center",

            color:
              "#999",

            fontSize:
              10,

            lineHeight:
              1.6,
          }}
        >
          ログイン状態は保持されます。
          <br />
          次回アクセス時もログイン状態を確認します。
        </footer>
      </section>
    </main>
  );
}

/* =========================================================
   Loading
   ========================================================= */

function LoginLoading() {
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
      }}
    >
      <div
        style={{
          textAlign:
            "center",
        }}
      >
        <strong>
          テストシステム
        </strong>

        <p
          style={{
            margin:
              "8px 0 0",

            color:
              "#777",

            fontSize:
              12,
          }}
        >
          ログイン状態を確認しています...
        </p>
      </div>
    </main>
  );
}

/* =========================================================
   Error message
   ========================================================= */

function getLoginErrorMessage(
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
      case "auth/invalid-credential":
        return "メールアドレスまたはパスワードが正しくありません。";

      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません。";

      case "auth/user-disabled":
        return "このアカウントは利用停止されています。";

      case "auth/too-many-requests":
        return "ログイン試行が多すぎます。しばらくしてから再度お試しください。";

      case "auth/popup-closed-by-user":
        return "Googleログインがキャンセルされました。";

      case "auth/popup-blocked":
        return "ブラウザによってログイン画面がブロックされました。ポップアップを許可してください。";

      case "auth/network-request-failed":
        return "ネットワークエラーが発生しました。";

      default:
        return (
          error.message ||
          "ログインできませんでした。"
        );
    }
  }

  return "ログインできませんでした。";
}
