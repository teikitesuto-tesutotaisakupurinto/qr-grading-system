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
} from "@/lib/types";

import {
  canAccessRoute,
} from "@/lib/route-permissions";

/* =========================================================
   Types
   ========================================================= */

type AppShellProps = {
  children: ReactNode;
};

type UserProfile = {
  uid: string;

  organizationId:
    | string
    | null;

  role:
    | UserRole
    | null;

  schoolIds: string[];

  studentId:
    | string
    | null;
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
   Role-specific menus
   =========================================================
   共通メニューをフィルタする方式ではなく、
   権限ごとに最初から別メニューを定義する。
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
        label: "一次確認",
        href: "/grading/review",
      },

      {
        label: "二次確認",
        href: "/grading/second-review",
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
        href: "/report-cards",
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
        label: "講師管理",
        href: "/teachers",
      },

      {
        label: "権限管理",
        href: "/roles",
      },

      {
        label: "利用状況",
        href: "/usage",
      },

      {
        label: "システムログ",
        href: "/logs",
      },

      {
        label: "システム設定",
        href: "/settings",
      },
    ],
  },
];

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
        label: "一次確認",
        href: "/grading/review",
      },

      {
        label: "二次確認",
        href: "/grading/second-review",
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
        href: "/report-cards",
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
        label: "利用状況",
        href: "/usage",
      },

      {
        label: "システムログ",
        href: "/logs",
      },
    ],
  },
];

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
    label: "授業",

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
        label: "一次確認",
        href: "/grading/review",
      },

      {
        label: "二次確認",
        href: "/grading/second-review",
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
        href: "/report-cards",
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
        href: "/report-cards",
      },

      {
        label: "学習履歴",
        href: "/learning",
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
    error,
    setError,
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

            if (!mounted) {
              return;
            }

            if (
              !snapshot.exists()
            ) {
              setUser(
                null
              );

              setError(
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

              organizationId:
                typeof data.organizationId ===
                "string"
                  ? data.organizationId
                  : null,

              role:
                isUserRole(
                  data.role
                )
                  ? data.role
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
            err
          ) {
            console.error(
              err
            );

            if (!mounted) {
              return;
            }

            setUser(
              null
            );

            setError(
              getErrorMessage(
                err
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

  /* =======================================================
     Login / 403
     ======================================================= */

  const isLoginPage =
    pathname ===
      "/login" ||
    pathname.startsWith(
      "/login/"
    );

  const is403Page =
    pathname ===
    "/403";

  if (
    isLoginPage ||
    is403Page
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
      <LoadingScreen />
    );
  }

  /* =======================================================
     Not logged in
     ======================================================= */

  if (
    !user
  ) {
    return (
      <UnauthorizedScreen
        message={
          error ||
          "ログインが必要です。"
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

  if (
    !user.role
  ) {
    return (
      <ForbiddenScreen
        message="アカウントの権限が設定されていません。"
      />
    );
  }

  /* =======================================================
     Route access
     ======================================================= */

  if (
    !canAccessRoute(
      user.role,
      pathname
    )
  ) {
    return (
      <ForbiddenScreen
        message="このページを利用する権限がありません。"
      />
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
      err
    ) {
      console.error(
        err
      );

      setError(
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
              logoStyle
            }
          >
            Tsystem
          </Link>
        </div>

        {/* =================================================
            Role-specific menu
            ================================================= */}

        <nav
          style={
            navStyle
          }
        >
          {menu.map(
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

        {/* =================================================
            Footer
            =================================================
            アカウント情報は一切表示しない。
            氏名・メール・権限・所属校舎なし。
            ================================================= */}

        <div
          style={
            footerStyle
          }
        >
          {error && (
            <div
              style={
                errorStyle
              }
            >
              {
                error
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
          Main
          ================================================== */}

      <div
        style={
          contentStyle
        }
      >
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
   Role → Menu
   ========================================================= */

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
            brandStyle
          }
        >
          Tsystem
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
          style={
            brandStyle
          }
        >
          Tsystem
        </div>

        <h1>
          ログインが必要です
        </h1>

        <p
          style={{
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
            brandStyle
          }
        >
          Tsystem
        </div>

        <div
          style={
            forbiddenCodeStyle
          }
        >
          403
        </div>

        <h1>
          権限がありません
        </h1>

        <p
          style={{
            color:
              "#666",

            lineHeight:
              1.8,
          }}
        >
          {
            message
          }
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

function getErrorMessage(
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

const logoStyle:
  React.CSSProperties = {
    color:
      "#111",

    textDecoration:
      "none",

    fontSize:
      22,

    fontWeight:
      800,
  };

const navStyle:
  React.CSSProperties = {
    flex:
      1,

    overflowY:
      "auto",

    padding:
      "14px 10px",
  };

const sectionStyle:
  React.CSSProperties = {
    marginBottom:
      20,
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
      "10px 12px",

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

const footerStyle:
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

    fontWeight:
      600,
  };

const contentStyle:
  React.CSSProperties = {
    width:
      "100%",

    marginLeft:
      250,
  };

const mainStyle:
  React.CSSProperties = {
    minHeight:
      "100vh",
  };

const brandStyle:
  React.CSSProperties = {
    fontSize:
      28,

    fontWeight:
      800,

    letterSpacing:
      "-0.03em",
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

const loadingTextStyle:
  React.CSSProperties = {
    marginTop:
      12,

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

const errorStyle:
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
