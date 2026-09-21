"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../lib/firebase";

export default function HomePage() {
  const [
    userName,
    setUserName,
  ] = useState("");

  const [
    role,
    setRole,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (!firebaseUser) {
            setLoading(
              false
            );

            return;
          }

          try {
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  firebaseUser.uid
                )
              );

            if (
              snapshot.exists()
            ) {
              const data =
                snapshot.data();

              setUserName(
                typeof data.name ===
                  "string"
                  ? data.name
                  : ""
              );

              setRole(
                typeof data.role ===
                  "string"
                  ? data.role
                  : ""
              );
            }
          } finally {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  if (
    loading
  ) {
    return (
      <main
        style={{
          minHeight:
            "100vh",

          padding:
            32,

          background:
            "#f5f6f8",
        }}
      >
        <h1>
          Tsystem
        </h1>

        <p>
          読み込み中...
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",

        padding:
          32,

        background:
          "#f5f6f8",
      }}
    >
      <div
        style={{
          maxWidth:
            1400,

          margin:
            "0 auto",
        }}
      >
        <header
          style={{
            marginBottom:
              30,
          }}
        >
          <h1
            style={{
              margin:
                0,

              fontSize:
                30,
            }}
          >
            Tsystem
          </h1>

          <p
            style={{
              marginTop:
                8,

              color:
                "#666",
            }}
          >
            学習・成績管理システム
          </p>
        </header>

        <section
          style={{
            padding:
              24,

            background:
              "#fff",

            border:
              "1px solid #e1e4e8",

            borderRadius:
              12,

            marginBottom:
              20,
          }}
        >
          <h2>
            ダッシュボード
          </h2>

          {userName && (
            <p>
              {userName}さん
            </p>
          )}

          {role && (
            <p
              style={{
                color:
                  "#666",
              }}
            >
              {role}
            </p>
          )}
        </section>

        <section
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
            title="成績"
            description="テスト結果や成績を確認します。"
            href="/grades"
          />

          <DashboardCard
            title="成績表"
            description="成績表を確認します。"
            href="/reports"
          />

          {role !== "生徒" && (
            <>
              <DashboardCard
                title="テスト"
                description="テストを管理します。"
                href="/tests"
              />

              <DashboardCard
                title="答案・採点"
                description="答案と採点を管理します。"
                href="/grading"
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;

  description: string;

  href: string;
}) {
  return (
    <a
      href={href}
      style={{
        display:
          "block",

        padding:
          22,

        background:
          "#fff",

        border:
          "1px solid #e1e4e8",

        borderRadius:
          10,

        color:
          "#111",

        textDecoration:
          "none",
      }}
    >
      <strong>
        {title}
      </strong>

      <p
        style={{
          margin:
            "8px 0 0",

          color:
            "#777",

          fontSize:
            13,

          lineHeight:
            1.6,
        }}
      >
        {description}
      </p>
    </a>
  );
}
