"use client";

import {
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
  signOut,
} from "firebase/auth";

import {
  auth,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import type {
  AppUser,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type MenuItem = {
  label: string;

  href: string;

  description?: string;

  /*
   * 親メニューの場合のみ。
   */
  children?: MenuItem[];
};

/* =========================================================
   Props
   ========================================================= */

type SidebarProps = {
  /*
   * layout側からユーザーを渡せる場合に対応。
   *
   * 渡されなくてもFirebaseのログインユーザーから取得する。
   */
  user?: AppUser | null;

  onNavigate?: () => void;
};

/* =========================================================
   Component
   ========================================================= */

export default function Sidebar({
  user: externalUser,
  onNavigate,
}: SidebarProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<AppUser | null>(
      externalUser ??
        null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      !externalUser
    );

  const [
    signingOut,
    setSigningOut,
  ] =
    useState(false);

  /* =======================================================
     User
     ======================================================= */

  useEffect(() => {
    if (
      externalUser !==
      undefined
    ) {
      setUser(
        externalUser
      );

      setLoading(
        false
      );

      return;
    }

    void loadUser();
  }, [
    externalUser,
  ]);

  async function loadUser() {
    try {
      setLoading(
        true
      );

      const appUser =
        await getAppUser();

      setUser(
        appUser
      );
    } catch (
      error
    ) {
      console.error(
        "Sidebar user load error:",
        error
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

  /* =======================================================
     Menu
     ======================================================= */

  const menu =
    useMemo(
      () =>
        createMenu(
          user?.role ??
            null
        ),
      [
        user?.role,
      ]
    );

  /* =======================================================
     Logout
     ======================================================= */

  async function handleLogout() {
    if (
      signingOut
    ) {
      return;
    }

    try {
      setSigningOut(
        true
      );

      await signOut(
        auth
      );

      setUser(
        null
      );

      onNavigate?.();

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

      setSigningOut(
        false
      );
    }
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <aside
      className="sidebar"
      aria-label="メインメニュー"
    >
      {/* ==================================================
          Brand
          ================================================== */}

      <div
        style={{
          padding:
            "20px 18px 18px",

          borderBottom:
            "1px solid #eee",
        }}
      >
        <Link
          href={
            getDashboardPath(
              user?.role ??
                null
            )
          }
          onClick={
            onNavigate
          }
          style={{
            textDecoration:
              "none",

            color:
              "inherit",
          }}
        >
          <strong
            style={{
              display:
                "block",

              fontSize:
                20,
            }}
          >
            テストシステム
          </strong>

          <span
            style={{
              display:
                "block",

              marginTop:
                3,

              fontSize:
                11,

              color:
                "#777",
            }}
          >
            成績・答案管理システム
          </span>
        </Link>
      </div>

      {/* ==================================================
          User
          ================================================== */}

      <div
        style={{
          padding:
            "14px 18px",

          borderBottom:
            "1px solid #eee",
        }}
      >
        {loading ? (
          <div
            style={{
              fontSize:
                12,

              color:
                "#888",
            }}
          >
            読み込み中...
          </div>
        ) : user ? (
          <>
            <div
              style={{
                fontWeight:
                  700,

                fontSize:
                  13,
              }}
            >
              {
                user.name
              }
            </div>

            <div
              style={{
                marginTop:
                  3,

                fontSize:
                  11,

                color:
                  "#777",
              }}
            >
              {
                user.role
              }
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize:
                12,

              color:
                "#888",
            }}
          >
            未ログイン
          </div>
        )}
      </div>

      {/* ==================================================
          Navigation
          ================================================== */}

      <nav
        style={{
          padding:
            "12px 10px",

          overflowY:
            "auto",

          flex:
            1,
        }}
      >
        {!loading &&
          menu.map(
            (
              item
            ) => (
              <SidebarMenuItem
                key={
                  item.href
                }
                item={
                  item
                }
                pathname={
                  pathname
                }
                onNavigate={
                  onNavigate
                }
              />
            )
          )}

        {!loading &&
          menu.length ===
            0 && (
            <div
              style={{
                padding:
                  14,

                fontSize:
                  12,

                color:
                  "#777",
              }}
            >
              利用できるメニューがありません。
            </div>
          )}
      </nav>

      {/* ==================================================
          Account
          ================================================== */}

      <div
        style={{
          padding:
            10,

          borderTop:
            "1px solid #eee",
        }}
      >
        <button
          type="button"
          onClick={
            handleLogout
          }
          disabled={
            signingOut
          }
          style={{
            width:
              "100%",

            padding:
              "10px 12px",

            border:
              "1px solid #ddd",

            borderRadius:
              7,

            background:
              "#fff",

            cursor:
              signingOut
                ? "default"
                : "pointer",

            fontSize:
              12,
          }}
        >
          {signingOut
            ? "ログアウト中..."
            : "ログアウト"}
        </button>
      </div>
    </aside>
  );
}

/* =========================================================
   Menu item
   ========================================================= */

function SidebarMenuItem({
  item,
  pathname,
  onNavigate,
}: {
  item: MenuItem;

  pathname: string;

  onNavigate?: () => void;
}) {
  const hasChildren =
    Boolean(
      item.children &&
        item.children.length >
          0
    );

  const active =
    isMenuActive(
      item,
      pathname
    );

  const [
    open,
    setOpen,
  ] =
    useState(
      active
    );

  useEffect(() => {
    if (
      active
    ) {
      setOpen(
        true
      );
    }
  }, [
    active,
  ]);

  /*
   * 子メニューがない通常リンク。
   */
  if (
    !hasChildren
  ) {
    return (
      <Link
        href={
          item.href
        }
        onClick={
          onNavigate
        }
        className={
          active
            ? "sidebarLink active"
            : "sidebarLink"
        }
        style={{
          display:
            "block",

          padding:
            "10px 12px",

          marginBottom:
            3,

          borderRadius:
            7,

          textDecoration:
            "none",

          color:
            active
              ? "#111"
              : "#444",

          background:
            active
              ? "#f1f1f1"
              : "transparent",

          fontWeight:
            active
              ? 700
              : 500,
        }}
      >
        <span>
          {
            item.label
          }
        </span>

        {item.description && (
          <span
            style={{
              display:
                "block",

              marginTop:
                2,

              fontSize:
                10,

              color:
                "#888",

              fontWeight:
                400,
            }}
          >
            {
              item.description
            }
          </span>
        )}
      </Link>
    );
  }

  /*
   * 子メニューあり。
   */
  return (
    <div
      style={{
        marginBottom:
          4,
      }}
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (
              current
            ) =>
              !current
          )
        }
        style={{
          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          width:
            "100%",

          padding:
            "10px 12px",

          border:
            0,

          borderRadius:
            7,

          background:
            active
              ? "#f1f1f1"
              : "transparent",

          cursor:
            "pointer",

          textAlign:
            "left",

          fontWeight:
            active
              ? 700
              : 600,

          color:
            "#333",
        }}
      >
        <span>
          {
            item.label
          }
        </span>

        <span
          aria-hidden="true"
          style={{
            fontSize:
              11,

            transform:
              open
                ? "rotate(180deg)"
                : "rotate(0deg)",

            transition:
              "transform .15s ease",
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          style={{
            marginLeft:
              8,

            paddingLeft:
              8,

            borderLeft:
              "1px solid #eee",
          }}
        >
          {item.children!.map(
            (
              child
            ) => (
              <SidebarMenuItem
                key={
                  child.href
                }
                item={
                  child
                }
                pathname={
                  pathname
                }
                onNavigate={
                  onNavigate
                }
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Create menu
   ========================================================= */

function createMenu(
  role:
    | UserRole
    | null
): MenuItem[] {
  switch (
    role
  ) {
    /* =====================================================
       本部管理者
       ===================================================== */

    case "本部管理者":
      return [
        {
          label:
            "ダッシュボード",

          href:
            "/dashboard/head-office",
        },

        {
          label:
            "生徒管理",

          href:
            "/students",
        },

        {
          label:
            "テスト管理",

          href:
            "/tests",
        },

        {
          label:
            "答案・採点",

          href:
            "/grading",

          children: [
            {
              label:
                "答案管理",

              href:
                "/answers",
            },

            {
              label:
                "採点管理",

              href:
                "/grading",
            },

            {
              label:
                "一次確認",

              href:
                "/grading/review",
            },

            {
              label:
                "二次確認",

              href:
                "/grading/second-review",
            },

            {
              label:
                "採点確定",

              href:
                "/grading/confirm",
            },
          ],
        },

        {
          label:
            "成績",

          href:
            "/results/management",

          children: [
            {
              label:
                "成績一覧",

              href:
                "/results/management",
            },

            {
              label:
                "成績表",

              href:
                "/reports/management",
            },
          ],
        },

        {
          label:
            "追試",

          href:
            "/retests",
        },

        {
          label:
            "QRシール",

          href:
            "/qr-stickers",
        },

        {
          label:
            "校舎管理",

          href:
            "/schools",
        },

        {
          label:
            "ユーザー管理",

          href:
            "/users",
        },

        {
          label:
            "設定",

          href:
            "/settings",
        },
      ];

    /* =====================================================
       校舎管理者
       ===================================================== */

    case "校舎管理者":
      return [
        {
          label:
            "ダッシュボード",

          href:
            "/dashboard/school",
        },

        {
          label:
            "生徒管理",

          href:
            "/students",
        },

        {
          label:
            "テスト管理",

          href:
            "/tests",
        },

        {
          label:
            "答案・採点",

          href:
            "/grading",

          children: [
            {
              label:
                "答案管理",

              href:
                "/answers",
            },

            {
              label:
                "採点管理",

              href:
                "/grading",
            },

            {
              label:
                "一次確認",

              href:
                "/grading/review",
            },

            {
              label:
                "二次確認",

              href:
                "/grading/second-review",
            },

            {
              label:
                "採点確定",

              href:
                "/grading/confirm",
            },
          ],
        },

        {
          label:
            "成績",

          href:
            "/results/management",

          children: [
            {
              label:
                "成績一覧",

              href:
                "/results/management",
            },

            {
              label:
                "成績表",

              href:
                "/reports/management",
            },
          ],
        },

        {
          label:
            "追試",

          href:
            "/retests",
        },

        {
          label:
            "QRシール",

          href:
            "/qr-stickers",
        },

        {
          label:
            "ユーザー管理",

          href:
            "/users",
        },

        {
          label:
            "設定",

          href:
            "/settings",
        },
      ];

    /* =====================================================
       講師
       ===================================================== */

    case "講師":
      return [
        {
          label:
            "ダッシュボード",

          href:
            "/dashboard/teacher",
        },

        {
          label:
            "テスト",

          href:
            "/tests",
        },

        {
          label:
            "答案・採点",

          href:
            "/grading",

          children: [
            {
              label:
                "答案管理",

              href:
                "/answers",
            },

            {
              label:
                "採点管理",

              href:
                "/grading",
            },

            {
              label:
                "一次確認",

              href:
                "/grading/review",
            },

            {
              label:
                "二次確認",

              href:
                "/grading/second-review",
            },

            {
              label:
                "採点確定",

              href:
                "/grading/confirm",
            },
          ],
        },

        {
          label:
            "成績",

          href:
            "/results/teacher",

          children: [
            {
              label:
                "成績一覧",

              href:
                "/results/teacher",
            },

            {
              label:
                "成績表",

              href:
                "/reports/teacher",
            },
          ],
        },

        {
          label:
            "追試",

          href:
            "/retests",
        },

        {
          label:
            "QRシール",

          href:
            "/qr-stickers",
        },
      ];

    /* =====================================================
       生徒
       ===================================================== */

    case "生徒":
      return [
        {
          label:
            "ホーム",

          href:
            "/dashboard/student",
        },

        {
          label:
            "成績",

          href:
            "/results/student",

          children: [
            {
              label:
                "成績一覧",

              href:
                "/results/student",
            },

            {
              label:
                "成績表",

              href:
                "/reports/student",
            },
          ],
        },
      ];

    default:
      return [];
  }
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

/* =========================================================
   Active
   ========================================================= */

function isMenuActive(
  item: MenuItem,
  pathname: string
) {
  if (
    pathname ===
    item.href
  ) {
    return true;
  }

  if (
    item.href !==
      "/" &&
    pathname.startsWith(
      `${item.href}/`
    )
  ) {
    return true;
  }

  if (
    item.children
  ) {
    return item.children.some(
      (
        child
      ) =>
        isMenuActive(
          child,
          pathname
        )
    );
  }

  return false;
}
