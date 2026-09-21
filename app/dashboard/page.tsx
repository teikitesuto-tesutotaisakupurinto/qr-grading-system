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
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type DashboardUser = {
  uid: string;

  name: string;

  email: string | null;

  role: UserRole | null;

  organizationId: string | null;

  schoolIds: string[];

  active: boolean;
};

export default function DashboardPage() {
  const [
    user,
    setUser,
  ] =
    useState<DashboardUser | null>(
      null
    );

  const [
    checking,
    setChecking,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
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
           * Firebase Authenticationに
           * ログインしていない。
           */
          if (!firebaseUser) {
            setChecking(false);

            window.location.replace(
              "/login"
            );

            return;
          }

          try {
            /*
             * users/{uid}
             */
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

            if (cancelled) {
              return;
            }

            /*
             * Google認証は成功しているが、
             * システム上のユーザー情報がない。
             */
            if (
              !snapshot.exists()
            ) {
              setChecking(false);

              window.location.replace(
                "/onboarding"
              );

              return;
            }

            const data =
              snapshot.data();

            const role =
              isUserRole(
                data.role
              )
                ? data.role
                : null;

            const organizationId =
              typeof data.organizationId ===
              "string"
                ? data.organizationId
                : null;

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

            const active =
              data.active !==
              false;

            /*
             * 組織未登録
             */
            if (
              !organizationId ||
              !role
            ) {
              setChecking(false);

              window.location.replace(
                "/onboarding"
              );

              return;
            }

            /*
             * アカウント停止
             */
            if (!active) {
              setError(
                "このアカウントは停止されています。管理者にお問い合わせください。"
              );

              setChecking(false);

              return;
            }

            setUser({
              uid:
                firebaseUser.uid,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : firebaseUser.displayName ??
                    "",

              email:
                firebaseUser.email,

              role,

              organizationId,

              schoolIds,

              active,
            });

            setError("");

            setChecking(false);
          } catch (
            error
          ) {
            if (cancelled) {
              return;
            }

            console.error(
              "Dashboard error:",
              error
            );

            setError(
              error instanceof Error
                ? error.message
                : "ユーザー情報を取得できませんでした。"
            );

            setChecking(false);
          }
        }
      );

    return () => {
      cancelled = true;

      unsubscribe();
    };
  }, []);

  /*
   * Firebase Authenticationの
   * 状態確認中は何も表示しない。
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
            答案採点システム
          </h1>

          <p
            style={{
              marginTop:
                20,

              color:
                "#a00000",

              lineHeight:
                1.8,
            }}
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.href =
                "/login";
            }}
            style={{
              marginTop:
                20,

              padding:
                "10px 20px",

              border:
                "none",

              borderRadius:
                7,

              background:
                "#111",

              color:
                "#fff",

              cursor:
                "pointer",
            }}
          >
            ログイン画面へ
          </button>
        </section>
      </main>
    );
  }

  /*
   * 未登録ユーザーは
   * useEffectから/onboardingへ
   * 移動するのでここでは何も表示しない。
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
      {/* =================================================
          Header
          ================================================= */}

      <header
        style={{
          minHeight:
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

            fontWeight:
              700,
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
              fontSize:
                14,

              fontWeight:
                600,
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

      {/* =================================================
          Main
          ================================================= */}

      <section
        style={{
          width:
            "100%",

          maxWidth:
            1400,

          margin:
            "0 auto",

          padding:
            32,
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

              fontSize:
                28,

              fontWeight:
                700,
            }}
          >
            ダッシュボード
          </h1>

          <p
            style={{
              margin: 0,

              color:
                "#666",

              lineHeight:
                1.7,
            }}
          >
            {user.name}
            さん、答案採点システムへようこそ。
          </p>
        </div>

        {/* =================================================
            Main Menu
            ================================================= */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",

            gap:
              16,
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
            description="答案の自動採点・一次確認・二次確認を行います。"
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
            <>
              <DashboardCard
                href="/users"
                title="ユーザー管理"
                description="管理者・校舎管理者・講師・生徒を管理します。"
              />

              <DashboardCard
                href="/settings"
                title="設定"
                description="塾・校舎・答案採点システムの設定を管理します。"
              />
            </>
          )}

          {user.role ===
            "本部管理者" && (
            <DashboardCard
              href="/schools"
              title="学校・校舎"
              description="学校・校舎を管理します。"
            />
          )}
        </div>

        {/* =================================================
            Account information
            ================================================= */}

        <section
          style={{
            marginTop:
              32,

            padding:
              24,

            background:
              "#fff",

            border:
              "1px solid #e1e4e8",

            borderRadius:
              12,
          }}
        >
          <h2
            style={{
              margin:
                "0 0 18px",

              fontSize:
                18,
            }}
          >
            アカウント情報
          </h2>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "160px 1fr",

              rowGap:
                12,

              fontSize:
                14,
            }}
          >
            <strong>
              氏名
            </strong>

            <span>
              {user.name}
            </span>

            <strong>
              メールアドレス
            </strong>

            <span>
              {user.email ??
                "未設定"}
            </span>

            <strong>
              権限
            </strong>

            <span>
              {user.role}
            </span>

            <strong>
              所属校舎数
            </strong>

            <span>
              {user.schoolIds.length}
              校
            </span>
          </div>
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Dashboard Card
   ========================================================= */

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

        minHeight:
          150,

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

        boxShadow:
          "0 2px 8px rgba(0,0,0,.03)",

        transition:
          "box-shadow .15s ease",
      }}
    >
      <strong
        style={{
          display:
            "block",

          marginBottom:
            10,

          fontSize:
            17,

          fontWeight:
            700,
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
            1.7,
        }}
      >
        {description}
      </span>
    </Link>
  );
}

/* =========================================================
   Role validation
   ========================================================= */

function isUserRole(
  value: unknown
): value is UserRole {
  return (
    value ===
      "本部管理者" ||
    value ===
      "校舎管理者" ||
    value ===
      "講師" ||
    value ===
      "生徒"
  );
}
