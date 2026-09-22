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
  children?: ReactNode;

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
   Menu
   ========================================================= */

const MENU_ITEMS: MenuItem[] = [
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

  {
    href:
      "/schools",

    label:
      "校舎管理",

    description:
      "校舎・校舎情報",

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
      "アカウント管理",

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

  {
    href:
      "/answers",

    label:
      "答案",

    description:
      "答案画像・答案管理",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    href:
      "/grading",

    label:
      "採点",

    description:
      "採点状況",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],

    children: [
      {
        href:
          "/grading/auto",

        label:
          "自動採点",

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

        roles: [
          "本部管理者",
          "校舎管理者",
          "講師",
        ],
      },
    ],
  },

  {
    href:
      "/results",

    label:
      "成績",

    description:
      "成績・順位",

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
      "成績表作成・確認",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

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

  {
    href:
      "/qr-stickers",

    label:
      "QRシール",

    description:
      "生徒QRシール",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

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

  const [
    openGroups,
    setOpenGroups,
  ] =
    useState<
      Record<string, boolean>
    >({});

  const collapsed =
    controlledCollapsed ??
    internalCollapsed;

  /* =======================================================
     Auth
     ======================================================= */

  useEffect(() => {
    let mounted =
      true;

    async function loadUser() {
      try {
        const currentUser =
          auth.currentUser;

        if (
          !currentUser
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
            currentUser
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
          "Sidebar user load error:",
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

        return filterMenuByRole(
          MENU_ITEMS,
          user.role
        );
      },
      [
        user,
      ]
    );

  /* =======================================================
     Auto open current group
     ======================================================= */

  useEffect(() => {
    const currentGroups:
      Record<
        string,
        boolean
      > = {};

    visibleItems.forEach(
      (
        item
      ) => {
        if (
          item.children?.some(
            (
              child
            ) =>
              isActivePath(
                pathname,
                child.href
              )
          )
        ) {
          currentGroups[
            item.href
          ] =
            true;
        }
      }
    );

    setOpenGroups(
      (
        current
      ) => ({
        ...current,
        ...currentGroups,
      })
    );
  }, [
    pathname,
    visibleItems,
  ]);

  /* =======================================================
     Toggle collapsed
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
    } else {
      setInternalCollapsed(
        next
      );
    }
  }

  /* =======================================================
     Toggle group
     ======================================================= */

  function toggleGroup(
    href: string
  ) {
    setOpenGroups(
      (
        current: Record<
          string,
          boolean
        >
      ) => ({
        ...current,

        [href]:
          !current[href],
      })
    );
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <aside
      className={
        collapsed
          ? "sidebar collapsed"
          : "sidebar"
      }
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
          <div
            style={{
              minWidth:
                0,
            }}
          >
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
          title={
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
              14,
          }}
        >
          {collapsed
            ? ">"
            : "<"}
        </button>
      </div>

      {/* ==================================================
          Menu
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
        {visibleItems.length ===
        0 ? (
          <div
            style={{
              padding:
                12,

              color:
                "#999",

              fontSize:
                11,

              textAlign:
                "center",
            }}
          >
            {collapsed
              ? "—"
              : "利用可能なメニューがありません"}
          </div>
        ) : (
          visibleItems.map(
            (
              item
            ) => (
              <SidebarItem
                key={
                  item.href
                }
                item={
                  item
                }
                pathname={
                  pathname
                }
                collapsed={
                  collapsed
                }
                open={
                  openGroups[
                    item.href
                  ] === true
                }
                onToggle={() =>
                  toggleGroup(
                    item.href
                  )
                }
              />
            )
          )
        )}
      </nav>

      {/* ==================================================
          Footer
          ================================================== */}

      {!collapsed && (
        <div
          style={{
            padding:
              "10px 14px",

            borderTop:
              "1px solid #eee",

            color:
              "#999",

            fontSize:
              9,
          }}
        >
          テストシステム
        </div>
      )}
    </aside>
  );
}

/* =========================================================
   Sidebar item
   ========================================================= */

function SidebarItem({
  item,
  pathname,
  collapsed,
  open,
  onToggle,
}: {
  item: MenuItem;

  pathname: string;

  collapsed: boolean;

  open: boolean;

  onToggle: () => void;
}) {
  const active =
    isActivePath(
      pathname,
      item.href
    );

  const childActive =
    item.children?.some(
      (
        child
      ) =>
        isActivePath(
          pathname,
          child.href
        )
    ) ??
    false;

  const hasChildren =
    Boolean(
      item.children &&
      item.children.length >
        0
    );

  /*
   * 子メニューがある場合、
   * 親自身が実ページならリンクとして扱う。
   * そうでなければ開閉ボタンとして扱う。
   */
  return (
    <div
      style={{
        marginBottom:
          2,
      }}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",
        }}
      >
        <Link
          href={
            item.href
          }
          title={
            collapsed
              ? item.label
              : undefined
          }
          aria-current={
            active
              ? "page"
              : undefined
          }
          style={{
            flex:
              1,

            minWidth:
              0,

            display:
              "block",

            padding:
              collapsed
                ? "10px 8px"
                : "9px 10px",

            borderRadius:
              7,

            background:
              active
                ? "#eeeeee"
                : childActive
                  ? "#f7f7f7"
                  : "transparent",

            color:
              "#222",

            textDecoration:
              "none",

            fontWeight:
              active ||
              childActive
                ? 700
                : 400,
          }}
        >
          {collapsed ? (
            <span
              style={{
                display:
                  "block",

                textAlign:
                  "center",

                fontSize:
                  12,

                fontWeight:
                  700,
              }}
            >
              {
                getMenuInitial(
                  item.label
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

                    lineHeight:
                      1.4,
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

        {hasChildren &&
          !collapsed && (
            <button
              type="button"
              onClick={
                onToggle
              }
              aria-label={
                open
                  ? `${item.label}を閉じる`
                  : `${item.label}を開く`
              }
              style={{
                width:
                  30,

                height:
                  34,

                marginLeft:
                  2,

                border:
                  "none",

                background:
                  "transparent",

                cursor:
                  "pointer",

                color:
                  "#777",

                fontSize:
                  11,
              }}
            >
              {open
                ? "▲"
                : "▼"}
            </button>
          )}
      </div>

      {/* ==================================================
          Children
          ================================================== */}

      {hasChildren &&
        open &&
        !collapsed && (
          <div
            style={{
              marginLeft:
                12,

              paddingLeft:
                8,

              borderLeft:
                "1px solid #e5e5e5",
            }}
          >
            {item.children?.map(
              (
                child
              ) => (
                <Link
                  key={
                    child.href
                  }
                  href={
                    child.href
                  }
                  aria-current={
                    isActivePath(
                      pathname,
                      child.href
                    )
                      ? "page"
                      : undefined
                  }
                  style={{
                    display:
                      "block",

                    marginTop:
                      2,

                    padding:
                      "7px 9px",

                    borderRadius:
                      6,

                    background:
                      isActivePath(
                        pathname,
                        child.href
                      )
                        ? "#eeeeee"
                        : "transparent",

                    color:
                      "#333",

                    textDecoration:
                      "none",

                    fontSize:
                      11,

                    fontWeight:
                      isActivePath(
                        pathname,
                        child.href
                      )
                        ? 700
                        : 400,
                  }}
                >
                  {
                    child.label
                  }
                </Link>
              )
            )}
          </div>
        )}
    </div>
  );
}

/* =========================================================
   Filter by role
   ========================================================= */

function filterMenuByRole(
  items: MenuItem[],
  role: UserRole
): MenuItem[] {
  return items
    .filter(
      (
        item
      ) =>
        item.roles.includes(
          role
        )
    )
    .map(
      (
        item
      ) => ({
        ...item,

        children:
          item.children
            ?.filter(
              (
                child
              ) =>
                child.roles.includes(
                  role
                )
            ),
      })
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
    pathname ===
    href
  ) {
    return true;
  }

  /*
   * /grading と /grading/xxx を
   * 同じグループとして扱う。
   */
  return pathname.startsWith(
    `${href}/`
  );
}

/* =========================================================
   Collapsed icon
   ========================================================= */

function getMenuInitial(
  label: string
) {
  if (
    !label
  ) {
    return "・";
  }

  return label.charAt(
    0
  );
}
