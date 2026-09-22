"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  auth,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import {
  getScopedDocs,
  resultsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  StudentResult,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type ResultItem =
  StudentResult & {
    percentage: number;
  };

/* =========================================================
   Page
   ========================================================= */

export default function StudentResultsPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    results,
    setResults,
  ] =
    useState<ResultItem[]>(
      []
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

  const [
    testFilter,
    setTestFilter,
  ] =
    useState("");

  const [
    subjectFilter,
    setSubjectFilter,
  ] =
    useState("");

  /* =======================================================
     Load
     ======================================================= */

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
          "この画面は生徒用です。"
        );
      }

      if (
        !user.organizationId ||
        !user.studentId
      ) {
        throw new Error(
          "生徒情報が設定されていません。"
        );
      }

      setRole(
        user.role
      );

      const scopeUser:
        FirestoreUser =
        {
          uid:
            user.uid,

          organizationId:
            user.organizationId,

          role:
            user.role,

          schoolIds:
            user.schoolIds,

          studentId:
            user.studentId,
        };

      const documents =
        await getScopedDocs(
          resultsQueries(
            scopeUser
          )
        );

      /*
       * 念のためクライアント側でも
       * 自分のstudentIdだけに限定。
       */
      const loaded =
        documents
          .map(
            (
              document
            ) =>
              normalizeResult(
                document.id,
                document.data
              )
          )
          .filter(
            (
              result
            ) =>
              result.studentId ===
              user.studentId
          )
          .sort(
            (
              a,
              b
            ) =>
              String(
                b.createdAt ??
                  ""
              ).localeCompare(
                String(
                  a.createdAt ??
                    ""
                )
              )
          );

      setResults(
        loaded
      );
    } catch (
      error
    ) {
      console.error(
        "Student results error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "成績を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Options
     ======================================================= */

  const tests =
    useMemo(
      () =>
        Array.from(
          new Map(
            results.map(
              (
                result
              ) => [
                result.testId,
                result.testName,
              ]
            )
          ).entries()
        ),
      [
        results,
      ]
    );

  const subjects =
    useMemo(
      () =>
        Array.from(
          new Set(
            results.map(
              (
                result
              ) =>
                result.subject
            )
          )
        ).filter(
          Boolean
        ),
      [
        results,
      ]
    );

  /* =======================================================
     Filtered
     ======================================================= */

  const filteredResults =
    useMemo(
      () =>
        results.filter(
          (
            result
          ) => {
            const testMatch =
              !testFilter ||
              result.testId ===
                testFilter;

            const subjectMatch =
              !subjectFilter ||
              result.subject ===
                subjectFilter;

            return (
              testMatch &&
              subjectMatch
            );
          }
        ),
      [
        results,
        testFilter,
        subjectFilter,
      ]
    );

  /* =======================================================
     Statistics
     ======================================================= */

  const averagePercentage =
    calculateAverage(
      filteredResults.map(
        (
          result
        ) =>
          result.percentage
      )
    );

  const latest =
    filteredResults[0] ??
    null;

  /* =======================================================
     Loading
     ======================================================= */

  if (
    loading
  ) {
    return (
      <main className="page">
        <section className="content">
          <h1>
            成績
          </h1>

          <p>
            あなたの成績を読み込んでいます...
          </p>
        </section>
      </main>
    );
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <main className="page">
      <section className="content">

        <header className="pageHeader">
          <div>
            <h1>
              成績
            </h1>

            <p className="muted">
              あなたの確定済みテスト結果です。
            </p>
          </div>

          <Link
            href="/reports/student"
            className="button"
          >
            成績表
          </Link>
        </header>

        {error && (
          <div
            className="errorMessage"
            role="alert"
          >
            {
              error
            }
          </div>
        )}

        {/* ==================================================
            Latest
            ================================================== */}

        {latest && (
          <section
            className="card"
            style={{
              marginBottom:
                16,
            }}
          >
            <div
              className="muted"
              style={{
                fontSize:
                  12,
              }}
            >
              最新の成績
            </div>

            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

                alignItems:
                  "center",

                gap:
                  20,

                marginTop:
                  6,
              }}
            >
              <div>
                <h2
                  style={{
                    margin:
                      0,
                  }}
                >
                  {
                    latest.testName
                  }
                </h2>

                <p
                  className="muted"
                  style={{
                    margin:
                      "5px 0 0",
                  }}
                >
                  {
                    latest.subject
                  }
                </p>
              </div>

              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                <strong
                  style={{
                    fontSize:
                      30,
                  }}
                >
                  {
                    latest.score
                  }
                </strong>

                <span
                  className="muted"
                >
                  {" / "}
                  {
                    latest.maxScore
                  }
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ==================================================
            Summary
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",

            gap:
              12,

            marginBottom:
              18,
          }}
        >
          <SummaryCard
            label="成績件数"
            value={
              filteredResults.length
            }
          />

          <SummaryCard
            label="平均得点率"
            value={
              averagePercentage ===
              null
                ? "—"
                : `${averagePercentage.toFixed(
                    1
                  )}%`
            }
          />

          <SummaryCard
            label="最高得点率"
            value={
              getMaximumPercentage(
                filteredResults
              ) ===
              null
                ? "—"
                : `${getMaximumPercentage(
                    filteredResults
                  )!.toFixed(
                    1
                  )}%`
            }
          />
        </div>

        {/* ==================================================
            Filters
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr",

              gap:
                10,
            }}
          >
            <select
              value={
                testFilter
              }
              onChange={(
                event
              ) =>
                setTestFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                全テスト
              </option>

              {tests.map(
                (
                  [
                    testId,
                    testName,
                  ]
                ) => (
                  <option
                    key={
                      testId
                    }
                    value={
                      testId
                    }
                  >
                    {
                      testName
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                subjectFilter
              }
              onChange={(
                event
              ) =>
                setSubjectFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                全教科
              </option>

              {subjects.map(
                (
                  subject
                ) => (
                  <option
                    key={
                      subject
                    }
                    value={
                      subject
                    }
                  >
                    {
                      subject
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </section>

        {/* ==================================================
            Results
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >
          {filteredResults.length ===
          0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>
                      テスト
                    </th>

                    <th>
                      教科
                    </th>

                    <th>
                      得点
                    </th>

                    <th>
                      得点率
                    </th>

                    <th>
                      平均点
                    </th>

                    <th>
                      偏差値
                    </th>

                    <th>
                      順位
                    </th>

                    <th>
                      成績表
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredResults.map(
                    (
                      result
                    ) => (
                      <tr
                        key={
                          result.id
                        }
                      >
                        <td>
                          {
                            result.testName
                          }
                        </td>

                        <td>
                          {
                            result.subject
                          }
                        </td>

                        <td>
                          <strong>
                            {
                              result.score
                            }
                          </strong>

                          {" / "}

                          {
                            result.maxScore
                          }
                        </td>

                        <td>
                          {
                            result.percentage.toFixed(
                              1
                            )
                          }
                          %
                        </td>

                        <td>
                          {
                            result.average ===
                            null
                              ? "—"
                              : formatNumber(
                                  result.average
                                )
                          }
                        </td>

                        <td>
                          {
                            result.deviationScore ===
                            null
                              ? "—"
                              : result.deviationScore.toFixed(
                                  1
                                )}
                        </td>

                        <td>
                          {
                            formatRank(
                              result.rank,
                              result.population
                            )
                          }
                        </td>

                        <td>
                          <Link
                            href={`/reports/student?testId=${encodeURIComponent(
                              result.testId
                            )}`}
                            className="button"
                          >
                            成績表
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Normalize
   ========================================================= */

function normalizeResult(
  id: string,
  data: Record<
    string,
    unknown
  >
): ResultItem {
  const maxScore =
    safeNumber(
      data.maxScore
    );

  const score =
    safeNumber(
      data.score
    );

  return {
    id,

    organizationId:
      stringValue(
        data.organizationId
      ),

    schoolId:
      stringValue(
        data.schoolId
      ),

    studentId:
      stringValue(
        data.studentId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    testId:
      stringValue(
        data.testId
      ),

    testName:
      stringValue(
        data.testName
      ) ||
      "テスト未設定",

    subject:
      stringValue(
        data.subject
      ),

    score,

    maxScore,

    percentage:
      maxScore > 0
        ? (score /
            maxScore) *
          100
        : 0,

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

    source:
      data.source ===
      "追試"
        ? "追試"
        : "通常",

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Summary
   ========================================================= */

function SummaryCard({
  label,
  value,
}: {
  label: string;

  value:
    | string
    | number;
}) {
  return (
    <div className="card">
      <div
        className="muted"
        style={{
          fontSize:
            11,
        }}
      >
        {
          label
        }
      </div>

      <strong
        style={{
          display:
            "block",

          marginTop:
            4,

          fontSize:
            24,
        }}
      >
        {
          value
        }
      </strong>
    </div>
  );
}

/* =========================================================
   Empty
   ========================================================= */

function EmptyState() {
  return (
    <div
      style={{
        padding:
          60,

        textAlign:
          "center",

        color:
          "#777",
      }}
    >
      <strong>
        成績はまだありません。
      </strong>

      <p
        style={{
          fontSize:
            12,
        }}
      >
        採点が確定すると、ここに成績が表示されます。
      </p>
    </div>
  );
}

/* =========================================================
   Average
   ========================================================= */

function calculateAverage(
  values: number[]
) {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    values.length
  );
}

function getMaximumPercentage(
  results: ResultItem[]
) {
  if (
    results.length ===
    0
  ) {
    return null;
  }

  return Math.max(
    ...results.map(
      (
        result
      ) =>
        result.percentage
    )
  );
}

/* =========================================================
   Formatting
   ========================================================= */

function formatNumber(
  value: number
) {
  return Number.isInteger(
    value
  )
    ? String(
        value
      )
    : value.toFixed(
        1
      );
}

function formatRank(
  rank:
    | number
    | null,

  population:
    | number
    | null
) {
  if (
    rank ===
    null
  ) {
    return "—";
  }

  if (
    population ===
    null
  ) {
    return String(
      rank
    );
  }

  return `${rank} / ${population}`;
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

function nullableNumber(
  value: unknown
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
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

function safeNumber(
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
