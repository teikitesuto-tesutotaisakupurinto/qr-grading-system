"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

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

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const firebaseUser =
          auth.currentUser;

        if (!firebaseUser) {
          router.replace(
            "/login"
          );
          return;
        }

        const appUser =
          await getAppUser(
            firebaseUser
          );

        /*
         * 既に正式ユーザーなら
         * オンボーディング不要。
         */
        if (
          appUser.organizationId &&
          appUser.role
        ) {
          router.replace(
            "/dashboard"
          );

          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "アカウント情報を確認できません。"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function createOrganization() {
    if (saving) {
      return;
    }

    const firebaseUser =
      auth.currentUser;

    if (!firebaseUser) {
      router.replace(
        "/login"
      );
      return;
    }

    const trimmedName =
      schoolName.trim();

    const trimmedCode =
      schoolCode.trim();

    if (!trimmedName) {
      setError(
        "塾・組織名を入力してください。"
      );
      return;
    }

    if (!trimmedCode) {
      setError(
        "最初の校舎名を入力してください。"
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      /*
       * organizations
       */
      const organizationRef =
        doc(
          collection(
            db,
            "organizations"
          )
        );

      /*
       * schools
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
        writeBatch(db);

      /*
       * 組織
       */
      batch.set(
        organizationRef,
        {
          name:
            trimmedName,

          ownerUid:
            firebaseUser.uid,

          logoUrl:
            "",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * 最初の校舎
       */
      batch.set(
        schoolRef,
        {
          organizationId:
            organizationRef.id,

          name:
            trimmedCode,

          logoUrl:
            "",

          settings: {},

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * ログインした本人を
       * 本部管理者にする。
       */
      batch.set(
        userRef,
        {
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

          active:
            true,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      await batch.commit();

      router.replace(
        "/dashboard"
      );
    } catch (err) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "組織の登録に失敗しました。"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return null;
  }

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
        <h1
          style={{
            marginTop: 0,
          }}
        >
          組織を登録
        </h1>

        <p
          style={{
            color:
              "#666",

            lineHeight:
              1.7,
          }}
        >
          最初に塾・組織と校舎を登録します。
          あなたは本部管理者として登録されます。
        </p>

        <label
          style={{
            display:
              "block",

            marginTop:
              24,
          }}
        >
          塾・組織名

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
            style={{
              display:
                "block",

              width:
                "100%",

              marginTop:
                8,

              padding:
                "12px",

              border:
                "1px solid #ccc",

              borderRadius:
                7,
            }}
          />
        </label>

        <label
          style={{
            display:
              "block",

            marginTop:
              20,
          }}
        >
          最初の校舎名

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
            style={{
              display:
                "block",

              width:
                "100%",

              marginTop:
                8,

              padding:
                "12px",

              border:
                "1px solid #ccc",

              borderRadius:
                7,
            }}
          />
        </label>

        {error && (
          <div
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
            }}
          >
            {error}
          </div>
        )}

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
