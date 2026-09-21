"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type UserData = {
  name: string;
  email: string | null;
  role: string | null;
  schoolIds: string[];
  active: boolean;
};

export default function DashboardPage() {
  const [user, setUser] =
    useState<UserData | null>(null);

  const [checking, setChecking] =
    useState(true);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          console.log(
            "Firebase user:",
            firebaseUser?.uid
          );

          if (!firebaseUser) {
            setChecking(false);

            setMessage(
              "Firebase Authenticationのログイン状態を確認できません。"
            );

            return;
          }

          try {
            const userRef = doc(
              db,
              "users",
              firebaseUser.uid
            );

            const snapshot =
              await getDoc(userRef);

            if (!snapshot.exists()) {
              setChecking(false);

              setMessage(
                "Googleログインは成功していますが、このアカウントはまだ答案採点システムに登録されていません。"
              );

              return;
            }

            const data =
              snapshot.data();

            setUser({
              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : firebaseUser.displayName ??
                    "",

              email:
                firebaseUser.email,

              role:
                typeof data.role ===
                "string"
                  ? data.role
                  : null,

              schoolIds:
                Array.isArray(
                  data.schoolIds
                )
                  ? data.schoolIds
                  : [],

              active:
                data.active !== false,
            });

            setChecking(false);
          } catch (error) {
            console.error(
              "Dashboard user error:",
              error
            );

            setChecking(false);

            setMessage(
              error instanceof Error
                ? error.message
                : "ユーザー情報の取得に失敗しました。"
            );
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  if (checking) {
    return null;
  }

  if (message) {
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
            maxWidth: 560,
            background: "#fff",
            padding: 36,
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        >
          <h1>
            答案採点システム
          </h1>

          <p
            style={{
              marginTop: 20,
              lineHeight: 1.8,
              color: "#555",
            }}
          >
            {message}
          </p>

          <p
            style={{
              marginTop: 20,
              fontSize: 13,
              color: "#888",
            }}
          >
            Google Authenticationのログイン自体は維持されています。
          </p>

          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: 20,
              padding: "10px 18px",
              background: "#111",
              color: "#fff",
              borderRadius: 7,
              textDecoration: "none",
            }}
          >
            ログイン画面
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
          padding: "0 32px",
          background: "#fff",
          borderBottom:
            "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
        }}
      >
        <strong
          style={{
            fontSize: 20,
          }}
        >
          答案採点システム
        </strong>

        <div
          style={{
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontWeight: 600,
            }}
          >
            {user.name}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#777",
            }}
          >
            {user.role ??
              "権限未設定"}
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
        <h1>
          ダッシュボード
        </h1>

        <p
          style={{
            color: "#666",
          }}
        >
          {user.name}さん、ようこそ。
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 28,
          }}
        >
          <Card
            href="/students"
            title="生徒管理"
          />

          <Card
            href="/qr-stickers"
            title="QRシール"
          />

          <Card
            href="/tests"
            title="テスト管理"
          />

          <Card
            href="/answers"
            title="答案管理"
          />

          <Card
            href="/grading"
            title="採点"
          />

          <Card
            href="/results"
            title="成績"
          />

          <Card
            href="/reports"
            title="成績表"
          />

          <Card
            href="/retests"
            title="追試"
          />

          <Card
            href="/settings"
            title="設定"
          />
        </div>
      </section>
    </main>
  );
}

function Card({
  href,
  title,
}: {
  href: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: 24,
        background: "#fff",
        border: "1px solid #e1e4e8",
        borderRadius: 12,
        color: "#171717",
        textDecoration: "none",
        fontWeight: 600,
      }}
    >
      {title}
    </Link>
  );
}
