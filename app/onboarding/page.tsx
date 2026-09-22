"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
  getDashboardPath,
} from "@/lib/auth";

/* =========================================================
   Page
   ========================================================= */

export default function OnboardingPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    schoolName,
    setSchoolName,
  ] = useState("");

  const [
    schoolCode,
    setSchoolCode,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     Check existing account
     ======================================================= */

  useEffect(() => {
    let cancelled =
      false;

    async function check() {
      try {
        const firebaseUser =
          auth.currentUser;

        /*
         * Firebase Authenticationに
         * ログインしていない。
         */
        if (
          !firebaseUser
        ) {
          if (
            !cancelled
          ) {
            router.replace(
              "/login"
            );
          }

          return;
        }

        const appUser =
          await getAppUser(
            firebaseUser
          );

        /*
         * Firestore側のusers/{uid}が
         * まだ存在しない場合。
         *
         * この場合はオンボーディングを
         * そのまま表示する。
         */
        if (
          !appUser
        ) {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }

          return;
        }

        /*
         * 既に正式なユーザーなら
         * オンボーディング不要。
         */
        if (
          appUser.organizationId &&
          appUser.role
        ) {
          if (
            !cancelled
          ) {
            router.replace(
              getDashboardPath(
                appUser.role
              )
            );
          }

          return;
        }

        /*
         * users/{uid}は存在するが
         * 組織情報が未設定の場合は
         * オンボーディングを表示。
         */
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      } catch (
        err
      ) {
        console.error(
          "Onboarding check error:",
          err
        );

        if (
          !cancelled
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "アカウント情報を確認できません。"
          );

          setLoading(
            false
          );
        }
      }
    }

    void check();

    return () => {
      cancelled =
        true;
    };
  }, [
    router,
  ]);

  /* =======================================================
     Create organization
     ======================================================= */

  async function createOrganization() {
    if (
      saving
    ) {
      return;
    }

    const firebaseUser =
      auth.currentUser;

    if (
      !firebaseUser
    ) {
      router.replace(
        "/login"
      );

      return;
    }

    const trimmedName =
      schoolName.trim();

    const trimmedSchoolName =
      schoolCode.trim();

    /*
     * Validation
     */
    if (
      !trimmedName
    ) {
      setError(
        "塾・組織名を入力してください。"
      );

      return;
    }

    if (
      !trimmedSchoolName
    ) {
      setError(
        "最初の校舎名を入力してください。"
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setError("");

      /*
       * すでにユーザーが作成されているか
       * 最終確認。
       */
      const existingUser =
        await getAppUser(
          firebaseUser
        );

      /*
       * すでに正式ユーザーなら
       * 二重に組織を作らない。
       */
      if (
        existingUser &&
        existingUser.organizationId &&
        existingUser.role
      ) {
        router.replace(
          getDashboardPath(
            existingUser.role
          )
        );

        return;
      }

      /*
       * organizations/{organizationId}
       */
      const organizationRef =
        doc(
          collection(
            db,
            "organizations"
          )
        );

      /*
       * schools/{schoolId}
       */
      const schoolRef =
        doc(
          collection(
            db,
            "schools"
          )
        );

      /*
       * users/{uid}
       */
      const userRef =
        doc(
          db,
          "users",
          firebaseUser.uid
        );

      const batch =
        writeBatch(
          db
        );

      /* =================================================
         Organization
         ================================================= */

      batch.set(
        organizationRef,
        {
          name:
            trimmedName,

          ownerUid:
            firebaseUser.uid,

          logoUrl:
            "",

          active:
            true,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      /* =================================================
         First school
         ================================================= */

      batch.set(
        schoolRef,
        {
          organizationId:
            organizationRef.id,

          name:
            trimmedSchoolName,

          logoUrl:
            "",

          settings:
            {},

          active:
            true,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      /* =================================================
         First user
         ================================================= */

      batch.set(
        userRef,
        {
          uid:
            firebaseUser.uid,

          organizationId:
            organizationRef.id,

          name:
            firebaseUser.displayName ??
            "",

          email:
            firebaseUser.email,

          role:
            "本部管理者",

          schoolIds:
            [
              schoolRef.id,
            ],

          studentId:
            null,

          active:
            true,

          photoURL:
            firebaseUser.photoURL ??
            null,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * 3つをまとめて登録。
       */
      await batch.commit();

      /*
       * 本部管理者ホームへ。
       */
      router.replace(
        getDashboardPath(
          "本部管理者"
        )
      );
    } catch (
      err
    ) {
      console.error(
        "Create organization error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "組織の登録に失敗しました。"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Loading
     ======================================================= */

  if (
    loading
  ) {
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

          background:
            "#f7f7f7",
        }}
      >
        <div
          style={{
            textAlign:
              "center",
          }}
        >
          <strong>
            テストシステム
          </strong>

          <p
            style={{
              margin:
                "8px 0 0",

              color:
                "#777",

              fontSize:
                12,
            }}
          >
            アカウント情報を確認しています...
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     Render
     ======================================================= */

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
            520,

          padding:
            40,

          background:
            "#fff",

          border:
            "1px solid #ddd",

          borderRadius:
            16,

          boxShadow:
            "0 10px 30px rgba(0,0,0,.06)",
        }}
      >
        {/* =================================================
            Header
            ================================================= */}

        <header>
          <div
            style={{
              fontSize:
                11,

              color:
                "#777",

              letterSpacing:
                ".08em",
            }}
          >
            TEST SYSTEM
          </div>

          <h1
            style={{
              margin:
                "6px 0 0",
            }}
          >
            テストシステム
          </h1>

          <h2
            style={{
              margin:
                "20px 0 0",

              fontSize:
                20,
            }}
          >
            組織を登録
          </h2>

          <p
            style={{
              color:
                "#666",

              lineHeight:
                1.7,
            }}
          >
            最初に塾・組織と校舎を登録します。
            登録したアカウントは本部管理者として設定されます。
          </p>
        </header>

        {/* =================================================
            Organization
            ================================================= */}

        <label
          style={{
            display:
              "block",

            marginTop:
              24,
          }}
        >
          <span
            style={{
              display:
                "block",

              marginBottom:
                7,

              fontSize:
                12,

              fontWeight:
                600,
            }}
          >
            塾・組織名
          </span>

          <input
            value={
              schoolName
            }
            onChange={(
              event
            ) =>
              setSchoolName(
                event.target.value
              )
            }
            placeholder="○○塾"
            disabled={
              saving
            }
            autoComplete="organization"
            style={{
              width:
                "100%",

              padding:
                "12px",

              border:
                "1px solid #ccc",

              borderRadius:
                7,
            }}
          />
        </label>

        {/* =================================================
            School
            ================================================= */}

        <label
          style={{
            display:
              "block",

            marginTop:
              20,
          }}
        >
          <span
            style={{
              display:
                "block",

              marginBottom:
                7,

              fontSize:
                12,

              fontWeight:
                600,
            }}
          >
            最初の校舎名
          </span>

          <input
            value={
              schoolCode
            }
            onChange={(
              event
            ) =>
              setSchoolCode(
                event.target.value
              )
            }
            placeholder="本校"
            disabled={
              saving
            }
            style={{
              width:
                "100%",

              padding:
                "12px",

              border:
                "1px solid #ccc",

              borderRadius:
                7,
            }}
          />
        </label>

        {/* =================================================
            Error
            ================================================= */}

        {error && (
          <div
            role="alert"
            style={{
              marginTop:
                20,

              padding:
                14,

              border:
                "1px solid #efb5b5",

              borderRadius:
                8,

              background:
                "#fff4f4",

              color:
                "#9b1c1c",

              lineHeight:
                1.6,

              fontSize:
                12,
            }}
          >
            {
              error
            }
          </div>
        )}

        {/* =================================================
            Submit
            ================================================= */}

        <button
          type="button"
          disabled={
            saving
          }
          onClick={
            createOrganization
          }
          style={{
            width:
              "100%",

            marginTop:
              24,

            height:
              50,

            border:
              "none",

            borderRadius:
              8,

            background:
              "#111",

            color:
              "#fff",

            fontWeight:
              600,

            cursor:
              saving
                ? "default"
                : "pointer",

            opacity:
              saving
                ? 0.6
                : 1,
          }}
        >
          {saving
            ? "登録しています..."
            : "組織を登録して開始"}
        </button>
      </section>
    </main>
  );
}
