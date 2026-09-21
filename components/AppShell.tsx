"use client";

import {
  ReactNode,
  useEffect,
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
} from "@/lib/types";

type AppShellProps = {
  children: ReactNode;
};

type AppUser = {
  uid: string;
  role: UserRole | null;
  organizationId: string | null;
  schoolIds: string[];
  studentId: string | null;
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
        label: "講師・ユーザー管理",
        href: "/users",
      },
      {
        label: "利用状況",
        href: "/dashboard",
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
        label: "校舎設定",
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
    error,
    setError,
  ] =
    useState("");

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);

  /* =======================================================
     Authentication
     ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (
            !firebaseUser
          ) {
            setUser(null);
            setLoading(false);
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
              !snapshot.exists()
            ) {
              setUser(null);

              setError(
                "ユーザー情報が登録されていません。"
              );

              setLoading(false);

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
                typeof data.organizationId ===
                "string"
                  ? data.organizationId
                  : null,

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
                typeof data.studentId ===
                "string"
                  ? data.studentId
                  : null,
            });

            setError("");
          } catch (
            error
          ) {
            console.error(
              error
            );

            setUser(null);

            setError(
              "ユーザー情報を取得できませんでした。"
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================================
     Login page
     ======================================================= */

  if (
    pathname === "/login" ||
    pathname.startsWith(
      "/login/"
    )
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
        <div>
          <div className="ts-brand">
            Tsystem
          </div>

          <p className="ts-loading-text">
            読み込み中...
          </p>
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
        <div className="ts-error-card">
          <div className="ts-brand">
            Tsystem
          </div>

          <h1>
            ログインが必要です
          </h1>

          <p>
            {error ||
              "この画面を利用するにはログインしてください。"}
          </p>

          <button
            type="button"
            className="ts-primary"
            onClick={() =>
              router.push(
                "/login"
              )
            }
          >
            ログイン画面へ
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     Role missing
     ======================================================= */

  if (
    !user.role
  ) {
    return (
      <div className="ts-center">
        <div className="ts-error-card">
          <div className="ts-brand">
            Tsystem
          </div>

          <h1>
            権限がありません
          </h1>

          <p>
            管理者に権限設定を確認してください。
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     Menu
     ======================================================= */

  const menu =
    getMenuForRole(
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
      setLoggingOut(true);

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
        error
      );

      setError(
        "ログアウトできませんでした。"
      );

      setLoggingOut(false);
    }
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <div className="ts-shell">
      <aside className="ts-sidebar">
        <div className="ts-logo">
          <Link href="/dashboard">
            Tsystem
          </Link>
        </div>

        <nav className="ts-menu">
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
      return "本部管理者";

    case "校舎管理者":
    case "school_admin":
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
) {
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
  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`
    )
  );
}
