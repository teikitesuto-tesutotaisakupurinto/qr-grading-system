"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";

type SchoolHeaderProps = {
  title: string;
};

type UserInfo = {
  email: string | null;
};

const navigation = [
  {
    label: "ホーム",
    href: "/",
  },
  {
    label: "生徒",
    href: "/students",
  },
  {
    label: "QR発行",
    href: "/qr",
  },
  {
    label: "テスト",
    href: "/tests",
  },
  {
    label: "答案",
    href: "/answers",
  },
  {
    label: "採点",
    href: "/grading",
  },
  {
    label: "成績",
    href: "/results",
  },
  {
    label: "成績表",
    href: "/reports",
  },
];

export default function SchoolHeader({
  title,
}: SchoolHeaderProps) {
  const pathname = usePathname();

  const [user, setUser] =
    useState<UserInfo | null>(null);

  const [menuOpen, setMenuOpen] =
    useState(false);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (firebaseUser) => {
          if (!firebaseUser) {
            setUser(null);
            return;
          }

          setUser({
            email:
              firebaseUser.email,
          });
        }
      );

    return unsubscribe;
  }, []);

  return (
    <header className="schoolHeader">
      <div className="schoolHeaderInner">
        <Link
          href="/"
          className="schoolHeaderBrand"
        >
          <div className="schoolHeaderLogo">
            塾ロゴ
          </div>

          <div>
            <div className="schoolHeaderSystemName">
              QR答案採点システム
            </div>

            <div className="schoolHeaderPageTitle">
              {title}
            </div>
          </div>
        </Link>

        <nav className="schoolHeaderNav">
          {navigation.map(
            (item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname ===
                      item.href ||
                    pathname.startsWith(
                      `${item.href}/`
                    );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "schoolHeaderNavLink active"
                      : "schoolHeaderNavLink"
                  }
                >
                  {item.label}
                </Link>
              );
            }
          )}
        </nav>

        <div className="schoolHeaderRight">
          <button
            type="button"
            className="schoolHeaderMenuButton"
            onClick={() =>
              setMenuOpen(
                (current) =>
                  !current
              )
            }
            aria-expanded={
              menuOpen
            }
          >
            <span>
              {user?.email ??
                "アカウント"}
            </span>

            <span>
              ▼
            </span>
          </button>

          {menuOpen && (
            <div className="schoolHeaderMenu">
              <Link
                href="/settings"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                設定
              </Link>

              <Link
                href="/users"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                ユーザー管理
              </Link>

              <button
                type="button"
                onClick={async () => {
                  /*
                   * Firebase Authenticationから
                   * 実際にログアウト。
                   */
                  const {
                    signOut,
                  } =
                    await import(
                      "firebase/auth"
                    );

                  await signOut(
                    auth
                  );

                  setMenuOpen(
                    false
                  );

                  window.location.href =
                    "/login";
                }}
              >
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
