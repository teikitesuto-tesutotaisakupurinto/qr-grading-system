"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  getCurrentUser,
  type AppUser,
} from "@/lib/auth";

export default function DashboardPage() {
  const [user, setUser] =
    useState<AppUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const currentUser =
          await getCurrentUser();

        if (cancelled) {
          return;
        }

        if (!currentUser) {
          window.location.replace(
            "/login"
          );

          return;
        }

        setUser(currentUser);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "ユーザー情報を取得できませんでした。"
        );
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

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f5f6f8",
        }}
      />
    );
  }

  if (error) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#f5f6f8",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: 520,
            padding: 32,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <h1>
            アカウントを確認できません
          </h1>

          <p
            style={{
              color: "#a00000",
              lineHeight: 1.7,
            }}
          >
            {error}
          </p>

          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 7,
              background: "#111",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            ログイン画面へ
          </Link>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
      }}
    >
      <header
        style={{
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          background: "#fff",
          borderBottom:
            "1px solid #e5e7eb",
        }}
      >
        <div>
          <strong
            style={{
              fontSize: 20,
            }}
          >
            答案採点システム
          </strong>
        </div>

        <div
          style={{
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {user.name}
          </div>

          <div
            style={{
              marginTop: 3,
              color: "#777",
              fontSize: 12,
            }}
          >
            {user.role}
          </div>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: 32,
        }}
      >
        <div
          style={{
            marginBottom: 28,
          }}
        >
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 28,
            }}
          >
            ダッシュボード
          </h1>

          <p
            style={{
              margin: 0,
              color: "#666",
            }}
          >
            答案採点システムへようこそ。
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 16,
          }}
        >
          <DashboardCard
            href="/students"
            title="生徒管理"
            description="生徒・学年・クラス・生徒番号を管理します。"
          />

          <DashboardCard
            href="/qr-stickers"
            title="QRシール"
            description="生徒QRシールを発行します。"
          />

          <DashboardCard
            href="/tests"
            title="テスト管理"
            description="テスト・教科・問題・配点を管理します。"
          />

          <DashboardCard
            href="/answers"
            title="答案管理"
            description="既存答案の登録・処理状況を確認します。"
          />

          <DashboardCard
            href="/grading"
            title="採点"
            description="自動採点・一次確認・二次確認を行います。"
          />

          <DashboardCard
            href="/results"
            title="成績"
            description="得点・偏差値・順位を確認します。"
          />

          <DashboardCard
            href="/reports"
            title="成績表"
            description="生徒の成績表を作成・確認します。"
          />

          <DashboardCard
            href="/retests"
            title="追試"
            description="追試対象者と追試結果を管理します。"
          />

          {(user.role ===
            "本部管理者" ||
            user.role ===
              "校舎管理者") && (
            <DashboardCard
              href="/settings"
              title="設定"
              description="塾・校舎・採点システムの設定を管理します。"
            />
          )}

          {(user.role ===
            "本部管理者" ||
            user.role ===
              "校舎管理者") && (
            <DashboardCard
              href="/users"
              title="ユーザー管理"
              description="管理者・校舎管理者・講師・生徒を管理します。"
            />
          )}

          {user.role ===
            "本部管理者" && (
            <DashboardCard
              href="/schools"
              title="学校・校舎管理"
              description="学校・校舎を管理します。"
            />
          )}
        </div>
      </section>
    </main>
  );
}

function DashboardCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        minHeight: 150,
        padding: 24,
        background: "#fff",
        border:
          "1px solid #e1e4e8",
        borderRadius: 12,
        color: "#171717",
        textDecoration: "none",
        boxShadow:
          "0 2px 8px rgba(0,0,0,.03)",
      }}
    >
      <strong
        style={{
          display: "block",
          marginBottom: 10,
          fontSize: 17,
        }}
      >
        {title}
      </strong>

      <span
        style={{
          color: "#666",
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        {description}
      </span>
    </Link>
  );
}
