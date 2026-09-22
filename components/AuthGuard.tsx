"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  auth,
} from "@/lib/firebase";

import {
  getAppUser,
  observeAuth,
  getDashboardPath,
  type AppUser,
} from "@/lib/auth";

/* =========================================================
   Props
   ========================================================= */

type AuthGuardProps = {
  children: ReactNode;

  /*
   * 画面側から必要な権限を指定できる。
   *
   * 指定しない場合は、
   * URLの保護ルールだけを確認する。
   */
  allowedRoles?: AppUser["role"][];

  /*
   * ログイン不要画面では使用しない。
   * AuthGuard自体を使わない。
   */
  redirectTo?: string;
};

/* =========================================================
   Protected route rules
   ========================================================= */

const PROTECTED_ROUTE_RULES: {
  prefix: string;
  roles: AppUser["role"][];
}[] = [
  {
    prefix:
      "/dashboard/head-office",
    roles: [
      "本部管理者",
    ],
  },

  {
    prefix:
      "/dashboard/school",
    roles: [
      "校舎管理者",
    ],
  },

  {
    prefix:
      "/dashboard/teacher",
    roles: [
      "講師",
    ],
  },

  {
    prefix:
      "/dashboard/student",
    roles: [
      "生徒",
    ],
  },

  {
    prefix:
      "/schools",
    roles: [
      "本部管理者",
    ],
  },

  {
    prefix:
      "/users",
    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    prefix:
      "/students",
    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    prefix:
      "/tests",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/answers",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/grading",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/retests",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/results/management",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/reports/management",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/qr-stickers",
    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    prefix:
      "/settings",
    roles: [
      "本部管理者",
    ],
  },
];

/* =========================================================
   Guard
   ========================================================= */

export default function AuthGuard({
  children,
  allowedRoles,
  redirectTo,
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
    checking,
    setChecking,
  ] =
    useState(true);

  const [
    denied,
    setDenied,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /* =======================================================
     Auth observer
     ======================================================= */

  useEffect(() => {
    let mounted =
      true;

    const unsubscribe =
      observeAuth(
        async (
          authenticatedUser
        ) => {
          if (
            !mounted
          ) {
            return;
          }

          /*
           * 未ログイン。
           */
          if (
            !authenticatedUser
          ) {
            setUser(
              null
            );

            setDenied(
              false
            );

            setChecking(
              false
            );

            /*
             * ログイン画面自体からは
             * redirectしない。
             */
            if (
              pathname !==
              "/login"
            ) {
              router.replace(
                "/login"
              );
            }

            return;
          }

          /*
           * Firestoreのユーザー情報を
           * 再取得して権限を確認。
           */
          try {
            const freshUser =
              await getAppUser(
                auth.currentUser
              );

            if (
              !mounted
            ) {
              return;
            }

            if (
              !freshUser
            ) {
              setUser(
                null
              );

              setChecking(
                false
              );

              router.replace(
                "/login"
              );

              return;
            }

            if (
              freshUser.active ===
              false
            ) {
              setUser(
                null
              );

              setChecking(
                false
              );

              setError(
                "このアカウントは利用停止されています。"
              );

              router.replace(
                "/login"
              );

              return;
            }

            setUser(
              freshUser
            );

            /*
             * URL単位の権限チェック。
             */
            const routeRule =
              findRouteRule(
                pathname
              );

            const roleAllowedByRoute =
              !routeRule ||
              routeRule.roles.includes(
                freshUser.role
              );

            /*
             * ページ側で明示された
             * allowedRolesも確認。
             */
            const roleAllowedByPage =
              !allowedRoles ||
              allowedRoles.length ===
                0 ||
              allowedRoles.includes(
                freshUser.role
              );

            if (
              !roleAllowedByRoute ||
              !roleAllowedByPage
            ) {
              if (
                !mounted
              ) {
                return;
              }

              setDenied(
                true
              );

              setChecking(
                false
              );

              /*
               * 権限のないURLを直接入力しても
               * 本人のダッシュボードへ戻す。
               */
              const dashboard =
                redirectTo ??
                getDashboardPath(
                  freshUser.role
                );

              if (
                pathname !==
                dashboard
              ) {
                router.replace(
                  dashboard
                );
              }

              return;
            }

            /*
             * 権限OK。
             */
            setDenied(
              false
            );

            setChecking(
              false
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
              "AuthGuard user verification error:",
              error
            );

            setError(
              error instanceof Error
                ? error.message
                : "ユーザー権限を確認できませんでした。"
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
            "AuthGuard auth error:",
            observerError
          );

          setError(
            observerError.message ||
              "認証情報を確認できませんでした。"
          );

          setChecking(
            false
          );

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
    pathname,
    router,
    allowedRoles,
    redirectTo,
  ]);

  /* =======================================================
     Loading
     ======================================================= */

  if (
    checking
  ) {
    return (
      <AuthLoading />
    );
  }

  /* =======================================================
     Error
     ======================================================= */

  if (
    error
  ) {
    return (
      <AuthError
        message={
          error
        }
      />
    );
  }

  /* =======================================================
     Denied
     ======================================================= */

  if (
    denied
  ) {
    return (
      <AccessDenied
        user={
          user
        }
      />
    );
  }

  /* =======================================================
     No user
     ======================================================= */

  if (
    !user
  ) {
    return (
      <AuthLoading />
    );
  }

  /* =======================================================
     Protected content
     ======================================================= */

  return (
    <>
      {children}
    </>
  );
}

/* =========================================================
   Find route rule
   ========================================================= */

function findRouteRule(
  pathname: string
) {
  /*
   * より長いprefixを先に評価。
   *
   * 例:
   * /results/management
   * が
   * /results
   * のルールに負けないようにする。
   */
  const rules =
    [...PROTECTED_ROUTE_RULES].sort(
      (
        a,
        b
      ) =>
        b.prefix.length -
        a.prefix.length
    );

  return rules.find(
    (
      rule
    ) =>
      pathname ===
        rule.prefix ||
      pathname.startsWith(
        `${rule.prefix}/`
      )
  );
}

/* =========================================================
   Loading UI
   ========================================================= */

function AuthLoading() {
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
            30,

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
        <div
          style={{
            fontSize:
              13,

            fontWeight:
              600,
          }}
        >
          テストシステム
        </div>

        <div
          style={{
            marginTop:
              12,

            color:
              "#666",

            fontSize:
              12,
          }}
        >
          認証情報を確認しています...
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   Error UI
   ========================================================= */

function AuthError({
  message,
}: {
  message: string;
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
            460,

          padding:
            30,

          background:
            "#fff",

          border:
            "1px solid #e5e5e5",

          borderRadius:
            10,
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
          認証エラー
        </h1>

        <p
          style={{
            marginTop:
              10,

            color:
              "#666",

            fontSize:
              13,
          }}
        >
          {
            message
          }
        </p>

        <a
          href="/login"
          className="button"
          style={{
            display:
              "inline-block",

            marginTop:
              12,

            textDecoration:
              "none",
          }}
        >
          ログイン画面へ
        </a>
      </section>
    </main>
  );
}

/* =========================================================
   Access denied
   ========================================================= */

function AccessDenied({
  user,
}: {
  user:
    | AppUser
    | null;
}) {
  const dashboard =
    getDashboardPath(
      user?.role
    );

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
            460,

          padding:
            30,

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
          この画面は利用できません
        </h1>

        <p
          style={{
            marginTop:
              10,

            color:
              "#666",

            fontSize:
              13,

            lineHeight:
              1.7,
          }}
        >
          現在のアカウントには、この画面を利用する権限がありません。
        </p>

        <a
          href={
            dashboard
          }
          className="button"
          style={{
            display:
              "inline-block",

            marginTop:
              12,

            textDecoration:
              "none",
          }}
        >
          ホームへ
        </a>
      </section>
    </main>
  );
}
