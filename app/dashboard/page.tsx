"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

type AppUser = {
  name: string;
  role: string;
  email: string | null;
};

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
        /*
         * Firebase/Authをページ読み込み時に
         * 直接importしない。
         *
         * Googleログイン後にだけ読み込む。
         */
        const authModule =
          await import("@/lib/auth");

        const currentUser =
          await authModule.getCurrentUser();

        if (cancelled) {
          return;
        }

        if (!currentUser) {
          window.location.replace(
            "/login"
          );

          return;
        }

        setUser({
          name:
            currentUser.name,

          role:
            currentUser.role,

          email:
            currentUser.email,
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "ユーザー情報を取得できませんでした。"
          );
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

  if (error) {
    return (
      <main
        style={{
          minHeight:
            "100vh",

          display:
            "grid",

          placeItems:
            "center",

          padding:
            24,
        }}
      >
        <section
          style={{
            maxWidth:
              500,

            width:
              "100%",

            padding:
              32,

            background:
              "#fff",

            border:
              "1px solid #ddd",

            borderRadius:
              12,
          }}
        >
          <h1>
            アカウント確認エラー
          </h1>

          <p
            style={{
              color:
                "#a00000",

              lineHeight:
                1.7,
            }}
          >
            {error}
          </p>

          <Link
            href="/login"
            style={{
              display:
                "inline-block",

              marginTop:
                16,

              padding:
                "10px 18px",

              borderRadius:
                7,

              background:
                "#111",

              color:
                "#fff",

              textDecoration:
                "none",
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
        minHeight:
          "100vh",

        background:
          "#f5f6f8",
      }}
    >
      <header
        style={{
          height:
            64,

          background:
            "#fff",

          borderBottom:
            "1px solid #e5e7eb",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          padding:
            "0 28px",
        }}
      >
        <strong
          style={{
            fontSize:
              18,
          }}
        >
          答案採点システム
        </strong>

        <div
          style={{
            textAlign:
              "right",
          }}
        >
          <div
            style={{
              fontWeight:
                600,

              fontSize:
                14,
            }}
          >
            {user.name}
          </div>

          <div
            style={{
              color:
                "#777",

              fontSize:
                12,
            }}
          >
            {user.role}
          </div>
        </div>
      </header>

      <section
        style={{
          padding:
            32,

          maxWidth:
            1400,

          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            marginBottom:
              28,
          }}
        >
          <h1
            style={{
              margin:
                "0 0 8px",
            }}
          >
            ダッシュボード
          </h1>

          <p
            style={{
              margin:
                0,

              color:
                "#666",
            }}
          >
            答案採点システムへようこそ。
          </p>
        </div>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",

            gap:
              16,
          }}
        >
          <DashboardCard
            href="/students"
            title="生徒管理"
            description="生徒情報・クラス・生徒番号を管理"
          />

          <DashboardCard
            href="/qr-stickers"
            title="QRシール"
            description="生徒QRシールを発行"
          />

          <DashboardCard
            href="/tests"
            title="テスト管理"
            description="テスト・問題・配点を管理"
          />

          <DashboardCard
            href="/answers"
            title="答案管理"
            description="既存答案を管理"
          />

          <DashboardCard
            href="/grading"
            title="採点"
            description="答案の自動採点・確認"
          />

          <DashboardCard
            href="/results"
            title="成績"
            description="得点・順位・偏差値"
          />

          <DashboardCard
            href="/reports"
            title="成績表"
            description="成績表の確認・出力"
          />

          <DashboardCard
            href="/settings"
            title="設定"
            description="システム・塾設定"
          />
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
        display:
          "block",

        padding:
          24,

        background:
          "#fff",

        border:
          "1px solid #e1e4e8",

        borderRadius:
          12,

        color:
          "#171717",

        textDecoration:
          "none",

        transition:
          "box-shadow .15s ease",
      }}
    >
      <strong
        style={{
          display:
            "block",

          fontSize:
            17,

          marginBottom:
            8,
        }}
      >
        {title}
      </strong>

      <span
        style={{
          color:
            "#666",

          fontSize:
            13,

          lineHeight:
            1.6,
        }}
      >
        {description}
      </span>
    </Link>
  );
}
