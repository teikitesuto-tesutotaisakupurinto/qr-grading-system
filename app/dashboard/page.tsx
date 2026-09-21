"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  onAuthStateChanged,
  type User,
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
  const [firebaseUser, setFirebaseUser] =
    useState<User | null>(null);

  const [user, setUser] =
    useState<DashboardUser | null>(null);

  const [checking, setChecking] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentFirebaseUser) => {
          if (cancelled) {
            return;
          }

          /*
           * 重要：
           * ここでは絶対に /login へ
           * リダイレクトしない。
           */
          setFirebaseUser(
            currentFirebaseUser
          );

          if (!currentFirebaseUser) {
            setChecking(false);

            setError(
              "Firebase Authenticationのログイン状態を取得できませんでした。"
            );

            return;
          }

          try {
            const userRef =
              doc(
                db,
                "users",
                currentFirebaseUser.uid
              );

            const snapshot =
              await getDoc(userRef);

            if (cancelled) {
              return;
            }

            /*
             * Authenticationは成功。
             * Firestoreユーザーがない場合も
             * /loginには戻さない。
             */
            if (!snapshot.exists()) {
              setChecking(false);

              setError(
                "Googleログインは成功しています。このGoogleアカウントは、まだ答案採点システムのユーザーとして登録されていません。"
              );

              return;
            }

            const data =
              snapshot.data();

            const role =
              isUserRole(data.role)
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
              data.active !== false;

            setUser({
              uid:
                currentFirebaseUser.uid,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : currentFirebaseUser.displayName ??
                    "",

              email:
                currentFirebaseUser.email,

              role,

              organizationId,

              schoolIds,

              active,
            });

            setError("");

            setChecking(false);
          } catch (err) {
            if (cancelled) {
              return;
            }

            console.error(
              "Dashboard user error:",
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "ユーザー情報の取得に失敗しました。"
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
   * Firebaseの状態確認中。
   */
  if (checking) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f5f6f8",
        }}
      />
    );
  }

  /*
   * Firebase Authenticationが
   * 取得できない場合。
   *
   * 絶対に/loginへ戻さない。
   */
  if (!firebaseUser) {
    return (
      <StatusPage
        title="認証状態を確認できません"
        message={error}
      />
    );
  }

  /*
   * Firestoreのユーザー情報がない場合。
   *
   * 絶対に/loginへ戻さない。
   */
  if (!user) {
    return (
      <StatusPage
        title="ユーザー登録が必要です"
        message={error}
        showOnboarding
      />
    );
  }

  /*
   * アカウント停止
   */
  if (!user.active) {
    return (
      <StatusPage
        title="アカウントが停止されています"
        message="このアカウントは現在利用できません。管理者にお問い合わせください。"
      />
    );
  }

  /*
   * 権限未設定
   */
  if (!user.role) {
    return (
      <StatusPage
        title="権限が設定されていません"
        message="Googleログインは成功していますが、システム上の権限がまだ設定されていません。"
        showUsers
      />
    );
  }

  /*
   * 正式ユーザー
   */
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
      }}
    >
      <header
        style={{
          minHeight: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          background: "#fff",
          borderBottom:
            "1px solid #e5e7eb",
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
          {user.name}さん、ようこそ。
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 16,
            marginTop: 28,
          }}
        >
          <DashboardCard
            href="/students"
            title="生徒管理"
            description="生徒・学年・クラス・生徒番号"
          />

          <DashboardCard
            href="/qr-stickers"
            title="QRシール"
            description="生徒QRシールの発行"
          />

          <DashboardCard
            href="/tests"
            title="テスト管理"
            description="テスト・問題・配点"
          />

          <DashboardCard
            href="/answers"
            title="答案管理"
            description="既存答案の管理"
          />

          <DashboardCard
            href="/grading"
            title="採点"
            description="自動採点・確認・確定"
          />

          <DashboardCard
            href="/results"
            title="成績"
            description="得点・偏差値・順位"
          />

          <DashboardCard
            href="/reports"
            title="成績表"
            description="成績表の作成・確認"
          />

          <DashboardCard
            href="/retests"
            title="追試"
            description="追試対象者・結果"
          />

          {(user.role ===
            "本部管理者" ||
            user.role ===
              "校舎管理者") && (
            <>
              <DashboardCard
                href="/users"
                title="ユーザー管理"
                description="ユーザー・権限・所属校舎"
              />

              <DashboardCard
                href="/settings"
                title="設定"
                description="システム・塾設定"
              />
            </>
          )}

          {user.role ===
            "本部管理者" && (
            <DashboardCard
              href="/schools"
              title="学校・校舎"
              description="学校・校舎の管理"
            />
          )}
        </div>

        <section
          style={{
            marginTop: 32,
            padding: 24,
            background: "#fff",
            border:
              "1px solid #e1e4e8",
            borderRadius: 12,
          }}
        >
          <h2
            style={{
              margin:
                "0 0 18px",
              fontSize: 18,
            }}
          >
            アカウント情報
          </h2>

          <InfoRow
            label="氏名"
            value={user.name}
          />

          <InfoRow
            label="メールアドレス"
            value={
              user.email ??
              "未設定"
            }
          />

          <InfoRow
            label="権限"
            value={
              user.role
            }
          />

          <InfoRow
            label="所属校舎"
            value={`${user.schoolIds.length}校`}
          />
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Status
   ========================================================= */

function StatusPage({
  title,
  message,
  showOnboarding = false,
  showUsers = false,
}: {
  title: string;
  message: string;
  showOnboarding?: boolean;
  showUsers?: boolean;
}) {
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
          maxWidth: 600,
          padding: 36,
          background: "#fff",
          border:
            "1px solid #ddd",
          borderRadius: 14,
        }}
      >
        <h1
          style={{
            marginTop: 0,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            marginTop: 18,
            color: "#555",
            lineHeight: 1.8,
          }}
        >
          {message}
        </p>

        {showOnboarding && (
          <Link
            href="/onboarding"
            style={{
              display:
                "inline-block",
              marginTop: 20,
              padding:
                "11px 20px",
              borderRadius: 7,
              background: "#111",
              color: "#fff",
              textDecoration:
                "none",
            }}
          >
            組織登録へ
          </Link>
        )}

        {showUsers && (
          <Link
            href="/users"
            style={{
              display:
                "inline-block",
              marginTop: 20,
              padding:
                "11px 20px",
              borderRadius: 7,
              background: "#111",
              color: "#fff",
              textDecoration:
                "none",
            }}
          >
            ユーザー管理へ
          </Link>
        )}
      </section>
    </main>
  );
}

/* =========================================================
   Card
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
        display: "block",
        minHeight: 145,
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

/* =========================================================
   Info row
   ========================================================= */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "160px 1fr",
        gap: 16,
        padding:
          "11px 0",
        borderBottom:
          "1px solid #eee",
        fontSize: 14,
      }}
    >
      <strong>
        {label}
      </strong>

      <span>
        {value}
      </span>
    </div>
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
