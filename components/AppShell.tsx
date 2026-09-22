"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  auth,
} from "@/lib/firebase";

import {
  getAppUser,
  getDashboardPath,
  logout,
  observeAuth,
  type AppUser,
} from "@/lib/auth";

import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Props
   ========================================================= */

type AppShellProps = {
  children: ReactNode;
};

/* =========================================================
   Menu
   ========================================================= */

type MenuItem = {
  href: string;

  label: string;

  description?: string;

  roles: UserRole[];
};

/*
 * 権限のない機能はメニューに表示しない。
 */
const MENU_ITEMS: MenuItem[] = [
  /* -------------------------------------------------------
     Dashboard
     ------------------------------------------------------- */

  {
    href:
      "/dashboard/head-office",

    label:
      "ホーム",

    roles: [
      "本部管理者",
    ],
  },

  {
    href:
      "/dashboard/school",

    label:
      "ホーム",

    roles: [
      "校舎管理者",
    ],
  },

  {
    href:
      "/dashboard/teacher",

    label:
      "ホーム",

    roles: [
      "講師",
    ],
  },

  {
    href:
      "/dashboard/student",

    label:
      "ホーム",

    roles: [
      "生徒",
    ],
  },

  /* -------------------------------------------------------
     Management
     ------------------------------------------------------- */

  {
    href:
      "/schools",

    label:
      "校舎管理",

    description:
      "校舎情報を管理",

    roles: [
      "本部管理者",
    ],
  },

  {
    href:
      "/users",

    label:
      "ユーザー管理",

    description:
      "ユーザーアカウントを管理",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    href:
      "/students",

    label:
      "生徒管理",

    description:
      "生徒情報を管理",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  /* -------------------------------------------------------
     Tests
     ------------------------------------------------------- */

  {
    href:
      "/tests",

    label:
      "テスト管理",

    description:
      "テスト・問題を管理",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* -------------------------------------------------------
     Answers
     ------------------------------------------------------- */

  {
    href:
      "/answers",

    label:
      "答案",

    description:
      "答案画像を管理",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* -------------------------------------------------------
     Grading
     ------------------------------------------------------- */

  {
    href:
      "/grading",

    label:
      "採点",

    description:
      "採点状況を確認",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    href:
      "/grading/auto",

    label:
      "自動採点",

    description:
      "自動採点を実行",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    href:
      "/grading/review",

    label:
      "一次確認",

    description:
      "採点結果を確認",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    href:
      "/grading/second-review",

    label:
      "二次確認",

    description:
      "採点結果を再確認",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    href:
      "/grading/confirm",

    label:
      "採点確定",

    description:
      "採点結果を確定",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* -------------------------------------------------------
     Results
     ------------------------------------------------------- */

  {
    href:
      "/results",

    label:
      "成績",

    description:
      "確定済み成績",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    href:
      "/reports",

    label:
      "成績表",

    description:
      "成績表を作成・確認",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* -------------------------------------------------------
     Retest
     ------------------------------------------------------- */

  {
    href:
      "/retests",

    label:
      "追試",

    description:
      "追試・手動採点",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* -------------------------------------------------------
     QR
     ------------------------------------------------------- */

  {
    href:
      "/qr-stickers",

    label:
      "QRシール",

    description:
      "生徒QRシールを管理",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  /* -------------------------------------------------------
     Settings
     ------------------------------------------------------- */

  {
    href:
      "/settings",

    label:
      "システム設定",

    description:
      "システム設定",

    roles: [
      "本部管理者",
    ],
  },
];

/* =========================================================
   AppShell
   ========================================================= */

export default function AppShell({
  children,
}: AppShellProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<AppUser | null>(
      null
    );

  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(true);

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);

  /* =======================================================
     Authentication
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

          if (
            !authenticatedUser
          ) {
            setUser(
              null
            );

            setAuthLoading(
              false
            );

            return;
          }

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

            setUser(
              freshUser
            );

            setAuthLoading(
              false
            );
          } catch (
            error
          ) {
            console.error(
              "AppShell auth error:",
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

            setAuthLoading(
              false
            );
          }
        },
        (
          error
        ) => {
          console.error(
            "AppShell auth observer error:",
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

          setAuthLoading(
            false
          );
        }
      );

    return () => {
      mounted =
        false;

      unsubscribe();
    };
  }, []);

  /* =======================================================
     Login page
     ======================================================= */

  const isLoginPage =
    pathname ===
      "/login" ||
    pathname.startsWith(
      "/login/"
    );

  const isOnboardingPage =
    pathname ===
      "/onboarding" ||
    pathname.startsWith(
      "/onboarding/"
    );

  /*
   * ログイン・オンボーディングには
   * 管理画面のShellを表示しない。
   */
  if (
    isLoginPage ||
    isOnboardingPage
  ) {
    return (
      <>
        {
          children
        }
      </>
    );
  }

  /* =======================================================
     Authentication loading
     ======================================================= */

  if (
    authLoading
  ) {
    return (
      <LoadingScreen />
    );
  }

  /* =======================================================
     Not authenticated
     ======================================================= */

  if (
    !user
  ) {
    return (
      <LoadingScreen />
    );
  }

  /* =======================================================
     Visible menu
     ======================================================= */

  const visibleMenu =
    MENU_ITEMS.filter(
      (
        item
      ) =>
        item.roles.includes(
          user.role
        )
    );

  /* =======================================================
     Dashboard
     ======================================================= */

  const dashboardPath =
    getDashboardPath(
      user.role
    );

  /* =======================================================
     Logout
     ======================================================= */

  async function handleLogout() {
    if (
      loggingOut
    ) {
      return;
    }

    try {
      setLoggingOut(
        true
      );

      await logout();

      setUser(
        null
      );

      router.replace(
        "/login"
      );
    } catch (
      error
    ) {
      console.error(
        "Logout error:",
        error
      );

      setLoggingOut(
        false
      );
    }
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <div className="appShell">

      {/* ==================================================
          Header
          ================================================== */}

      <header className="appHeader">
        <div className="appHeaderInner">

          <Link
            href={
              dashboardPath
            }
            className="appBrand"
            style={{
              textDecoration:
                "none",

              color:
                "inherit",
            }}
          >
            <strong>
              テストシステム
            </strong>
          </Link>

          <div className="appUserArea">

            <div
              style={{
                textAlign:
                  "right",
              }}
            >
              <div
                style={{
                  fontSize:
                    12,

                  fontWeight:
                    600,
                }}
              >
                {
                  user.name ||
                  "ユーザー"
                }
              </div>

              <div
                className="muted"
                style={{
                  marginTop:
                    2,

                  fontSize:
                    10,
                }}
              >
                {
                  user.role
                }
              </div>
            </div>

            <button
              type="button"
              className="logoutButton"
              disabled={
                loggingOut
              }
              onClick={
                handleLogout
              }
            >
              {loggingOut
                ? "ログアウト中..."
                : "ログアウト"}
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================
          Body
          ================================================== */}

      <div className="appBody">

        {/* =================================================
            Sidebar
            ================================================= */}

        <aside className="appSidebar">
          <nav
            aria-label="メインメニュー"
          >
            <div className="sidebarSection">

              <div className="sidebarTitle">
                メニュー
              </div>

              {visibleMenu.map(
                (
                  item
                ) => (
                  <MenuLink
                    key={
                      item.href
                    }
                    item={
                      item
                    }
                    pathname={
                      pathname
                    }
                  />
                )
              )}
            </div>
          </nav>
        </aside>

        {/* =================================================
            Main
            ================================================= */}

        <main className="appMain">
          {
            children
          }
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   Menu Link
   ========================================================= */

function MenuLink({
  item,
  pathname,
}: {
  item: MenuItem;

  pathname: string;
}) {
  const active =
    pathname ===
      item.href ||
    pathname.startsWith(
      `${item.href}/`
    );

  return (
    <Link
      href={
        item.href
      }
      className={
        active
          ? "sidebarLink active"
          : "sidebarLink"
      }
      aria-current={
        active
          ? "page"
          : undefined
      }
    >
      <span>
        {
          item.label
        }
      </span>

      {item.description && (
        <small>
          {
            item.description
          }
        </small>
      )}
    </Link>
  );
}

/* =========================================================
   Loading
   ========================================================= */

function LoadingScreen() {
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
              18,
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
