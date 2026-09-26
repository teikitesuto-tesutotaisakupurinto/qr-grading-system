"use client";

import {
  useEffect,
  useMemo,
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
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";


type StudentResult = {
  id: string;

  testName: string;

  subject: string;

  score: number;

  maxScore: number;

  average: number | null;

  deviationScore: number | null;

  rank: number | null;

  population: number | null;

  examDate: string;
};


export default function StudentResultsPage() {
  const [
    results,
    setResults,
  ] =
    useState<StudentResult[]>(
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
    void loadResults();
  }, []);


  async function loadResults() {
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
       * 生徒情報
       */
      const studentSnapshot =
        await import(
          "firebase/firestore"
        ).then(
          ({
            getDoc,
            doc,
          }) =>
            getDoc(
              doc(
                db,
                "students",
                user.studentId!
              )
            )
        );


      if (
        studentSnapshot.exists()
      ) {
        setStudentName(
          String(
            studentSnapshot.data()
              .name ?? ""
          )
        );
      }


      /*
       * 自分の成績のみ取得
       */
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "results"
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


      const loaded =
        snapshot.docs.map(
          (
            item
          ) => {
            const data =
              item.data();

            return {
              id:
                item.id,

              testName:
                stringValue(
                  data.testName
                ),

              subject:
                stringValue(
                  data.subject
                ),

              score:
                numberValue(
                  data.score
                ),

              maxScore:
                numberValue(
                  data.maxScore
                ),

              average:
                nullableNumber(
                  data.average
                ),

              deviationScore:
                nullableNumber(
                  data.deviationScore
                ),

              rank:
                nullableNumber(
                  data.rank
                ),

              population:
                nullableNumber(
                  data.population
                ),

              examDate:
                stringValue(
                  data.examDate
                ),
            };
          }
        );


      setResults(
        loaded
      );


    } catch (
      error
    ) {
      console.error(
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "成績を取得できませんでした。"
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  const grouped =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            StudentResult[]
          >();

        results.forEach(
          (
            result
          ) => {
            const list =
              map.get(
                result.testName
              ) ??
              [];

            list.push(
              result
            );

            map.set(
              result.testName,
              list
            );
          }
        );

        return Array.from(
          map.entries()
        );
      },
      [
        results,
      ]
    );


  if (
    loading
  ) {
    return (
      <main className="page">
        <section className="content">
          <h1>
            成績一覧
          </h1>

          <p>
            読み込み中...
          </p>
        </section>
      </main>
    );
  }


  return (
    <main className="page">
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
              成績一覧
            </h1>

            <p className="muted">
              {
                studentName
              }
              さんの成績
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


        {grouped.length ===
        0 ? (
          <section className="card">
            <p>
              成績がありません。
            </p>
          </section>
        ) : (
          grouped.map(
            (
              [
                testName,
                items,
              ]
            ) => (
              <section
                key={
                  testName
                }
                className="card"
                style={{
                  marginBottom:
                    16,
                }}
              >

                <h2>
                  {
                    testName
                  }
                </h2>


                {items.map(
                  (
                    result
                  ) => (
                    <div
                      key={
                        result.id
                      }
                      style={{
                        padding:
                          14,

                        borderBottom:
                          "1px solid #eee",
                      }}
                    >

                      <strong>
                        {
                          result.subject
                        }
                      </strong>


                      <div
                        style={{
                          marginTop:
                            8,

                          fontSize:
                            20,
                        }}
                      >
                        {
                          result.score
                        }
                        {" / "}
                        {
                          result.maxScore
                        }
                      </div>


                      <div
                        className="muted"
                        style={{
                          marginTop:
                            8,
                        }}
                      >
                        平均：
                        {
                          result.average ??
                          "—"
                        }

                        {"　"}

                        偏差値：
                        {
                          result.deviationScore ??
                          "—"
                        }

                        {"　"}

                        順位：
                        {
                          result.rank ?? 
                          "—"
                        }

                        {
                          result.population
                            ? ` / ${result.population}`
                            : ""
                        }
                      </div>

                    </div>
                  )
                )}

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


function nullableNumber(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}
