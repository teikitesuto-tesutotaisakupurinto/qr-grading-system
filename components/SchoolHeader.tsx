"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

type SchoolHeaderProps = {
  title: string;
};

export default function SchoolHeader({
  title,
}: SchoolHeaderProps) {
  const pathname =
    usePathname();

  return (
    <header className="schoolHeader">
      <div className="schoolHeaderInner">
        <Link
          href="/dashboard"
          className="schoolHeaderBrand"
        >
          <div className="schoolHeaderLogo">
            T
          </div>

          <div>
            <div className="schoolHeaderSystemName">
              Tsystem
            </div>

            <div className="schoolHeaderPageTitle">
              {title}
            </div>
          </div>
        </Link>

        <nav className="schoolHeaderNav">
          <HeaderLink
            href="/dashboard"
            pathname={pathname}
          >
            ダッシュボード
          </HeaderLink>

          <HeaderLink
            href="/students"
            pathname={pathname}
          >
            生徒
          </HeaderLink>

          <HeaderLink
            href="/tests"
            pathname={pathname}
          >
            テスト
          </HeaderLink>

          <HeaderLink
            href="/answers"
            pathname={pathname}
          >
            答案
          </HeaderLink>

          <HeaderLink
            href="/grading"
            pathname={pathname}
          >
            採点
          </HeaderLink>

          <HeaderLink
            href="/results"
            pathname={pathname}
          >
            成績
          </HeaderLink>

          <HeaderLink
            href="/reports"
            pathname={pathname}
          >
            成績表
          </HeaderLink>
        </nav>
      </div>
    </header>
  );
}

function HeaderLink({
  href,
  pathname,
  children,
}: {
  href: string;

  pathname: string;

  children: React.ReactNode;
}) {
  const active =
    pathname === href ||
    pathname.startsWith(
      `${href}/`
    );

  return (
    <Link
      href={href}
      className={
        active
          ? "schoolHeaderNavLink active"
          : "schoolHeaderNavLink"
      }
    >
      {children}
    </Link>
  );
}
