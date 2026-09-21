"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  doc,
  getDoc,
} from "firebase/firestore";

type AppUser = {
  uid: string;
  email: string | null;
  name: string;
  role:
    | "本部管理者"
    | "校舎管理者"
    | "講師"
    | "生徒";
  schoolIds: string[];
  active: boolean;
};

export default function DashboardPage() {
  const [user, setUser] =
    useState<AppUser | null>(
      null
    );

  const [checking, setChecking] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (cancelled) {
            return;
          }

          /*
           * Firebaseが完全に認証状態を
           * 確定した後にだけ判断する。
           */
          if (!firebaseUser) {
            setChecking(false);
            setError(
              "Googleログイン状態を確認できませんでした。"
            );
            return;
          }

          try {
            const userRef =
              doc(
                db,
                "users",
                firebaseUser.uid
              );

            const snapshot =
              await getDoc(
                userRef
              );

            if (
              !snapshot.exists()
            ) {
              setChecking(false);

              setError(
                "このGoogleアカウントは答案採点システムに登録されていません。"
              );

              return;
            }

            const data =
              snapshot.data();

            if (
              data.active ===
              false
            ) {
              setChecking(false);

              setError(
                "このアカウントは停止されています。"
              );

              return;
            }

            const role =
              data.role;

            if (
              role !==
                "本部管理者" &&
              role !==
                "校舎管理者" &&
              role !==
                "講師" &&
              role !==
                "生徒"
            ) {
              setChecking(false);

              setError(
                "ユーザー権限が設定されていません。"
              );

              return;
            }

            const schoolIds =
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
                : [];

            if (
              cancelled
            ) {
              return;
            }

            setUser({
              uid:
                firebaseUser.uid,

              email:
                firebaseUser.email,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : firebaseUser.displayName ??
                    "",

              role,

              schoolIds,

              active:
                data.active !==
                false,
            });

            setError("");
            setChecking(false);
          } catch (
            error
          ) {
            if (
              cancelled
            ) {
              return;
            }

            setChecking(false);

            setError(
              error instanceof Error
                ? error.message
                : "ユーザー情報を取得できませんでした。"
            );
          }
        }
      );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  /*
   * 認証状態確認中
   */
  if (checking) {
    return null;
  }

  /*
   * エラー
   */
  if (error) {
    return (
      <main
        style={{
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
        }}
      >
        <section
          style={{
            width:
              "100%",

            maxWidth:
              560,

            padding:
              36,

            background:
              "#fff",

            border:
              "1px solid #ddd",

            borderRadius:
              12,
          }}
        >
          <h1>
            アカウントを確認できません
          </h1>

          <p
            style={{
              marginTop:
                16,

              lineHeight:
                1.8,

              color:
                "#a00000",
            }}
          >
            {error}
          </p>

          <p
            style={{
              marginTop:
                16,

              color:
                "#666",

              fontSize:
                14,
            }}
          >
            Googleログイン自体は成功していても、
            Firestoreのユーザー登録がない場合は
            システムを利用できません。
          </p>

          <Link
            href="/login"
            style={{
              display:
                "inline-block",

              marginTop:
                20,

              padding:
                "10px 20px",

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
            ログイン画面
          </Link>
        </section>
      </main>
    );
  }

  /*
   * ユーザーが取得できない場合
   */
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
            68,

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          padding:
            "0 32px",

          background:
            "#fff",

          borderBottom:
            "1px solid #e5e7eb",
        }}
      >
        <strong
          style={{
            fontSize:
              20,
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
              marginTop:
                3,

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
          maxWidth:
            1400,

          margin:
            "0 auto",

          padding:
            32,
        }}
      >
        <h1>
          ダッシュボード
        </h1>

        <p
          style={{
            color:
              "#666",
          }}
        >
          {user.name}さん、ようこそ。
        </p>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",

            gap:
              16,

            marginTop:
              28,
          }}
        >
          <DashboardCard
            href="/students"
            title="生徒管理"
          />

          <DashboardCard
            href="/qr-stickers"
            title="QRシール"
          />

          <DashboardCard
            href="/tests"
            title="テスト管理"
          />

          <DashboardCard
            href="/answers"
            title="答案管理"
          />

          <DashboardCard
            href="/grading"
            title="採点"
          />

          <DashboardCard
            href="/results"
            title="成績"
          />

          <DashboardCard
            href="/reports"
            title="成績表"
          />

          <DashboardCard
            href="/retests"
            title="追試"
          />

          <DashboardCard
            href="/settings"
            title="設定"
          />
        </div>
      </section>
    </main>
  );
}

function DashboardCard({
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

        fontWeight:
          600,
      }}
    >
      {title}
    </Link>
  );
}
