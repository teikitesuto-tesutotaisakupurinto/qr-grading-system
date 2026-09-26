"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import {
  getAnswerWithUrl,
} from "@/lib/answers";


type StudentAnswer = {
  id: string;

  testName: string;

  subject: string;

  imageUrl: string | null;

  score: number;

  maxScore: number;

  status: string;

  createdAt: unknown;
};


export default function StudentAnswersPage() {
  const [
    answers,
    setAnswers,
  ] =
    useState<StudentAnswer[]>(
      []
    );

  const [
    studentName,
    setStudentName,
  ] =
    useState("");

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
    void loadAnswers();
  }, []);


  async function loadAnswers() {
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


      if (
        user.role !==
        "生徒"
      ) {
        throw new Error(
          "生徒画面ではありません。"
        );
      }


      if (
        !user.studentId
      ) {
        throw new Error(
          "生徒情報がアカウントに紐付いていません。"
        );
      }


      /*
       * 生徒情報取得
       */
      const studentSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "students"
            ),
            where(
              "__name__",
              "==",
              user.studentId
            )
          )
        );


      if (
        !studentSnapshot.empty
      ) {
        setStudentName(
          String(
            studentSnapshot.docs[0]
              .data()
              .name ??
            ""
          )
        );
      }


      /*
       * 本人答案のみ取得
       */
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "answers"
            ),
            where(
              "studentId",
              "==",
              user.studentId
            ),
            orderBy(
              "createdAt",
              "desc"
            )
          )
        );


      const result =
        await Promise.all(
          snapshot.docs.map(
            async (
              item
            ) => {

              const data =
                item.data();

              let imageUrl:
                string |
                null =
                null;


              try {
                const image =
                  await getAnswerWithUrl(
                    item.id
                  );

                imageUrl =
                  image?.signedUrl ??
                  null;

              } catch (
                imageError
              ) {
                console.error(
                  imageError
                );
              }


              return {
                id:
                  item.id,

                testName:
                  stringValue(
                    data.testName
                  ) ||
                  "テスト",

                subject:
                  stringValue(
                    data.subject
                  ) ||
                  stringValue(
                    data.subjectId
                  ),

                imageUrl,

                score:
                  numberValue(
                    data.totalScore
                  ),

                maxScore:
                  numberValue(
                    data.totalMaxScore
                  ),

                status:
                  stringValue(
                    data.status
                  ),

                createdAt:
                  data.createdAt,
              };
            }
          )
        );


      setAnswers(
        result
      );

    } catch (
      error
    ) {
      console.error(
        "Student answers error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "答案を取得できませんでした。"
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  if (
    loading
  ) {
    return (
      <main className="page">
        <section className="content">
          <h1>
            答案確認
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
              答案確認
            </h1>

            <p className="muted">
              {
                studentName
              }
              さんの答案
            </p>
          </div>


          <Link
            href="/dashboard/student"
            className="button"
          >
            ホームへ戻る
          </Link>
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


        {answers.length ===
        0 ? (
          <section className="card">
            <p>
              答案はありません。
            </p>
          </section>
        ) : (
          answers.map(
            (
              answer
            ) => (
              <section
                key={
                  answer.id
                }
                className="card"
                style={{
                  marginBottom:
                    16,
                }}
              >

                <h2>
                  {
                    answer.testName
                  }
                </h2>


                <p
                  className="muted"
                >
                  {
                    answer.subject
                  }
                </p>


                {answer.imageUrl && (
                  <div
                    style={{
                      textAlign:
                        "center",

                      marginTop:
                        16,
                    }}
                  >
                    <img
                      src={
                        answer.imageUrl
                      }
                      alt="答案"
                      style={{
                        maxWidth:
                          "100%",

                        border:
                          "1px solid #ddd",

                        borderRadius:
                          8,
                      }}
                    />
                  </div>
                )}


                <div
                  style={{
                    marginTop:
                      16,

                    padding:
                      14,

                    background:
                      "#f7f7f7",

                    borderRadius:
                      8,
                  }}
                >
                  <strong>
                    得点
                  </strong>

                  <div
                    style={{
                      fontSize:
                        24,

                      marginTop:
                        6,
                    }}
                  >
                    {
                      answer.score
                    }
                    {" / "}
                    {
                      answer.maxScore
                    }
                  </div>

                  <p
                    className="muted"
                  >
                    状態：
                    {
                      answer.status ||
                      "処理中"
                    }
                  </p>

                </div>

              </section>
            )
          )
        )}

      </section>
    </main>
  );
}


/* =========================================================
   Helpers
   ========================================================= */

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}


function numberValue(
  value: unknown
) {
  const number =
    Number(
      value ??
      0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
