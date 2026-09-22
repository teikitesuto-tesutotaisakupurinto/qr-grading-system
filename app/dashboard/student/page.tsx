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
  gradeReportsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  GradeReport,
  StudentResult,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type ResultRow =
  StudentResult & {
    percentage: number;
  };

/* =========================================================
   Page
   ========================================================= */

export default function StudentDashboardPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    studentName,
    setStudentName,
  ] =
    useState("");

  const [
    studentNumber,
    setStudentNumber,
  ] =
    useState("");

  const [
    results,
    setResults,
  ] =
    useState<ResultRow[]>(
      []
    );

  const [
    reports,
    setReports,
  ] =
    useState<GradeReport[]>(
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

  /* =======================================================
     Load
     ======================================================= */

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
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
        !user.organizationId
      ) {
        throw new Error(
          "所属組織が設定されていません。"
        );
      }

      if (
        !user.studentId
      ) {
        throw new Error(
          "生徒情報がアカウントに紐付いていません。"
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

      const [
        resultDocuments,
        reportDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            resultsQueries(
              scopeUser
            )
          ),

          getScopedDocs(
            gradeReportsQueries(
              scopeUser
            )
          ),
        ]);

      const loadedResults =
        resultDocuments
          .map(
            (
              item
            ) =>
              normalizeResult(
                item.id,
                item.data
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              getTime(
                b.createdAt
              ) -
              getTime(
                a.createdAt
              )
          );

      const loadedReports =
        reportDocuments
          .map(
            (
              item
            ) =>
              normalizeReport(
                item.id,
                item.data
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              getTime(
                b.updatedAt ??
                  b.createdAt
              ) -
              getTime(
                a.updatedAt ??
                  a.createdAt
              )
          );

      setResults(
        loadedResults
      );

      setReports(
        loadedReports
      );

      const firstReport =
        loadedReports[0];

      if (
        firstReport
      ) {
        setStudentName(
          firstReport.studentName
        );

        setStudentNumber(
          firstReport.studentNumber
        );
      } else if (
        loadedResults[0]
      ) {
        setStudentNumber(
          loadedResults[0].studentNumber
        );
      }
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
          : "成績情報を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Statistics
     ======================================================= */

  const averagePercentage =
    results.length ===
    0
      ? null
      : results.reduce(
          (
            total,
            result
          ) =>
            total +
            result.percentage,
          0
        ) /
        results.length;

  const averageScore =
    results.length ===
    0
      ? null
      : results.reduce(
          (
            total,
            result
          ) =>
            total +
            result.score,
          0
        ) /
        results.length;

  const latestResults =
    results.slice(
      0,
      8
    );

  const latestReport =
    reports[0] ??
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
          <div
            style={{
              minHeight:
                400,

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",
            }}
          >
            成績を読み込んでいます...
          </div>
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

        {/* ==================================================
            Header
            ================================================== */}

        <header
          style={{
            marginBottom:
              24,
          }}
        >
          <div
            className="muted"
            style={{
              fontSize:
                12,
            }}
          >
            テストシステム
          </div>

          <h1
            style={{
              margin:
                "5px 0 0",
            }}
          >
            {studentName
              ? `${studentName}さん`
              : "生徒ホーム"}
          </h1>

          {studentNumber && (
            <p
              className="muted"
              style={{
                margin:
                  "5px 0 0",

                fontSize:
                  12,
              }}
            >
              生徒番号：
              {
                studentNumber
              }
            </p>
          )}

          <p
            className="muted"
            style={{
              margin:
                "6px 0 0",
            }}
          >
            あなたの確定済みの成績を確認できます。
          </p>
        </header>

        {/* ==================================================
            Error
            ================================================== */}

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
            Summary
            ================================================== */}

        <section>
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",

              gap:
                12,
            }}
          >
            <SummaryCard
              label="成績件数"
              value={
                results.length
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
              label="平均点"
              value={
                averageScore ===
                null
                  ? "—"
                  : averageScore.toFixed(
                      1
                    )
              }
            />
          </div>
        </section>

        {/* ==================================================
            Latest report
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              18,
          }}
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                12,
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                最新の成績表
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",

                  fontSize:
                    11,
                }}
              >
                確定済みの成績表です。
              </p>
            </div>

            <Link
              href="/student/reports"
              className="button"
            >
              成績表を見る
            </Link>
          </div>

          {!latestReport ? (
            <EmptyState
              text="まだ成績表はありません。"
            />
          ) : (
            <div
              style={{
                marginTop:
                  16,
              }}
            >
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
                <InfoCard
                  label="テスト"
                  value={
                    latestReport.testName
                  }
                />

                <InfoCard
                  label="実施日"
                  value={
                    latestReport.examDate ||
                    "—"
                  }
                />

                <InfoCard
                  label="総合得点"
                  value={`${latestReport.totalScore} / ${latestReport.totalMaxScore}`}
                />

                <InfoCard
                  label="順位"
                  value={formatRank(
                    latestReport.totalRank,
                    latestReport.totalPopulation
                  )}
                />
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            Results
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              18,
          }}
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                12,
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                最近の成績
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",

                    fontSize:
                      11,
                  }}
                >
                  採点確定済みの結果のみ表示しています。
                </p>
            </div>

            <Link
              href="/student/results"
              className="button"
            >
              成績一覧
            </Link>
          </div>

          {latestResults.length ===
          0 ? (
            <EmptyState
              text="確定済みの成績はありません。"
            />
          ) : (
            <div
              style={{
                overflowX:
                  "auto",

                marginTop:
                  14,
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
                      偏差値
                    </th>

                    <th>
                      順位
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {latestResults.map(
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
                            result.deviationScore ===
                            null
                              ? "—"
                              : result.deviationScore.toFixed(
                                  1
                                )
                          }
                        </td>

                        <td>
                          {
                            formatRank(
                              result.rank,
                              result.population
                            )
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ==================================================
            Student menu
            ================================================== */}

        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",

            gap:
              12,

            marginTop:
              18,
          }}
        >
          <Link
            href="/student/results"
            className="card"
            style={{
              display:
                "block",

              color:
                "inherit",

              textDecoration:
                "none",
            }}
          >
            <strong>
              成績一覧
            </strong>

            <p
              className="muted"
              style={{
                margin:
                  "5px 0 0",

                fontSize:
                  11,
              }}
            >
              自分の確定済み成績を確認します。
            </p>
          </Link>

          <Link
            href="/student/reports"
            className="card"
            style={{
              display:
                "block",

              color:
                "inherit",

              textDecoration:
                "none",
            }}
          >
            <strong>
              成績表
            </strong>

            <p
              className="muted"
              style={{
                margin:
                  "5px 0 0",

                fontSize:
                  11,
              }}
            >
              自分の成績表を確認します。
            </p>
          </Link>
        </section>
      </section>
    </main>
  );
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
            10,
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
            22,
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
   Info
   ========================================================= */

function InfoCard({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div
      style={{
        padding:
          12,

        background:
          "#f7f7f7",

        borderRadius:
          8,
      }}
    >
      <div
        className="muted"
        style={{
          fontSize:
            10,
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
            14,
        }}
      >
        {
          value ||
          "—"
        }
      </strong>
    </div>
  );
}

/* =========================================================
   Empty
   ========================================================= */

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        padding:
          40,

        textAlign:
          "center",

        color:
          "#777",

        fontSize:
          12,
      }}
    >
      {
        text
      }
    </div>
  );
}

/* =========================================================
   Normalize Result
   ========================================================= */

function normalizeResult(
  id: string,
  data: Record<
    string,
    unknown
  >
): ResultRow {
  const score =
    safeNumber(
      data.score
    );

  const maxScore =
    safeNumber(
      data.maxScore
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
      nullableNumber(
        data.percentage
      ) ??
      calculatePercentage(
        score,
        maxScore
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
   Normalize Report
   ========================================================= */

function normalizeReport(
  id: string,
  data: Record<
    string,
    unknown
  >
): GradeReport {
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

    studentName:
      stringValue(
        data.studentName
      ),

    schoolName:
      stringValue(
        data.schoolName
      ),

    grade:
      stringValue(
        data.grade
      ),

    className:
      stringValue(
        data.className
      ),

    gender:
      stringValue(
        data.gender
      ),

    enrolledSchool:
      stringValue(
        data.enrolledSchool
      ),

    testId:
      stringValue(
        data.testId
      ),

    testName:
      stringValue(
        data.testName
      ),

    examDate:
      stringValue(
        data.examDate
      ),

    subjects:
      [],

    totalScore:
      safeNumber(
        data.totalScore
      ),

    totalMaxScore:
      safeNumber(
        data.totalMaxScore
      ),

    totalAverage:
      nullableNumber(
        data.totalAverage
      ),

    totalDeviation:
      nullableNumber(
        data.totalDeviation
      ),

    totalRank:
      nullableNumber(
        data.totalRank
      ),

    totalPopulation:
      nullableNumber(
        data.totalPopulation
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Rank
   ========================================================= */

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
   Percentage
   ========================================================= */

function calculatePercentage(
  score: number,
  maxScore: number
) {
  if (
    maxScore <=
    0
  ) {
    return 0;
  }

  return (
    score /
    maxScore *
    100
  );
}

/* =========================================================
   Time
   ========================================================= */

function getTime(
  value: unknown
) {
  if (
    value &&
    typeof value ===
      "object" &&
    "toMillis" in
      value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis ===
      "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (
    value instanceof Date
  ) {
    return value.getTime();
  }

  const parsed =
    new Date(
      String(
        value ??
          ""
      )
    ).getTime();

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
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
