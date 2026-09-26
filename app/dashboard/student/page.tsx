"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

/* =========================================================
   Types
   ========================================================= */

type Student = {
  id: string;

  name: string;

  studentNumber: string;

  grade: string;

  className: string;

  schoolName: string;
};

/* =========================================================
   Page
   ========================================================= */

export default function StudentDashboardPage() {
  const [
    student,
    setStudent,
  ] =
    useState<Student | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    void loadStudent();
  }, []);

  async function loadStudent() {
    try {
      setLoading(true);

      setError("");

      const user =
        await getAppUser(
          auth.currentUser
        );

      if (
        !user
      ) {
        throw new Error(
          "ログインしてください。"
        );
      }

      /*
       * 生徒アカウント専用
       */
      if (
        user.role !==
        "生徒"
      ) {
        throw new Error(
          "生徒画面ではありません。"
        );
      }

      /*
       * studentIdが必須
       */
      if (
        !user.studentId
      ) {
        throw new Error(
          "生徒情報がアカウントに紐付いていません。"
        );
      }

      const studentSnapshot =
        await getDoc(
          doc(
            db,
            "students",
            user.studentId
          )
        );

      if (
        !studentSnapshot.exists()
      ) {
        throw new Error(
          "生徒情報が見つかりません。"
        );
      }

      const data =
        studentSnapshot.data();

      setStudent({
        id:
          studentSnapshot.id,

        name:
          stringValue(
            data.name
          ),

        studentNumber:
          stringValue(
            data.studentNumber
          ),

        grade:
          stringValue(
            data.grade
          ),

        className:
          stringValue(
            data.className
          ),

        schoolName:
          stringValue(
            data.schoolName
          ),
      });
    } catch (
      error
    ) {
      console.error(
        "Student dashboard error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "生徒情報を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  if (
    loading
  ) {
    return (
      <main className="page">
        <section className="content">
          <h1>
            ホーム
          </h1>

          <p>
            読み込み中...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="page"
    >
      <section
        className="content"
        style={{
          maxWidth:
            1000,

          margin:
            "0 auto",
        }}
      >
        <header
          className="pageHeader"
        >
          <div>
            <h1>
              ホーム
            </h1>

            <p
              className="muted"
            >
              自分の成績と答案を確認できます。
            </p>
          </div>
        </header>


        {error && (
          <div
            className="errorMessage"
          >
            {
              error
            }
          </div>
        )}


        {student && (
          <section
            className="card"
            style={{
              marginBottom:
                16,
            }}
          >
            <h2>
              {
                student.name
              }
            </h2>

            <p
              className="muted"
            >
              生徒番号：
              {
                student.studentNumber
              }
            </p>

            <p
              className="muted"
            >
              {
                student.grade
              }

              {" / "}

              {
                student.className
              }

              {student.schoolName &&
                ` / ${student.schoolName}`}
            </p>
          </section>
        )}


        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",

            gap:
              16,
          }}
        >

          <Link
            href="/student/results"
            className="card"
            style={{
              textDecoration:
                "none",

              color:
                "inherit",
            }}
          >
            <h2>
              成績確認
            </h2>

            <p
              className="muted"
            >
              自分のテスト結果・成績表を確認します。
            </p>
          </Link>


          <Link
            href="/student/answers"
            className="card"
            style={{
              textDecoration:
                "none",

              color:
                "inherit",
            }}
          >
            <h2>
              答案確認
            </h2>

            <p
              className="muted"
            >
              自分の答案画像と採点結果を確認します。
            </p>
          </Link>

        </section>

      </section>
    </main>
  );
}


/* =========================================================
   Primitive
   ========================================================= */

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}
