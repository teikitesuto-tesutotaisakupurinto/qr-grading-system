"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  auth,
} from "@/lib/firebase";

import {
  getAppUser,
  getDashboardPath,
  observeAuth,
} from "@/lib/auth";

/* =========================================================
   Root page
   ========================================================= */

export default function HomePage() {
  const router =
    useRouter();

  const [
    checking,
    setChecking,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

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
           * 未ログイン
           */
          if (
            !user
          ) {
            router.replace(
              "/login"
            );

            return;
          }

          try {
            /*
             * Firestoreのusers/{uid}を
             * 改めて確認。
             */
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
              !appUser
            ) {
              router.replace(
                "/login"
              );

              return;
            }

            if (
              appUser.active ===
              false
            ) {
              router.replace(
                "/login"
              );

              return;
            }

            /*
             * 権限別ホームへ。
             */
            router.replace(
              getDashboardPath(
                appUser.role
              )
            );
          } catch (
            error
          ) {
            if (
              !mounted
            ) {
              return;
            }

            console.error(
              "Root page auth error:",
              error
            );

            setError(
              error instanceof Error
                ? error.message
                : "ログイン状態を確認できませんでした。"
            );

            setChecking(
              false
            );
          }
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
            "Root auth observer error:",
            observerError
          );

          /*
           * 認証エラー時は
           * ログイン画面へ。
           */
          router.replace(
            "/login"
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
     Loading
     ======================================================= */

  if (
    checking
  ) {
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
          <strong
            style={{
              fontSize:
                20,
            }}
          >
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

  /* =======================================================
     Error
     ======================================================= */

  if (
    error
  ) {
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

            padding:
              25,

            background:
              "#fff",

            border:
              "1px solid #e5e5e5",

            borderRadius:
              10,

            textAlign:
              "center",
          }}
        >
          <h1
            style={{
              margin:
                0,

              fontSize:
                20,
            }}
          >
            テストシステム
          </h1>

          <p
            style={{
              marginTop:
                10,

              color:
                "#8a2222",

              fontSize:
                12,
            }}
          >
            {
              error
            }
          </p>

          <a
            href="/login"
            className="button primary"
            style={{
              display:
                "inline-flex",

              marginTop:
                10,

              textDecoration:
                "none",
            }}
          >
            ログイン
          </a>
        </section>
      </main>
    );
  }

  /*
   * router.replace()待ち。
   */
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
          color:
            "#777",

          fontSize:
            12,
        }}
      >
        移動しています...
      </div>
    </main>
  );
}
