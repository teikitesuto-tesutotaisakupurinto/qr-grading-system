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
   ========================================================= */

const MENU_SECTIONS: MenuSection[] = [
  {
    label: "メイン",

    items: [
      {
        label: "ダッシュボード",
        href: "/dashboard",
        permission: "dashboard.view",
      },
    ],
  },

  {
    label: "生徒・テスト",

    items: [
      {
        label: "生徒管理",
        href: "/students",
        permission: "students.view",
      },

      {
        label: "テスト管理",
        href: "/tests",
        permission: "tests.view",
      },
    ],
  },

  {
    label: "答案・採点",

    items: [
      {
        label: "答案管理",
        href: "/answers",
        permission: "answers.view",
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
        permission: "results.view",
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
        permission: "retests.view",
      },
    ],
  },

  {
    label: "QR",

    items: [
      {
        label: "QRシール発行",
        href: "/qr-stickers",
        permission: "qr.view",
      },
    ],
  },

  {
    label: "管理",

    items: [
      {
        label: "校舎管理",
        href: "/schools",
        permission: "schools.view",
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
        permission: "roles.view",
      },

      {
        label: "利用状況",
        href: "/usage",
        permission: "usage.view",
      },

      {
        label: "システムログ",
        href: "/logs",
        permission: "logs.view",
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
  const router = useRouter();

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

  /* =======================================================
     Authentication
     ======================================================= */

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
           * ログアウト状態。
           *
           * 勝手にログイン画面へ
           * リダイレクトしない。
           */
          if (!firebaseUser) {
            setUser(null);

            setLoading(false);

            return;
          }

          try {
            const userSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  firebaseUser.uid
                )
              );

            if (!mounted) {
              return;
            }

            if (
              !userSnapshot.exists()
            ) {
              setUser(null);

              setAuthError(
                "システムのユーザー情報が登録されていません。"
              );

              setLoading(false);

              return;
            }

            const data =
              userSnapshot.data();

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

            setAuthError("");
          } catch (
            error
          ) {
            console.error(
              "AppShell authentication error:",
              error
            );

            if (!mounted) {
              return;
            }

            setUser(null);

            setAuthError(
              getSafeErrorMessage(
                error
              )
            );
          } finally {
            if (mounted) {
              setLoading(false);
            }
          }
        }
      );

    return () => {
      mounted = false;

      unsubscribe();
    };
  }, []);

  /* =======================================================
     Special pages
     ======================================================= */

  const isLoginPage =
    pathname === "/login" ||
    pathname.startsWith(
      "/login/"
    );

  const isForbiddenPage =
    pathname === "/403";

  /*
   * Login pageはShellなし。
   */
  if (isLoginPage) {
    return (
      <>
        {children}
      </>
    );
  }

  /*
   * 403ページはShellなし。
   */
  if (isForbiddenPage) {
    return (
      <>
        {children}
      </>
    );
  }

  /* =======================================================
     Loading
     ======================================================= */

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  /* =======================================================
     Unauthenticated
     ======================================================= */

  if (!user) {
    return (
      <UnauthorizedScreen
        message={
          authError ||
          "この画面を利用するにはログインしてください。"
        }
        onLogin={() =>
          router.push(
            "/login"
          )
        }
      />
    );
  }

  /* =======================================================
     Role missing
     ======================================================= */

  if (!user.role) {
    return (
      <ForbiddenScreen
        message="このアカウントには権限が設定されていません。管理者に確認してください。"
      />
    );
  }

  /* =======================================================
     Route permission
     ======================================================= */

  const routeAllowed =
    canAccessRoute(
      user.role,
      pathname
    );

  if (!routeAllowed) {
    return (
      <ForbiddenScreen
        message="このページを利用する権限がありません。"
      />
    );
  }

  /* =======================================================
     Visible menu
     ======================================================= */

  const visibleSections =
    getVisibleSections(
      user.role
    );

  /* =======================================================
     Logout
     ======================================================= */

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(
        true
      );

      setAuthError("");

      await signOut(
        auth
      );

      /*
       * 明示的なログアウト時だけ
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

      setLoggingOut(
        false
      );
    }
  }

  /* =======================================================
     Render
     ======================================================= */

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
              getRoleLabel(
                user.role
              )
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
                     * 念のため描画直前にも
                     * 権限チェック。
                     *
                     * 権限がなければ
                     * DOMにも出さない。
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

                    /*
                     * 生徒の場合、
                     * 成績管理という名前より
                     * 「成績」の方が自然。
                     */
                    const label =
                      getMenuLabel(
                        user.role,
                        item
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
                          label
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
          Main content
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
          <div
            style={
              topbarRoleContainerStyle
            }
          >
            <span
              style={
                topbarRoleStyle
              }
            >
              {
                getRoleLabel(
                  user.role
                )
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
   Menu filtering
   ========================================================= */

function getVisibleSections(
  role:
    | UserRole
    | null
    | undefined
): MenuSection[] {
  if (!role) {
    return [];
  }

  return MENU_SECTIONS
    .map(
      (
        section
      ) => {
        const items =
          section.items.filter(
            (
              item
            ) =>
              hasPermission(
                role,
                item.permission
              )
          );

        return {
          ...section,
          items,
        };
      }
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
   Menu labels
   ========================================================= */

function getMenuLabel(
  role: UserRole,
  item: MenuItem
) {
  /*
   * 生徒には「成績管理」ではなく
   * 「成績」と表示。
   */
  if (
    role === "生徒" &&
    item.href === "/results"
  ) {
    return "成績";
  }

  return item.label;
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

function getRoleLabel(
  role:
    | UserRole
    | null
    | undefined
) {
  switch (
    role
  ) {
    case "本部管理者":
      return "本部管理者";

    case "校舎管理者":
      return "校舎管理者";

    case "講師":
      return "講師";

    case "生徒":
      return "生徒";

    default:
      return "権限未設定";
  }
}

/* =========================================================
   Loading
   ========================================================= */

function LoadingScreen() {
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

/* =========================================================
   Unauthorized
   ========================================================= */

function UnauthorizedScreen({
  message,
  onLogin,
}: {
  message: string;

  onLogin: () => void;
}) {
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
          {message}
        </p>

        <button
          type="button"
          onClick={
            onLogin
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

const topbarRoleContainerStyle:
  React.CSSProperties = {
    display:
      "flex",

    alignItems:
      "center",
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
