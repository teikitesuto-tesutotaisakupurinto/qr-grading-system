"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  getAppUser,
} from "@/lib/auth";

import type {
  AppUser,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Props
   ========================================================= */

type AuthGuardProps = {
  children: React.ReactNode;

  /*
   * 指定した場合、その権限だけ許可。
   *
   * 未指定ならログイン済みユーザーを許可。
   */
  allowedRoles?:
    | readonly UserRole[]
    | undefined;

  /*
   * 生徒用ページなど、
   * 現在のユーザー自身のデータだけを扱うページ。
   *
   * 現状はUI/データ取得側で制御し、
   * Guardではroleのみ確認。
   */
  requireStudent?: boolean;
};

/* =========================================================
   Component
   ========================================================= */

export default function AuthGuard({
  children,
  allowedRoles,
  requireStudent = false,
}: AuthGuardProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    user,
    setUser,
  ] =
    useState<AppUser | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    denied,
    setDenied,
  ] =
    useState(false);

  /* =======================================================
     Authentication
     ======================================================= */

  useEffect(() => {
    let mounted =
      true;

    async function checkAuth() {
      try {
        setLoading(
          true
        );

        setDenied(
          false
        );

        /*
         * auth.ts側でFirebase Authenticationの
         * 現在ユーザーを取得する。
         */
        const appUser =
          await getAppUser();

        if (
          !mounted
        ) {
          return;
        }

        /*
         * 未ログイン。
         */
        if (
          !appUser
        ) {
          setUser(
            null
          );

          const next =
            pathname &&
            pathname !==
              "/login"
              ? `?next=${encodeURIComponent(
                  pathname
                )}`
              : "";

          router.replace(
            `/login${next}`
          );

          return;
        }

        /*
         * 無効化ユーザー。
         */
        if (
          appUser.active ===
          false
        ) {
          setUser(
            null
          );

          router.replace(
            "/login"
          );

          return;
        }

        /*
         * 権限指定があるページ。
         */
        if (
          allowedRoles &&
          allowedRoles.length >
            0 &&
          !allowedRoles.includes(
            appUser.role
          )
        ) {
          setUser(
            appUser
          );

          setDenied(
            true
          );

          return;
        }

        /*
         * 生徒専用ページ。
         */
        if (
          requireStudent &&
          appUser.role !==
            "生徒"
        ) {
          setUser(
            appUser
          );

          setDenied(
            true
          );

          return;
        }

        setUser(
          appUser
        );
      } catch (
        error
      ) {
        console.error(
          "AuthGuard error:",
          error
        );

        if (
          !mounted
        ) {
          return;
        }

        setUser(
          null
        );

        router.replace(
          "/login"
        );
      } finally {
        if (
          mounted
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void checkAuth();

    return () => {
      mounted =
        false;
    };
  }, [
    pathname,
    router,
    allowedRoles,
    requireStudent,
  ]);

  /* =======================================================
     Loading
     ======================================================= */

  if (
    loading
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

          padding:
            24,
        }}
      >
        <div
          style={{
            textAlign:
              "center",
          }}
        >
          <strong>
            認証情報を確認しています
          </strong>

          <p
            style={{
              marginTop:
                6,

              color:
                "#777",

              fontSize:
                13,
            }}
          >
            しばらくお待ちください。
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     Unauthorized
     ======================================================= */

  if (
    denied
  ) {
    return (
      <ForbiddenPage
        user={
          user
        }
      />
    );
  }

  /* =======================================================
     Not authenticated
     ======================================================= */

  if (
    !user
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
        }}
      >
        認証情報を確認しています...
      </main>
    );
  }

  /* =======================================================
     Authorized
     ======================================================= */

  return (
    <>
      {children}
    </>
  );
}

/* =========================================================
   Forbidden
   ========================================================= */

function ForbiddenPage({
  user,
}: {
  user:
    | AppUser
    | null;
}) {
  const router =
    useRouter();

  function goDashboard() {
    router.replace(
      getDashboardPath(
        user?.role ??
          null
      )
    );
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
            520,

          padding:
            32,

          background:
            "#fff",

          border:
            "1px solid #ddd",

          borderRadius:
            12,

          textAlign:
            "center",
        }}
      >
        <div
          style={{
            width:
              52,

            height:
              52,

            margin:
              "0 auto 16px",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            borderRadius:
              "50%",

            background:
              "#f1f1f1",

            fontSize:
              22,

            fontWeight:
              700,
          }}
        >
          !
        </div>

        <h1
          style={{
            margin:
              0,

            fontSize:
              22,
          }}
        >
          この画面は利用できません
        </h1>

        <p
          style={{
            margin:
              "10px 0 0",

            color:
              "#666",

            lineHeight:
              1.7,

            fontSize:
              13,
          }}
        >
          現在のアカウントには、
          この画面を利用する権限がありません。
        </p>

        {user?.role && (
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
            現在の権限：
            {
              user.role
            }
          </p>
        )}

        <button
          type="button"
          onClick={
            goDashboard
          }
          style={{
            marginTop:
              22,

            padding:
              "10px 18px",

            border:
              "1px solid #222",

            borderRadius:
              7,

            background:
              "#222",

            color:
              "#fff",

            cursor:
              "pointer",

            fontSize:
              13,
          }}
        >
          自分のホームへ戻る
        </button>
      </section>
    </main>
  );
}

/* =========================================================
   Dashboard
   ========================================================= */

function getDashboardPath(
  role:
    | UserRole
    | null
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
      return "/login";
  }
}
