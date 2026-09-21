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

import {
  canAccessRoute,
} from "@/lib/route-permissions";

import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

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

/* =========================================================
   Menu definition
   =========================================================
   権限のない項目は
   getVisibleSections() で完全に除外する。
   ========================================================= */

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

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  /*
   * =======================================================
   * Firebase Auth
   * =======================================================
   */

  useEffect(() => {
    let mounted = true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (!mounted) {
            return;
          }

          /*
           * 未ログイン
           *
           * ここでは即座に/loginへ飛ばさない。
           * 画面側で状態を表示する。
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

            if (!mounted) {
              return;
            }

            if (
              !snapshot.exists()
            ) {
              setUser(
                null
              );

              setAuthError(
                "システムのユーザー情報が登録されていません。"
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

            if (!mounted) {
              return;
            }

            setUser(
              null
            );

            setAuthError(
              getSafeErrorMessage(
                error
              )
            );
          } finally {
            if (mounted) {
              setLoading(
                false
              );
            }
          }
        }
      );

    return () => {
      mounted = false;

      unsubscribe();
    };
  }, []);

  /*
   * =======================================================
   * Login page
   * =======================================================
   *
   * loginページにはAppShellを付けない。
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
        {children}
      </>
    );
  }

  /*
   * =======================================================
   * 403 page
   * =======================================================
   *
   * 403自体には権限チェックをかけない。
   */

  const isForbiddenPage =
    pathname ===
    "/403";

  if (
    isForbiddenPage
  ) {
    return (
      <>
        {children}
      </>
    );
  }

  /*
   * =======================================================
   * Loading
   * =======================================================
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
        <div
          style={
            loadingCardStyle
          }
        >
          <div
            style={
              loadingTitleStyle
            }
          >
            QR採点システム
          </div>

          <div
            style={
              loadingTextStyle
            }
          >
            認証情報を確認しています...
          </div>
        </div>
      </div>
    );
  }

  /*
   * =======================================================
   * Unauthenticated
   * =======================================================
   *
   * 自動でloginへ戻さない。
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
          <div
            style={{
              fontSize:
                28,

              fontWeight:
                800,

              marginBottom:
                16,
            }}
          >
            QR採点システム
          </div>

          <h1
            style={{
              margin:
                "0 0 10px",

              fontSize:
                22,
            }}
          >
            ログインが必要です
          </h1>

          <p
            style={{
              margin:
                "0 0 20px",

              color:
                "#666",

              lineHeight:
                1.8,
            }}
          >
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
   * =======================================================
   * Role missing
   * =======================================================
   */

  if (
    !user.role
  ) {
    return (
      <ForbiddenScreen
        message="アカウントの権限が設定されていません。管理者に確認してください。"
      />
    );
  }

  /*
   * =======================================================
   * Route permission
   * =======================================================
   *
   * URL直打ち対策。
   *
   * 例:
   * 講師 → /students
   * 生徒 → /settings
   *
   * などを拒否。
   */

  const canAccess =
    canAccessRoute(
      user.role,
      pathname
    );

  if (
    !canAccess
  ) {
    return (
      <ForbiddenScreen
        message="このページを利用する権限がありません。"
      />
    );
  }

  /*
   * =======================================================
   * Visible navigation
   * =======================================================
   */

  const visibleSections =
    useMemo(
      () =>
        getVisibleSections(
          user.role
        ),
      [
        user.role,
      ]
    );

  /*
   * =======================================================
   * Logout
   * =======================================================
   */

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

      setAuthError(
        ""
      );

      await signOut(
        auth
      );

      /*
       * 明示的なログアウトだけ
       * loginへ移動する。
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

      setLoggingOut(
        false
      );
    }
  }

  /*
   * =======================================================
   * Render
   * =======================================================
   */

  return (
    <div
      style={
        shellStyle
      }
    >
      {/* ==================================================
          Sidebar
          ================================================== */}

      <aside
        style={
          sidebarStyle
        }
      >
        {/* Logo */}

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

        {/* User */}

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
            {user.name ||
              "ユーザー"}
          </div>

          <div
            style={
              roleBadgeStyle
            }
          >
            {
              user.role
            }
          </div>
        </div>

        {/* Navigation */}

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
                    /*
                     * 二重チェック。
                     *
                     * MENU側で既に除外しているが、
                     * 描画直前にも確認する。
                     */
                    if (
                      !hasPermission(
                        user.role,
                        item.permission
                      )
                    ) {
                      return null;
                    }

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

        {/* Footer */}

        <div
          style={
            sidebarFooterStyle
          }
        >
          {authError && (
            <div
              style={
                sidebarErrorStyle
              }
            >
              {
                authError
              }
            </div>
          )}

          <button
            type="button"
            disabled={
              loggingOut
            }
            onClick={
              handleLogout
            }
            style={{
              ...logoutButtonStyle,

              opacity:
                loggingOut
                  ? 0.5
                  : 1,
            }}
          >
            {loggingOut
              ? "ログアウト中..."
              : "ログアウト"}
          </button>
        </div>
      </aside>

      {/* ==================================================
          Content
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
            style={
              topbarUserStyle
            }
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
) {
  if (
    !role
  ) {
    return [];
  }

  return MENU_SECTIONS
    .map(
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
    )
    .filter(
      (
        section
      ) =>
        section.items.length >
        0
    );
}

/* =========================================================
   Active path
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

/* =========================================================
   Forbidden
   ========================================================= */

function ForbiddenScreen({
  message,
}: {
  message: string;
}) {
  const router =
    useRouter();

  return (
    <div
      style={
        forbiddenStyle
      }
    >
      <div
        style={
          forbiddenCardStyle
        }
      >
        <div
          style={
            forbiddenCodeStyle
          }
        >
          403
        </div>

        <h1
          style={{
            margin:
              "0 0 10px",
          }}
        >
          権限がありません
        </h1>

        <p
          style={{
            margin:
              "0 0 24px",

            color:
              "#666",

            lineHeight:
              1.8,
          }}
        >
          {message}
        </p>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard"
            )
          }
          style={
            primaryButton
          }
        >
          ダッシュボードへ戻る
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   User Role
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

    case "not-found":
      return "ユーザー情報が見つかりません。";

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

const sidebarErrorStyle:
  React.CSSProperties = {
    marginBottom:
      8,

    padding:
      8,

    borderRadius:
      6,

    background:
      "#fff4f4",

    color:
      "#9b1c1c",

    fontSize:
      11,

    lineHeight:
      1.5,
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

const topbarUserStyle:
  React.CSSProperties = {
    fontSize:
      13,

    color:
      "#666",
  };

const mainStyle:
  React.CSSProperties = {
    minHeight:
      "calc(100vh - 58px)",
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

    background:
      "#f5f6f8",
  };

const loadingCardStyle:
  React.CSSProperties = {
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

const loadingTitleStyle:
  React.CSSProperties = {
    fontSize:
      20,

    fontWeight:
      800,
  };

const loadingTextStyle:
  React.CSSProperties = {
    marginTop:
      10,

    color:
      "#777",

    fontSize:
      13,
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

const forbiddenStyle:
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

const forbiddenCardStyle:
  React.CSSProperties = {
    width:
      "100%",

    maxWidth:
      480,

    padding:
      36,

    background:
      "#fff",

    border:
      "1px solid #e1e4e8",

    borderRadius:
      12,

    textAlign:
      "center",
  };

const forbiddenCodeStyle:
  React.CSSProperties = {
    marginBottom:
      8,

    fontSize:
      48,

    fontWeight:
      800,
  };

const primaryButton:
  React.CSSProperties = {
    width:
      "100%",

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
