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
  getCurrentUser,
  logout,
  type AppUser,
} from "@/lib/auth";

type AppShellProps = {
  children: ReactNode;
};

type MenuItem = {
  label: string;
  href: string;
  roles: AppUser["role"][];
};

const menuItems: MenuItem[] = [
  {
    label: "ダッシュボード",
    href: "/dashboard",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
      "生徒",
    ],
  },
  {
    label: "学校・校舎",
    href: "/schools",
    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },
  {
    label: "ユーザー",
    href: "/users",
    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },
  {
    label: "生徒",
    href: "/students",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
  {
    label: "QRシール",
    href: "/qr-stickers",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
  {
    label: "テスト",
    href: "/tests",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
  {
    label: "答案",
    href: "/answers",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
  {
    label: "採点",
    href: "/grading",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
  {
    label: "成績",
    href: "/results",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
      "生徒",
    ],
  },
  {
    label: "成績表",
    href: "/reports",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
      "生徒",
    ],
  },
  {
    label: "追試",
    href: "/retests",
    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
  {
    label: "設定",
    href: "/settings",
    roles: [
      "本部管理者",
      "校舎管理者",
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

  const [user, setUser] =
    useState<AppUser | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let cancelled =
      false;

    async function loadUser() {
      try {
        const current =
          await getCurrentUser();

        if (!cancelled) {
          setUser(current);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await logout();

    router.replace(
      "/login"
    );
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight:
            "100vh",
          display:
            "grid",
          placeItems:
            "center",
        }}
      >
        読み込み中...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const visibleItems =
    menuItems.filter(
      (item) =>
        item.roles.includes(
          user.role
        )
    );

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sidebarBrand">
          <strong>
            QR答案採点
          </strong>

          <span>
            システム
          </span>
        </div>

        <nav className="sidebarNav">
          {visibleItems.map(
            (item) => {
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
                  className={
                    active
                      ? "sidebarLink active"
                      : "sidebarLink"
                  }
                >
                  {
                    item.label
                  }
                </Link>
              );
            }
          )}
        </nav>

        <div className="sidebarBottom">
          <div className="currentUser">
            <strong>
              {user.name}
            </strong>

            <span>
              {user.role}
            </span>
          </div>

          <button
            type="button"
            className="logoutButton"
            onClick={
              handleLogout
            }
          >
            ログアウト
          </button>
        </div>
      </aside>

      <main className="appMain">
        {children}
      </main>
    </div>
  );
}
