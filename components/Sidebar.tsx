"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  auth,
} from "@/lib/firebase";

import {
  getAppUser,
  type AppUser,
} from "@/lib/auth";

import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type SidebarProps = {
  collapsed?: boolean;

  onCollapsedChange?: (
    collapsed: boolean
  ) => void;
};

type MenuItem = {
  href: string;

  label: string;

  description?: string;

  roles: UserRole[];

  children?: MenuItem[];
};

/* =========================================================
   Main menu
   ========================================================= */

const MENU_ITEMS: MenuItem[] = [
  /* =======================================================
     Home
     ======================================================= */

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

  /* =======================================================
     Management
     ======================================================= */

  {
    href:
      "/schools",

    label:
      "校舎管理",

    description:
      "校舎・設定",

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
      "アカウント",

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
      "生徒情報",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  /* =======================================================
     Test
     ======================================================= */

  {
    href:
      "/tests",

    label:
      "テスト管理",

    description:
      "テスト・問題",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* =======================================================
     Answers
     ======================================================= */

  {
    href:
      "/answers",

    label:
      "答案",

    description:
      "答案登録・確認",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* =======================================================
     Grading
     ======================================================= */

  {
    href:
      "/grading",

    label:
      "採点",

    description:
      "採点・確認・確定",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* =======================================================
     Results
     ======================================================= */

  {
    href:
      "/results",

    label:
      "成績",

    description:
      "点数公開・成績計算",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* =======================================================
     Reports
     ======================================================= */

  {
    href:
      "/reports",

    label:
      "成績表",

    description:
      "成績表作成・確認",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* =======================================================
     Retests
     ======================================================= */

  {
    href:
      "/retests",

    label:
      "追試",

    description:
      "既存テストから追試作成",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* =======================================================
     QR Stickers
     ======================================================= */

  {
    href:
      "/qr-stickers",

    label:
      "QRシール",

    description:
      "生徒QRシール発行・印刷",

    /*
     * 講師も印刷可能。
     */
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  /* =======================================================
     Settings
     ======================================================= */

  {
    href:
      "/settings",

    label:
      "システム設定",

    description:
      "システム全体の設定",

    roles: [
      "本部管理者",
    ],
  },
];

/* =========================================================
   Sidebar
   ========================================================= */

export default function Sidebar({
  collapsed:
    controlledCollapsed,
  onCollapsedChange,
}: SidebarProps) {
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
    internalCollapsed,
    setInternalCollapsed,
  ] =
    useState(false);

  const collapsed =
    controlledCollapsed ??
    internalCollapsed;

  /* =======================================================
     Load user
     ======================================================= */

  useEffect(() => {
    let mounted =
      true;

    async function loadUser() {
      try {
        const firebaseUser =
          auth.currentUser;

        if (
          !firebaseUser
        ) {
          if (
            mounted
          ) {
            setUser(
              null
            );
          }

          return;
        }

        const appUser =
          await getAppUser(
            firebaseUser
          );

        if (
          mounted
        ) {
          setUser(
            appUser
          );
        }
      } catch (
        error
      ) {
        console.error(
          "Sidebar user error:",
          error
        );

        if (
          mounted
        ) {
          setUser(
            null
          );
        }
      }
    }

    void loadUser();

    return () => {
      mounted =
        false;
    };
  }, []);

  /* =======================================================
     Visible menu
     ======================================================= */

  const visibleItems =
    useMemo(
      () => {
        if (
          !user
        ) {
          return [];
        }

        return MENU_ITEMS.filter(
          (
            item
          ) =>
            item.roles.includes(
              user.role
            )
        );
      },
      [
        user,
      ]
    );

  /* =======================================================
     Toggle
     ======================================================= */

  function toggleCollapsed() {
    const next =
      !collapsed;

    if (
      onCollapsedChange
    ) {
      onCollapsedChange(
        next
      );

      return;
    }

    setInternalCollapsed(
      next
    );
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <aside
      style={{
        width:
          collapsed
            ? 68
            : 240,

        minWidth:
          collapsed
            ? 68
            : 240,

        minHeight:
          "100vh",

        background:
          "#fff",

        borderRight:
          "1px solid #e5e5e5",

        display:
          "flex",

        flexDirection:
          "column",

        transition:
          "width .15s ease",
      }}
    >
      {/* ==================================================
          Header
          ================================================== */}

      <div
        style={{
          height:
            60,

          padding:
            collapsed
              ? "0 10px"
              : "0 14px",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            collapsed
              ? "center"
              : "space-between",

          borderBottom:
            "1px solid #eee",
        }}
      >
        {!collapsed && (
          <div>
            <strong
              style={{
                display:
                  "block",

                fontSize:
                  15,
              }}
            >
              テストシステム
            </strong>

            {user && (
              <span
                style={{
                  display:
                    "block",

                  marginTop:
                    2,

                  color:
                    "#777",

                  fontSize:
                    10,
                }}
              >
                {
                  user.role
                }
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={
            toggleCollapsed
          }
          aria-label={
            collapsed
              ? "メニューを開く"
              : "メニューを閉じる"
          }
          style={{
            width:
              32,

            height:
              32,

            border:
              "1px solid #ddd",

            borderRadius:
              6,

            background:
              "#fff",

            cursor:
              "pointer",

            fontSize:
              13,
          }}
        >
          {collapsed
            ? ">"
            : "<"}
        </button>
      </div>

      {/* ==================================================
          Navigation
          ================================================== */}

      <nav
        aria-label="メインメニュー"
        style={{
          flex:
            1,

          padding:
            "12px 8px",

          overflowY:
            "auto",
        }}
      >
        {visibleItems.map(
          (
            item
          ) => {
            const active =
              pathname ===
                item.href ||
              pathname.startsWith(
                `${item.href}/`
              );

            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                title={
                  collapsed
                    ? item.label
                    : undefined
                }
                style={{
                  display:
                    "block",

                  marginBottom:
                    3,

                  padding:
                    collapsed
                      ? "10px 8px"
                      : "10px 11px",

                  borderRadius:
                    7,

                  background:
                    active
                      ? "#eeeeee"
                      : "transparent",

                  color:
                    "#222",

                  textDecoration:
                    "none",

                  textAlign:
                    collapsed
                      ? "center"
                      : "left",

                  fontWeight:
                    active
                      ? 700
                      : 400,
                }}
              >
                {collapsed ? (
                  <span
                    style={{
                      fontSize:
                        12,

                      fontWeight:
                        700,
                    }}
                  >
                    {
                      item.label.charAt(
                        0
                      )
                    }
                  </span>
                ) : (
                  <>
                    <span
                      style={{
                        display:
                          "block",

                        fontSize:
                          13,

                        lineHeight:
                          1.4,
                      }}
                    >
                      {
                        item.label
                      }
                    </span>

                    {item.description && (
                      <small
                        style={{
                          display:
                            "block",

                          marginTop:
                            2,

                          color:
                            "#888",

                          fontSize:
                            9,
                        }}
                      >
                        {
                          item.description
                        }
                      </small>
                    )}
                  </>
                )}
              </Link>
            );
          }
        )}
      </nav>
    </aside>
  );
}
