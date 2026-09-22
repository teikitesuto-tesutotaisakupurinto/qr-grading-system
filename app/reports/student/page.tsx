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
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  GradeReport,
  GradeReportSubject,
} from "@/lib/types";

/* =========================================================
   Page
   ========================================================= */

export default function StudentReportsPage() {
  const [
    reports,
    setReports,
  ] =
    useState<GradeReport[]>(
      []
    );

  const [
    selectedReportId,
    setSelectedReportId,
  ] =
    useState<
      string | null
    >(null);

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
    void loadReports();
  }, []);

  async function loadReports() {
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
          gradeReportsQueries(
            scopeUser
          )
        );

      /*
       * gradeReportsQueries() は生徒の場合、
       * 自分のstudentIdだけを取得する。
       */
      const loaded =
        documents
          .map(
            (
              document
            ) =>
              normalizeReport(
                document.id,
                document.data
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

      setReports(
        loaded
      );

      setSelectedReportId(
        (
          current
        ) => {
          if (
            current &&
            loaded.some(
              (
                report
              ) =>
                report.id ===
                current
            )
          ) {
            return current;
          }

          return (
            loaded[0]?.id ??
            null
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        "Student report load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "成績表を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Selected
     ======================================================= */

  const selectedReport =
    reports.find(
      (
        report
      ) =>
        report.id ===
        selectedReportId
    ) ??
    null;

  /* =======================================================
     Summary
     ======================================================= */

  const deviationHistory =
    useMemo(
      () =>
        [...reports]
          .filter(
            (
              report
            ) =>
              report.totalDeviation !==
              null
          )
          .sort(
            (
              a,
              b
            ) =>
              String(
                a.examDate
              ).localeCompare(
                String(
                  b.examDate
                )
              )
          ),
      [
        reports,
      ]
    );

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
            成績表
          </h1>

          <p>
            あなたの成績表を読み込んでいます...
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
              成績表
            </h1>

            <p className="muted">
              あなたの確定済みの成績を確認できます。
            </p>
          </div>

          <Link
            href="/results/student"
            className="button"
          >
            成績一覧
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
            Report selector
            ================================================== */}

        {reports.length >
          0 && (
          <section className="card">
            <label>
              <strong>
                テストを選択
              </strong>

              <select
                value={
                  selectedReportId ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  setSelectedReportId(
                    event.target
                      .value ||
                      null
                  )
                }
                style={{
                  display:
                    "block",

                  width:
                    "100%",

                  maxWidth:
                    600,

                  marginTop:
                    7,
                }}
              >
                {reports.map(
                  (
                    report
                  ) => (
                    <option
                      key={
                        report.id
                      }
                      value={
                        report.id
                      }
                    >
                      {
                        report.testName
                      }

                      {report.examDate &&
                        ` / ${report.examDate}`}
                    </option>
                  )
                )}
              </select>
            </label>
          </section>
        )}

        {/* ==================================================
            Current report
            ================================================== */}

        {selectedReport ? (
          <CurrentReport
            report={
              selectedReport
            }
          />
        ) : (
          <EmptyReport />
        )}

        {/* ==================================================
            History
            ================================================== */}

        {deviationHistory.length >
          0 && (
          <section
            className="card"
            style={{
              marginTop:
                18,
            }}
          >
            <h2>
              過去の成績推移
            </h2>

            <p className="muted">
              確定済み成績の偏差値推移です。
            </p>

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
                      日付
                    </th>

                    <th>
                      テスト
                    </th>

                    <th>
                      総得点
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
                  {deviationHistory.map(
                    (
                      report
                    ) => (
                      <tr
                        key={
                          report.id
                        }
                        onClick={() =>
                          setSelectedReportId(
                            report.id
                          )
                        }
                        style={{
                          cursor:
                            "pointer",
                        }}
                      >
                        <td>
                          {
                            report.examDate ||
                            "—"
                          }
                        </td>

                        <td>
                          {
                            report.testName
                          }
                        </td>

                        <td>
                          {
                            report.totalScore
                          }
                          {" / "}
                          {
                            report.totalMaxScore
                          }
                        </td>

                        <td>
                          {
                            report.totalDeviation ===
                            null
                              ? "—"
                              : report.totalDeviation.toFixed(
                                  1
                                )}
                        </td>

                        <td>
                          {
                            report.totalRank ===
                            null
                              ? "—"
                              : report.totalRank
                          }

                          {report.totalPopulation !==
                            null &&
                            ` / ${report.totalPopulation}`}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

/* =========================================================
   Current report
   ========================================================= */

function CurrentReport({
  report,
}: {
  report: GradeReport;
}) {
  return (
    <article
      className="card"
      style={{
        marginTop:
          18,
      }}
    >
      {/* Header */}

      <header
        style={{
          paddingBottom:
            18,

          borderBottom:
            "1px solid #eee",
        }}
      >
        <div
          className="muted"
          style={{
            fontSize:
              12,
          }}
        >
          {
            report.examDate ||
            "実施日未設定"
          }
        </div>

        <h2
          style={{
            margin:
              "5px 0 0",
          }}
        >
          {
            report.testName
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
            report.grade
          }

          {report.className &&
            ` / ${report.className}`}
        </p>
      </header>

      {/* Total */}

      <section
        style={{
          marginTop:
            20,
        }}
      >
        <h3>
          今回の成績
        </h3>

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
          <ResultCard
            label="総得点"
            value={
              `${report.totalScore} / ${report.totalMaxScore}`
            }
          />

          <ResultCard
            label="平均点"
            value={
              formatNumber(
                report.totalAverage
              )
            }
          />

          <ResultCard
            label="偏差値"
            value={
              formatNumber(
                report.totalDeviation
              )
            }
          />

          <ResultCard
            label="順位"
            value={
              report.totalRank ===
              null
                ? "—"
                : report.totalPopulation ===
                  null
                  ? String(
                      report.totalRank
                    )
                  : `${report.totalRank} / ${report.totalPopulation}`
            }
          />
        </div>
      </section>

      {/* Subjects */}

      <section
        style={{
          marginTop:
            24,
        }}
      >
        <h3>
          科目別成績
        </h3>

        {report.subjects.length ===
        0 ? (
          <p className="muted">
            科目別成績はまだありません。
          </p>
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
                    科目
                  </th>

                  <th>
                    得点
                  </th>

                  <th>
                    受験者平均
                  </th>

                  <th>
                    偏差値
                  </th>

                  <th>
                    順位
                  </th>

                  <th>
                    受験者数
                  </th>
                </tr>
              </thead>

              <tbody>
                {report.subjects.map(
                  (
                    subject
                  ) => (
                    <tr
                      key={
                        subject.subject
                      }
                    >
                      <td>
                        <strong>
                          {
                            subject.subject
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          subject.score
                        }
                        {" / "}
                        {
                          subject.maxScore
                        }
                      </td>

                      <td>
                        {
                          formatNumber(
                            subject.average
                          )
                        }
                      </td>

                      <td>
                        {
                          formatNumber(
                            subject.deviation
                          )
                        }
                      </td>

                      <td>
                        {
                          formatRank(
                            subject.rank,
                            subject.population
                          )
                        }
                      </td>

                      <td>
                        {
                          subject.population ??
                          "—"
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

      {/* Distribution */}

      <section
        style={{
          marginTop:
            24,
        }}
      >
        <h3>
          度数分布
        </h3>

        <DistributionSection
          subjects={
            report.subjects
          }
        />
      </section>
    </article>
  );
}

/* =========================================================
   Result card
   ========================================================= */

function ResultCard({
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
          14,

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
            5,

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
   Distribution
   ========================================================= */

function DistributionSection({
  subjects,
}: {
  subjects: GradeReportSubject[];
}) {
  const distributions =
    combineDistributions(
      subjects
    );

  if (
    distributions.length ===
    0
  ) {
    return (
      <p className="muted">
        度数分布データはありません。
      </p>
    );
  }

  return (
    <div
      style={{
        display:
          "grid",

        gridTemplateColumns:
          "repeat(auto-fit, minmax(140px, 1fr))",

        gap:
          10,
      }}
    >
      {distributions.map(
        (
          item
        ) => (
          <div
            key={
              item.range
            }
            style={{
              padding:
                14,

              border:
                "1px solid #ddd",

              borderRadius:
                8,

              background:
                item.selected
                  ? "#f5f5f5"
                  : "#fff",
            }}
          >
            <div
              className="muted"
              style={{
                fontSize:
                  11,
              }}
            >
              {
                item.range
              }
            </div>

            <strong
              style={{
                display:
                  "block",

                marginTop:
                  5,

                fontSize:
                  22,
              }}
            >
              {
                item.count
              }
            </strong>

            <div
              className="muted"
              style={{
                fontSize:
                  11,
              }}
            >
              人
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* =========================================================
   Combine distribution
   ========================================================= */

function combineDistributions(
  subjects: GradeReportSubject[]
) {
  const map =
    new Map<
      string,
      {
        range: string;

        minScore: number;

        maxScore: number;

        count: number;

        selected: boolean;
      }
    >();

  for (
    const subject of
      subjects
  ) {
    for (
      const item of
        subject.distribution
    ) {
      const current =
        map.get(
          item.range
        );

      map.set(
        item.range,
        {
          range:
            item.range,

          minScore:
            item.minScore,

          maxScore:
            item.maxScore,

          count:
            (current?.count ??
              0) +
            item.count,

          selected:
            Boolean(
              current?.selected
            ) ||
            item.selected,
        }
      );
    }
  }

  return Array.from(
    map.values()
  ).sort(
    (
      a,
      b
    ) =>
      a.minScore -
      b.minScore
  );
}

/* =========================================================
   Normalize
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
          normalizeDistribution(
            data.distribution
          ),
      };
    }
  );
}

/* =========================================================
   Distribution normalization
   ========================================================= */

function normalizeDistribution(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
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
          range:
            stringValue(
              data.range
            ),

          minScore:
            safeNumber(
              data.minScore
            ),

          maxScore:
            safeNumber(
              data.maxScore
            ),

          count:
            safeNumber(
              data.count
            ),

          selected:
            data.selected ===
            true,
        };
      }
    )
    .filter(
      (
        item
      ) =>
        item.range
    );
}

/* =========================================================
   Formatting
   ========================================================= */

function formatNumber(
  value:
    | number
    | null
) {
  if (
    value ===
    null
  ) {
    return "—";
  }

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

/* =========================================================
   Empty
   ========================================================= */

function EmptyReport() {
  return (
    <section
      className="card"
      style={{
        marginTop:
          18,
      }}
    >
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
          成績表がありません。
        </strong>

        <p
          style={{
            fontSize:
              12,
          }}
        >
          採点確定済みの成績表が登録されると、ここに表示されます。
        </p>
      </div>
    </section>
  );
}
