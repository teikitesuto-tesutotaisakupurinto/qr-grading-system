
"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import type {
  UserRole,
} from "@/types";

/* =========================================================
   Types
   ========================================================= */

type AppUser = {
  uid: string;

  role: UserRole | null;

  organizationId:
    | string
    | null;

  schoolIds: string[];

  studentId:
    | string
    | null;
};

type AppShellProps = {
  children: ReactNode;
};

type MenuItem = {
  label: string;

  href: string;
};

type MenuSection = {
  label: string;

  items: MenuItem[];
};

/* =========================================================
   本部管理者
   ========================================================= */

const HEAD_OFFICE_MENU: MenuSection[] = [
  {
    label: "メイン",

    items: [
      {
        label: "ダッシュボード",
        href: "/dashboard",
      },
    ],
  },

  {
    label: "生徒・テスト",

    items: [
      {
        label: "生徒管理",
        href: "/students",
      },

      {
        label: "テスト管理",
        href: "/tests",
      },
    ],
  },

  {
    label: "答案・採点",

    items: [
      {
        label: "答案管理",
        href: "/answers",
      },

      {
        label: "採点管理",
        href: "/grading",
      },

      {
        label: "一次確認",
        href: "/grading/review",
      },

      {
        label: "二次確認",
        href: "/grading/second-review",
      },

      {
        label: "採点確定",
        href: "/grading/confirm",
      },
    ],
  },

  {
    label: "成績",

    items: [
      {
        label: "成績",
        href: "/results",
      },

      {
        label: "成績表",
        href: "/reports",
      },

      {
        label: "追試",
        href: "/retests",
      },
    ],
  },

  {
    label: "QR",

    items: [
      {
        label: "QRシール発行",
        href: "/qr-stickers",
      },
    ],
  },

  {
    label: "本部管理",

    items: [
      {
        label: "校舎管理",
        href: "/schools",
      },

      {
        label: "ユーザー管理",
        href: "/users",
      },

      {
        label: "システム設定",
        href: "/settings",
      },
    ],
  },
];

/* =========================================================
   校舎管理者
   ========================================================= */

const SCHOOL_ADMIN_MENU: MenuSection[] = [
  {
    label: "メイン",

    items: [
      {
        label: "ダッシュボード",
        href: "/dashboard",
      },
    ],
  },

  {
    label: "生徒・テスト",

    items: [
      {
        label: "生徒管理",
        href: "/students",
      },

      {
        label: "テスト管理",
        href: "/tests",
      },
    ],
  },

  {
    label: "答案・採点",

    items: [
      {
        label: "答案管理",
        href: "/answers",
      },

      {
        label: "採点管理",
        href: "/grading",
      },

      {
        label: "一次確認",
        href: "/grading/review",
      },

      {
        label: "二次確認",
        href: "/grading/second-review",
      },

      {
        label: "採点確定",
        href: "/grading/confirm",
      },
    ],
  },

  {
    label: "成績",

    items: [
      {
        label: "成績",
        href: "/results",
      },

      {
        label: "成績表",
        href: "/reports",
      },

      {
        label: "追試",
        href: "/retests",
      },
    ],
  },

  {
    label: "QR",

    items: [
      {
        label: "QRシール発行",
        href: "/qr-stickers",
      },
    ],
  },

  {
    label: "校舎運用",

    items: [
      {
        label: "ユーザー管理",
        href: "/users",
      },

      {
        label: "設定",
        href: "/settings",
      },
    ],
  },
];

/* =========================================================
   講師
   ========================================================= */

const TEACHER_MENU: MenuSection[] = [
  {
    label: "メイン",

    items: [
      {
        label: "ダッシュボード",
        href: "/dashboard",
      },
    ],
  },

  {
    label: "授業・テスト",

    items: [
      {
        label: "テスト",
        href: "/tests",
      },
    ],
  },

  {
    label: "答案・採点",

    items: [
      {
        label: "答案管理",
        href: "/answers",
      },

      {
        label: "採点管理",
        href: "/grading",
      },

      {
        label: "一次確認",
        href: "/grading/review",
      },

      {
        label: "二次確認",
        href: "/grading/second-review",
      },

      {
        label: "採点確定",
        href: "/grading/confirm",
      },
    ],
  },

  {
    label: "成績",

    items: [
      {
        label: "成績",
        href: "/results",
      },

      {
        label: "成績表",
        href: "/reports",
      },

      {
        label: "追試",
        href: "/retests",
      },
    ],
  },

  {
    label: "QR",

    items: [
      {
        label: "QRシール発行",
        href: "/qr-stickers",
      },
    ],
  },
];

/* =========================================================
   生徒
   ========================================================= */

const STUDENT_MENU: MenuSection[] = [
  {
    label: "メイン",

    items: [
      {
        label: "ダッシュボード",
        href: "/dashboard",
      },
    ],
  },

  {
    label: "学習",

    items: [
      {
        label: "成績",
        href: "/results",
      },

      {
        label: "成績表",
        href: "/reports",
      },
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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    authError,
    setAuthError,
  ] =
    useState("");

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);

  /* =======================================================
     Firebase Authentication
     ======================================================= */

  useEffect(() => {
    let disposed =
      false;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (
            disposed
          ) {
            return;
          }

          if (
            !firebaseUser
          ) {
            setUser(
              null
            );

            setLoading(
              false
            );

            return;
          }

          try {
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  firebaseUser.uid
                )
              );

            if (
              disposed
            ) {
              return;
            }

            if (
              !snapshot.exists()
            ) {
              setUser(
                null
              );

              setAuthError(
                "ユーザー情報が登録されていません。"
              );

              setLoading(
                false
              );

              return;
            }

            const data =
              snapshot.data();

            setUser({
              uid:
                firebaseUser.uid,

              role:
                normalizeRole(
                  data.role
                ),

              organizationId:
                stringOrNull(
                  data.organizationId
                ),

              schoolIds:
                Array.isArray(
                  data.schoolIds
                )
                  ? data.schoolIds.filter(
                      (
                        value
                      ): value is string =>
                        typeof value ===
                        "string"
                    )
                  : [],

              studentId:
                stringOrNull(
                  data.studentId
                ),
            });

            setAuthError("");
          } catch (
            error
          ) {
            console.error(
              "Authentication error:",
              error
            );

            if (
              disposed
            ) {
              return;
            }

            setUser(
              null
            );

            setAuthError(
              "ユーザー情報を取得できませんでした。"
            );
          } finally {
            if (
              !disposed
            ) {
              setLoading(
                false
              );
            }
          }
        }
      );

    return () => {
      disposed =
        true;

      unsubscribe();
    };
  }, []);

  /* =======================================================
     Public routes
     ======================================================= */

  const isLoginPage =
    pathname ===
      "/login" ||
    pathname.startsWith(
      "/login/"
    );

  if (
    isLoginPage
  ) {
    return (
      <>
        {children}
      </>
    );
  }

  /* =======================================================
     Loading
     ======================================================= */

  if (
    loading
  ) {
    return (
      <div className="ts-loading">
        <div className="ts-loading-inner">
          <div className="ts-brand">
            テストシステム
          </div>

          <div className="ts-loading-text">
            認証情報を確認しています...
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     Unauthenticated
     ======================================================= */

  if (
    !user
  ) {
    return (
      <div className="ts-center">
        <section className="ts-error-card">
          <div className="ts-brand">
            テストシステム
          </div>

          <h1>
            ログインが必要です
          </h1>

          <p>
            {authError ||
              "この画面を利用するにはログインしてください。"}
          </p>

          <button
            type="button"
            className="ts-primary"
            onClick={() =>
              router.replace(
                "/login"
              )
            }
          >
            ログイン画面へ
          </button>
        </section>
      </div>
    );
  }

  /* =======================================================
     Invalid role
     ======================================================= */

  if (
    !user.role
  ) {
    return (
      <div className="ts-center">
        <section className="ts-error-card">
          <div className="ts-brand">
            テストシステム
          </div>

          <h1>
            権限が設定されていません
          </h1>

          <p>
            管理者にアカウントの権限設定を確認してください。
          </p>
        </section>
      </div>
    );
  }

  /* =======================================================
     Role menu
     ======================================================= */

  const menu =
    useMemo(
      () =>
        getMenuForRole(
          user.role
        ),
      [
        user.role,
      ]
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

      await signOut(
        auth
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

      setAuthError(
        "ログアウトできませんでした。"
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
    <div className="ts-shell">
      <aside className="ts-sidebar">

        {/* Logo */}

        <div className="ts-logo">
          <Link
            href="/dashboard"
            className="ts-logo-link"
          >
            テストシステム
          </Link>
        </div>

        {/* Menu */}

        <nav
          className="ts-menu"
          aria-label="メインメニュー"
        >
          {menu.map(
            (
              section
            ) => (
              <section
                key={
                  section.label
                }
                className="ts-menu-section"
              >
                <div className="ts-section-title">
                  {
                    section.label
                  }
                </div>

                {section.items.map(
                  (
                    item
                  ) => {
                    const active =
                      isActivePath(
                        pathname,
                        item.href
                      );

                    return (
                      <Link
                        key={
                          item.href
                        }
                        href={
                          item.href
                        }
                        className={
                          active
                            ? "ts-menu-item active"
                            : "ts-menu-item"
                        }
                      >
                        {
                          item.label
                        }
                      </Link>
                    );
                  }
                )}
              </section>
            )
          )}
        </nav>

        {/* Footer */}

        <div className="ts-sidebar-bottom">
          <button
            type="button"
            className="ts-logout"
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
      </aside>

      <main className="ts-main">
        {children}
      </main>
    </div>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function normalizeRole(
  value: unknown
): UserRole | null {
  switch (
    value
  ) {
    case "本部管理者":
    case "hq":
    case "head_office":
    case "headOfficeAdmin":
      return "本部管理者";

    case "校舎管理者":
    case "school_admin":
    case "schoolAdmin":
      return "校舎管理者";

    case "講師":
    case "teacher":
      return "講師";

    case "生徒":
    case "student":
      return "生徒";

    default:
      return null;
  }
}

function getMenuForRole(
  role: UserRole
): MenuSection[] {
  switch (
    role
  ) {
    case "本部管理者":
      return HEAD_OFFICE_MENU;

    case "校舎管理者":
      return SCHOOL_ADMIN_MENU;

    case "講師":
      return TEACHER_MENU;

    case "生徒":
      return STUDENT_MENU;

    default:
      return [];
  }
}

function isActivePath(
  pathname: string,
  href: string
) {
  if (
    href ===
    "/dashboard"
  ) {
    return (
      pathname ===
      "/dashboard"
    );
  }

  return (
    pathname ===
      href ||
    pathname.startsWith(
      `${href}/`
    )
  );
}

function stringOrNull(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : null;
}
