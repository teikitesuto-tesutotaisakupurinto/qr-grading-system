"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

import {
  auth,
  googleProvider,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Page
   ========================================================= */

export default function LoginPage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

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
    signingIn,
    setSigningIn,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  /* =======================================================
     Next path
     ======================================================= */

  const requestedPath =
    searchParams.get(
      "next"
    );

  /*
   * 外部サイトへリダイレクトさせない。
   *
   * /から始まる内部パスだけ許可。
   */
  const safeNextPath =
    getSafeNextPath(
      requestedPath
    );

  /* =======================================================
     Existing session
     ======================================================= */

  useEffect(() => {
    let mounted =
      true;

    /*
     * Firebase Authの現在セッションを確認。
     *
     * ログイン状態はFirebase側に維持させる。
     */
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (
            !mounted
          ) {
            return;
          }

          if (
            !firebaseUser
          ) {
            setLoading(
              false
            );

            return;
          }

          try {
            /*
             * Authenticationだけでなく
             * Firestore側のAppUserも確認。
             */
            const appUser =
              await getAppUser(
                firebaseUser
              );

            if (
              !mounted
            ) {
              return;
            }

            if (
              !appUser ||
              appUser.active ===
                false
            ) {
              setLoading(
                false
              );

              return;
            }

            /*
             * 既にログイン済みなら
             * ログイン画面を出さない。
             */
            router.replace(
              safeNextPath ??
                getDashboardPath(
                  appUser.role
                )
            );
          } catch (
            error
          ) {
            console.error(
              "Existing session check error:",
              error
            );

            if (
              mounted
            ) {
              setLoading(
                false
              );
            }
          }
        }
      );

    return () => {
      mounted =
        false;

      unsubscribe();
    };
  }, [
    router,
    safeNextPath,
  ]);

  /* =======================================================
     Email login
     ======================================================= */

  async function handleEmailLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      signingIn
    ) {
      return;
    }

    try {
      setSigningIn(
        true
      );

      setError("");

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

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
        throw new Error(
          "ユーザー情報が登録されていません。管理者に確認してください。"
        );
      }

      if (
        appUser.active ===
        false
      ) {
        throw new Error(
          "このアカウントは現在利用できません。"
        );
      }

      router.replace(
        safeNextPath ??
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
    } finally {
      setSigningIn(
        false
      );
    }
  }

  /* =======================================================
     Google login
     ======================================================= */

  async function handleGoogleLogin() {
    if (
      signingIn
    ) {
      return;
    }

    try {
      setSigningIn(
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
        /*
         * Firebase Authenticationには
         * ログインできても、アプリ側ユーザーが
         * 登録されていなければ利用させない。
         */
        throw new Error(
          "アプリ側のユーザー登録がありません。管理者にアカウント登録を依頼してください。"
        );
      }

      if (
        appUser.active ===
        false
      ) {
        throw new Error(
          "このアカウントは現在利用できません。"
        );
      }

      router.replace(
        safeNextPath ??
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
    } finally {
      setSigningIn(
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
      <LoginShell>
        <div
          style={{
            textAlign:
              "center",

            padding:
              40,
          }}
        >
          <strong>
            ログイン状態を確認しています
          </strong>

          <p
            className="muted"
            style={{
              marginTop:
                7,

              fontSize:
                12,
            }}
          >
            しばらくお待ちください。
          </p>
        </div>
      </LoginShell>
    );
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <LoginShell>
      <div>
        <header
          style={{
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

              marginBottom:
                6,
            }}
          >
            テストシステム
          </div>

          <h1
            style={{
              margin:
                0,

              fontSize:
                28,
            }}
          >
            ログイン
          </h1>

          <p
            className="muted"
            style={{
              margin:
                "8px 0 0",

              fontSize:
                13,
            }}
          >
            アカウント情報を入力してください。
          </p>
        </header>

        {error && (
          <div
            className="errorMessage"
            role="alert"
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

        {/* ==================================================
            Google
            ================================================== */}

        <button
          type="button"
          onClick={
            handleGoogleLogin
          }
          disabled={
            signingIn
          }
          style={{
            width:
              "100%",

            padding:
              "12px 14px",

            border:
              "1px solid #ccc",

            borderRadius:
              7,

            background:
              "#fff",

            cursor:
              signingIn
                ? "default"
                : "pointer",

            fontSize:
              14,

            fontWeight:
              600,
          }}
        >
          {signingIn
            ? "ログイン中..."
            : "Googleでログイン"}
        </button>

        {/* ==================================================
            Divider
            ================================================== */}

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
          <span
            style={{
              flex:
                1,

              height:
                1,

              background:
                "#eee",
            }}
          />

          <span>
            または
          </span>

          <span
            style={{
              flex:
                1,

              height:
                1,

              background:
                "#eee",
            }}
          />
        </div>

        {/* ==================================================
            Email / Password
            ================================================== */}

        <form
          onSubmit={
            handleEmailLogin
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
              autoCapitalize="none"
              spellCheck={
                false
              }
              placeholder="example@example.com"
              disabled={
                signingIn
              }
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
                16,
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

            <div
              style={{
                position:
                  "relative",
              }}
            >
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
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
                  signingIn
                }
                style={{
                  width:
                    "100%",

                  paddingRight:
                    80,
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (
                      current
                    ) =>
                      !current
                  )
                }
                disabled={
                  signingIn
                }
                style={{
                  position:
                    "absolute",

                  right:
                    7,

                  top:
                    "50%",

                  transform:
                    "translateY(-50%)",

                  border:
                    0,

                  background:
                    "transparent",

                  cursor:
                    "pointer",

                  fontSize:
                    11,

                  color:
                    "#666",
                }}
              >
                {showPassword
                  ? "隠す"
                  : "表示"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={
              signingIn
            }
            className="button primary"
            style={{
              width:
                "100%",

              marginTop:
                22,

              padding:
                "12px 14px",
            }}
          >
            {signingIn
              ? "ログイン中..."
              : "ログイン"}
          </button>
        </form>

        {/* ==================================================
            Session notice
            ================================================== */}

        <p
          className="muted"
          style={{
            marginTop:
              18,

            fontSize:
              11,

            lineHeight:
              1.7,

            textAlign:
              "center",
          }}
        >
          ログイン状態は保持されます。
          <br />
          次回アクセス時もログイン状態を確認します。
        </p>
      </div>
    </LoginShell>
  );
}

/* =========================================================
   Shell
   ========================================================= */

function LoginShell({
  children,
}: {
  children:
    React.ReactNode;
}) {
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
            430,

          padding:
            32,

          background:
            "#fff",

          border:
            "1px solid #e5e5e5",

          borderRadius:
            12,

          boxShadow:
            "0 8px 30px rgba(0,0,0,.04)",
        }}
      >
        {children}
      </section>
    </main>
  );
}

/* =========================================================
   Dashboard
   ========================================================= */

function getDashboardPath(
  role: UserRole
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
   Safe next
   ========================================================= */

function getSafeNextPath(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return null;
  }

  /*
   * 外部URL禁止。
   */
  if (
    !value.startsWith(
      "/"
    )
  ) {
    return null;
  }

  /*
   * //example.com のような
   * protocol-relative URLも禁止。
   */
  if (
    value.startsWith(
      "//"
    )
  ) {
    return null;
  }

  /*
   * ログインページへのループ防止。
   */
  if (
    value ===
      "/login" ||
    value.startsWith(
      "/login?"
    )
  ) {
    return null;
  }

  return value;
}

/* =========================================================
   Error
   ========================================================= */

function getLoginErrorMessage(
  error: unknown
) {
  const code =
    typeof error ===
    "object" &&
    error !== null &&
    "code" in
      error
      ? String(
          (
            error as {
              code?: unknown;
            }
          ).code ??
            ""
        )
      : "";

  switch (
    code
  ) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "メールアドレスまたはパスワードが正しくありません。";

    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";

    case "auth/user-disabled":
      return "このアカウントは利用停止されています。";

    case "auth/popup-closed-by-user":
      return "Googleログインをキャンセルしました。";

    case "auth/popup-blocked":
      return "ログイン画面がブロックされました。ブラウザのポップアップ設定を確認してください。";

    case "auth/network-request-failed":
      return "ネットワークエラーが発生しました。通信状態を確認してください。";

    default:
      if (
        error instanceof Error
      ) {
        return error.message;
      }

      return "ログインできませんでした。時間をおいてもう一度お試しください。";
  }
}
