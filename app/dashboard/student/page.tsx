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
  gradeReportsQueries,
  resultsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  GradeReport,
  StudentResult,
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

export default function StudentDashboardPage() {
  const [
    studentName,
    setStudentName,
  ] = useState("");

  const [
    studentNumber,
    setStudentNumber,
  ] = useState("");

  const [
    results,
    setResults,
  ] = useState<ResultItem[]>(
    []
  );

  const [
    reports,
    setReports,
  ] = useState<GradeReport[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

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

      if (!user) {
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

      setStudentName(
        user.name
      );

      const scopeUser:
        FirestoreUser = {
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
          .filter(
            (
              report
            ) =>
              report.studentId ===
              user.studentId
          )
          .sort(
            (
              a,
              b
            ) =>
              String(
                b.examDate
              ).localeCompare(
                String(
                  a.examDate
                )
              )
          );

      setResults(
        loadedResults
      );

      setReports(
        loadedReports
      );

      setStudentNumber(
        loadedResults[0]
          ?.studentNumber ??
          loadedReports[0]
            ?.studentNumber ??
          ""
      );
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
          : "ホーム情報を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Statistics
     ======================================================= */

  const averagePercentage =
    useMemo(() => {
      if (
        results.length ===
        0
      ) {
        return null;
      }

      return (
        results.reduce(
          (
            total,
            result
          ) =>
            total +
            result.percentage,
          0
        ) /
        results.length
      );
    }, [
      results,
    ]);

  const latestResult =
    results[0] ??
    null;

  const latestReport =
    reports[0] ??
    null;

  const latestDeviation =
    latestReport?.totalDeviation ??
    latestResult?.deviationScore ??
    null;

  const latestRank =
    latestReport?.totalRank ??
    latestResult?.rank ??
    null;

  const latestPopulation =
    latestReport?.totalPopulation ??
    latestResult?.population ??
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
              padding:
                60,

              textAlign:
                "center",
            }}
          >
            ホームを読み込んでいます...
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
              : "ホーム"}
          </h1>

          {studentNumber && (
            <p
              className="muted"
              style={{
                margin:
                  "5px 0 0",
              }}
            >
              生徒番号：
              {
                studentNumber
              }
            </p>
          )}
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
            Main links
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",

            gap:
              14,
          }}
        >
          <DashboardLink
            href="/results/student"
            title="成績"
            description="確定したテスト結果を確認"
          />

          <DashboardLink
            href="/reports/student"
            title="成績表"
            description="科目別成績・偏差値・順位・度数分布を確認"
          />
        </div>

        {/* ==================================================
            Latest result
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
                最新の成績
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                確定済みの結果のみ表示しています。
              </p>
            </div>

            <Link
              href="/results/student"
              className="button"
            >
              成績一覧
            </Link>
          </div>

          {!latestResult &&
          !latestReport ? (
            <EmptyLatest />
          ) : (
            <div
              style={{
                marginTop:
                  18,
              }}
            >
              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(4, minmax(0, 1fr))",

                  gap:
                    10,
                }}
              >
                <InfoCard
                  label="テスト"
                  value={
                    latestReport?.testName ??
                    latestResult?.testName ??
                    "—"
                  }
                />

                <InfoCard
                  label="得点"
                  value={
                    latestReport
                      ? `${latestReport.totalScore} / ${latestReport.totalMaxScore}`
                      : latestResult
                        ? `${latestResult.score} / ${latestResult.maxScore}`
                        : "—"
                  }
                />

                <InfoCard
                  label="偏差値"
                  value={
                    latestDeviation ===
                    null
                      ? "—"
                      : latestDeviation.toFixed(
                          1
                        )
                  }
                />

                <InfoCard
                  label="順位"
                  value={
                    formatRank(
                      latestRank,
                      latestPopulation
                    )
                  }
                />
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            History
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
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                成績の推移
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                過去の確定結果
              </p>
            </div>

            {averagePercentage !==
              null && (
              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                <div
                  className="muted"
                  style={{
                    fontSize:
                      11,
                  }}
                >
                  平均得点率
                </div>

                <strong
                  style={{
                    fontSize:
                      22,
                  }}
                >
                  {
                    averagePercentage.toFixed(
                      1
                    )
                  }
                  %
                </strong>
              </div>
            )}
          </div>

          {results.length ===
          0 ? (
            <EmptyHistory />
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
                  {results
                    .slice(
                      0,
                      10
                    )
                    .map(
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
            Report history
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
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                成績表
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                最新の成績表を確認できます。
              </p>
            </div>

            <Link
              href="/reports/student"
              className="button"
            >
              成績表を見る
            </Link>
          </div>

          {reports.length ===
          0 ? (
            <EmptyHistory />
          ) : (
            <div
              style={{
                marginTop:
                  14,
              }}
            >
              {reports
                .slice(
                  0,
                  5
                )
                .map(
                  (
                    report
                  ) => (
                    <Link
                      key={
                        report.id
                      }
                      href={`/reports/student?testId=${encodeURIComponent(
                        report.testId
                      )}`}
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        alignItems:
                          "center",

                        gap:
                          12,

                        padding:
                          "12px 0",

                        borderBottom:
                          "1px solid #eee",

                        textDecoration:
                          "none",

                        color:
                          "inherit",
                      }}
                    >
                      <div>
                        <strong>
                          {
                            report.testName
                          }
                        </strong>

                        <div
                          className="muted"
                          style={{
                            marginTop:
                              3,

                            fontSize:
                              11,
                          }}
                        >
                          {
                            report.examDate ||
                            "実施日未設定"
                          }
                        </div>
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        <strong>
                          {
                            report.totalScore
                          }
                          {" / "}
                          {
                            report.totalMaxScore
                          }
                        </strong>

                        <div
                          className="muted"
                          style={{
                            fontSize:
                              11,
                          }}
                        >
                          偏差値：
                          {
                            report.totalDeviation ===
                            null
                              ? "—"
                              : report.totalDeviation.toFixed(
                                  1
                                )}
                        </div>
                      </div>
                    </Link>
                  )
                )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Dashboard link
   ========================================================= */

function DashboardLink({
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
      className="card"
      style={{
        display:
          "block",

        textDecoration:
          "none",

        color:
          "inherit",

        padding:
          20,
      }}
    >
      <strong
        style={{
          fontSize:
            18,
        }}
      >
        {
          title
        }
      </strong>

      <p
        className="muted"
        style={{
          margin:
            "6px 0 0",

          fontSize:
            12,

          lineHeight:
            1.6,
        }}
      >
        {
          description
        }
      </p>
    </Link>
  );
}

/* =========================================================
   Info card
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
            16,
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

function EmptyLatest() {
  return (
    <div
      style={{
        padding:
          40,

        textAlign:
          "center",

        color:
          "#777",
      }}
    >
      <strong>
        まだ成績がありません。
      </strong>

      <p
        style={{
          fontSize:
            12,
        }}
      >
        採点確定した成績が登録されると、ここに表示されます。
      </p>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div
      style={{
        padding:
          30,

        textAlign:
          "center",

        color:
          "#777",

        fontSize:
          12,
      }}
    >
      確定済みの成績データはありません。
    </div>
  );
}

/* =========================================================
   Normalize result
   ========================================================= */

function normalizeResult(
  id: string,
  data: Record<
    string,
    unknown
  >
): ResultItem {
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
   Normalize report
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
      normalizeSubjects(
        data.subjects
      ),

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
   Subjects
   ========================================================= */

function normalizeSubjects(
  value: unknown
): GradeReportSubject[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value.map(
    (
      item
    ) => {
      const data =
        item &&
        typeof item ===
          "object"
          ? item as Record<
              string,
              unknown
            >
          : {};

      return {
        subject:
          stringValue(
            data.subject
          ),

        maxScore:
          safeNumber(
            data.maxScore
          ),

        score:
          safeNumber(
            data.score
          ),

        average:
          nullableNumber(
            data.average
          ),

        deviation:
          nullableNumber(
            data.deviation
          ),

        rank:
          nullableNumber(
            data.rank
          ),

        population:
          nullableNumber(
            data.population
          ),

        distribution:
          [],
      };
    }
  );
}

/* =========================================================
   Formatting
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
