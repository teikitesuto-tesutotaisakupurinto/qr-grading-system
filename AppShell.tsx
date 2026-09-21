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

import {
  hasPermission,
  type Permission,
} from "@/lib/permissions";

import type {
  UserRole,
} from "@/lib/types";

type UserProfile = {
  uid: string;

  organizationId:
    | string
    | null;

  role:
    | UserRole
    | null;

  schoolIds: string[];

  name: string;

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

  permission: Permission;
};

type MenuSection = {
  label: string;

  items: MenuItem[];
};

const MENU_SECTIONS: MenuSection[] =
  [
    {
      label: "メイン",

      items: [
        {
          label: "ダッシュボード",

          href: "/dashboard",

          permission:
            "dashboard.view",
        },
      ],
    },

    {
      label: "生徒・テスト",

      items: [
        {
          label: "生徒管理",

          href: "/students",

          permission:
            "students.view",
        },

        {
          label: "テスト管理",

          href: "/tests",

          permission:
            "tests.view",
        },
      ],
    },

    {
      label: "答案・採点",

      items: [
        {
          label: "答案管理",

          href: "/answers",

          permission:
            "answers.view",
        },

        {
          label: "一次確認",

          href: "/grading/review",

          permission:
            "grading.firstReview",
        },

        {
          label: "二次確認",

          href: "/grading/second-review",

          permission:
            "grading.secondReview",
        },
      ],
    },

    {
      label: "成績",

      items: [
        {
          label: "成績管理",

          href: "/results",

          permission:
            "results.view",
        },

        {
          label: "成績表",

          href: "/report-cards",

          permission:
            "reportCards.view",
        },

        {
          label: "追試管理",

          href: "/retests",

          permission:
            "retests.view",
        },
      ],
    },

    {
      label: "QR",

      items: [
        {
          label: "QRシール発行",

          href: "/qr-stickers",

          permission:
            "qr.view",
        },
      ],
    },

    {
      label: "管理",

      items: [
        {
          label: "校舎管理",

          href: "/schools",

          permission:
            "schools.view",
        },

        {
          label: "講師管理",

          href: "/teachers",

          permission:
            "teachers.view",
        },

        {
          label: "権限管理",

          href: "/roles",

          permission:
            "roles.view",
        },

        {
          label: "利用状況",

          href: "/usage",

          permission:
            "usage.view",
        },

        {
          label: "システムログ",

          href: "/logs",

          permission:
            "logs.view",
        },

        {
          label: "システム設定",

          href: "/settings",

          permission:
            "settings.view",
        },
      ],
    },
  ];

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
  ] = useState<UserProfile | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    authError,
    setAuthError,
  ] = useState("");

  /*
   * ========================================================
   * Firebase Auth
   * ========================================================
   */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          /*
           * 未ログインでも
           * 勝手に何度もloginへ飛ばさない。
           *
           * 認証状態を確認してから
           * 1回だけ処理する。
           */

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
            const userRef =
              doc(
                db,
                "users",
                firebaseUser.uid
              );

            const snapshot =
              await getDoc(
                userRef
              );

            if (
              !snapshot.exists()
            ) {
              setAuthError(
                "ユーザー情報が登録されていません。"
              );

              setUser(
                null
              );

              setLoading(
                false
              );

              return;
            }

            const data =
              snapshot.data();

            const role =
              isUserRole(
                data.role
              )
                ? data.role
                : null;

            const profile: UserProfile =
              {
                uid:
                  firebaseUser.uid,

                organizationId:
                  typeof data.organizationId ===
                  "string"
                    ? data.organizationId
                    : null,

                role,

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

                name:
                  typeof data.name ===
                  "string"
                    ? data.name
                    : firebaseUser.displayName ??
                      "",

                studentId:
                  typeof data.studentId ===
                  "string"
                    ? data.studentId
                    : null,
              };

            setUser(
              profile
            );

            setAuthError(
              ""
            );
          } catch (
            error
          ) {
            console.error(
              "AppShell user loading error:",
              error
            );

            setAuthError(
              getSafeErrorMessage(
                error
              )
            );

            setUser(
              null
            );
          } finally {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /*
   * ========================================================
   * ログイン画面はShellを表示しない
   * ========================================================
   */

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
        {
          children
        }
      </>
    );
  }

  /*
   * ========================================================
   * Loading
   * ========================================================
   */

  if (
    loading
  ) {
    return (
      <div
        style={
          loadingStyle
        }
      >
        <div>
          認証情報を確認しています...
        </div>
      </div>
    );
  }

  /*
   * ========================================================
   * 未認証
   * ========================================================
   *
   * ここでは自動redirectを連発しない。
   *
   * Middleware側で未認証ページを
   * 制御する場合もあるため、
   * Shellでは安全な表示だけにする。
   */

  if (
    !user
  ) {
    return (
      <div
        style={
          unauthorizedStyle
        }
      >
        <div
          style={
            unauthorizedCardStyle
          }
        >
          <h1>
            ログインが必要です
          </h1>

          <p>
            {authError ||
              "この画面を利用するにはログインしてください。"}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/login"
              )
            }
            style={
              primaryButton
            }
          >
            ログイン画面へ
          </button>
        </div>
      </div>
    );
  }

  /*
   * ========================================================
   * Menu
   * ========================================================
   *
   * 権限のないメニューは
   * 最初から生成しない。
   */

  const visibleSections =
    getVisibleSections(
      user.role
    );

  /*
   * ========================================================
   * Logout
   * ======================================================== */

  async function handleLogout() {
    try {
      await signOut(
        auth
      );

      /*
       * 明示的なログアウトだけ
       * loginへ移動。
       */
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
    }
  }

  /*
   * ========================================================
   * Render
   * ======================================================== */

  return (
    <div
      style={
        shellStyle
      }
    >
      <aside
        style={
          sidebarStyle
        }
      >
        {/* ================================================
            Logo
            ================================================ */}

        <div
          style={
            logoAreaStyle
          }
        >
          <Link
            href="/dashboard"
            style={
              logoLinkStyle
            }
          >
            QR採点システム
          </Link>
        </div>

        {/* ================================================
            User
            ================================================ */}

        <div
          style={
            userAreaStyle
          }
        >
          <div
            style={
              userNameStyle
            }
          >
            {
              user.name ||
              "ユーザー"
            }
          </div>

          <div
            style={
              roleBadgeStyle
            }
          >
            {
              user.role ??
              "権限未設定"
            }
          </div>
        </div>

        {/* ================================================
            Navigation
            ================================================ */}

        <nav
          style={
            navStyle
          }
        >
          {visibleSections.map(
            (
              section
            ) => (
              <div
                key={
                  section.label
                }
                style={
                  sectionStyle
                }
              >
                <div
                  style={
                    sectionTitleStyle
                  }
                >
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
                        style={{
                          ...menuItemStyle,

                          ...(active
                            ? activeMenuItemStyle
                            : {}),
                        }}
                      >
                        {
                          item.label
                        }
                      </Link>
                    );
                  }
                )}
              </div>
            )
          )}
        </nav>

        {/* ================================================
            Logout
            ================================================ */}

        <div
          style={
            sidebarFooterStyle
          }
        >
          <button
            type="button"
            onClick={
              handleLogout
            }
            style={
              logoutButtonStyle
            }
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* ==================================================
          Main
          ================================================== */}

      <div
        style={
          contentStyle
        }
      >
        <header
          style={
            topbarStyle
          }
        >
          <div>
            <span
              style={
                topbarRoleStyle
              }
            >
              {
                user.role
              }
            </span>
          </div>

          <div
            style={{
              fontSize:
                13,

              color:
                "#666",
            }}
          >
            {
              user.name
            }
          </div>
        </header>

        <main
          style={
            mainStyle
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   Visible sections
   ========================================================= */

function getVisibleSections(
  role:
    | UserRole
    | null
    | undefined
): MenuSection[] {
  if (
    !role
  ) {
    return [];
  }

  return MENU_SECTIONS.map(
    (
      section
    ) => ({
      ...section,

      items:
        section.items.filter(
          (
            item
          ) =>
            hasPermission(
              role,
              item.permission
            )
        ),
    })
  ).filter(
    (
      section
    ) =>
      section.items.length >
      0
  );
}

/* =========================================================
   Path
   ========================================================= */

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
      href
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

/* =========================================================
   Role
   ========================================================= */

function isUserRole(
  value: unknown
): value is UserRole {
  return (
    value ===
      "本部管理者" ||
    value ===
      "校舎管理者" ||
    value ===
      "講師" ||
    value ===
      "生徒"
  );
}

/* =========================================================
   Error
   ========================================================= */

function getSafeErrorMessage(
  error: unknown
) {
  const value =
    error as {
      code?: string;
    };

  switch (
    value?.code
  ) {
    case "permission-denied":
      return "この操作を行う権限がありません。";

    case "unauthenticated":
      return "ログイン状態を確認できません。";

    case "unavailable":
      return "サーバーに接続できませんでした。";

    default:
      return "ユーザー情報を取得できませんでした。";
  }
}

/* =========================================================
   Styles
   ========================================================= */

const shellStyle:
  React.CSSProperties = {
    display:
      "flex",

    minHeight:
      "100vh",

    background:
      "#f5f6f8",
  };

const sidebarStyle:
  React.CSSProperties = {
    position:
      "fixed",

    top: 0,

    left: 0,

    bottom: 0,

    width:
      250,

    display:
      "flex",

    flexDirection:
      "column",

    background:
      "#fff",

    borderRight:
      "1px solid #e1e4e8",

    zIndex:
      100,
  };

const logoAreaStyle:
  React.CSSProperties = {
    padding:
      "22px 20px",

    borderBottom:
      "1px solid #eee",
  };

const logoLinkStyle:
  React.CSSProperties = {
    color:
      "#111",

    textDecoration:
      "none",

    fontSize:
      18,

    fontWeight:
      800,
  };

const userAreaStyle:
  React.CSSProperties = {
    padding:
      "16px 20px",

    borderBottom:
      "1px solid #eee",
  };

const userNameStyle:
  React.CSSProperties = {
    fontWeight:
      700,

    fontSize:
      14,
  };

const roleBadgeStyle:
  React.CSSProperties = {
    display:
      "inline-block",

    marginTop:
      6,

    padding:
      "4px 8px",

    borderRadius:
      999,

    background:
      "#f2f2f2",

    color:
      "#555",

    fontSize:
      11,

    fontWeight:
      600,
  };

const navStyle:
  React.CSSProperties = {
    flex:
      1,

    overflowY:
      "auto",

    padding:
      "12px 10px",
  };

const sectionStyle:
  React.CSSProperties = {
    marginBottom:
      18,
  };

const sectionTitleStyle:
  React.CSSProperties = {
    padding:
      "7px 10px",

    color:
      "#999",

    fontSize:
      10,

    fontWeight:
      700,

    letterSpacing:
      "0.05em",
  };

const menuItemStyle:
  React.CSSProperties = {
    display:
      "block",

    padding:
      "10px",

    borderRadius:
      7,

    color:
      "#444",

    textDecoration:
      "none",

    fontSize:
      13,

    fontWeight:
      500,
  };

const activeMenuItemStyle:
  React.CSSProperties = {
    background:
      "#111",

    color:
      "#fff",

    fontWeight:
      700,
  };

const sidebarFooterStyle:
  React.CSSProperties = {
    padding:
      14,

    borderTop:
      "1px solid #eee",
  };

const logoutButtonStyle:
  React.CSSProperties = {
    width:
      "100%",

    padding:
      "10px",

    border:
      "1px solid #ddd",

    borderRadius:
      7,

    background:
      "#fff",

    cursor:
      "pointer",

    fontSize:
      13,
  };

const contentStyle:
  React.CSSProperties = {
    width:
      "100%",

    marginLeft:
      250,
  };

const topbarStyle:
  React.CSSProperties = {
    height:
      58,

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    padding:
      "0 24px",

    background:
      "#fff",

    borderBottom:
      "1px solid #e1e4e8",
  };

const topbarRoleStyle:
  React.CSSProperties = {
    fontSize:
      12,

    fontWeight:
      600,

    color:
      "#666",
  };

const mainStyle:
  React.CSSProperties = {
    minHeight:
      "calc(100vh - 58px)",

    padding:
      0,
  };

const loadingStyle:
  React.CSSProperties = {
    minHeight:
      "100vh",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    color:
      "#666",

    background:
      "#f5f6f8",
  };

const unauthorizedStyle:
  React.CSSProperties = {
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
      "#f5f6f8",
  };

const unauthorizedCardStyle:
  React.CSSProperties = {
    width:
      "100%",

    maxWidth:
      440,

    padding:
      32,

    background:
      "#fff",

    border:
      "1px solid #e1e4e8",

    borderRadius:
      12,

    textAlign:
      "center",
  };

const primaryButton:
  React.CSSProperties = {
    width:
      "100%",

    marginTop:
      16,

    padding:
      "12px 20px",

    border:
      "none",

    borderRadius:
      7,

    background:
      "#111",

    color:
      "#fff",

    cursor:
      "pointer",

    fontWeight:
      600,
  };
