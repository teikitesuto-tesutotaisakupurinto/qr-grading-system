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

export default function StudentResultsPage() {
  const [
    results,
    setResults,
  ] =
    useState<ResultRow[]>(
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
    search,
    setSearch,
  ] =
    useState("");

  const [
    subjectFilter,
    setSubjectFilter,
  ] =
    useState("");

  const [
    sourceFilter,
    setSourceFilter,
  ] =
    useState<
      "all" | "通常" | "追試"
    >(
      "all"
    );

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

      const loaded =
        documents
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
              getTime(
                b.createdAt
              ) -
              getTime(
                a.createdAt
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
     Subjects
     ======================================================= */

  const subjects =
    useMemo(
      () =>
        Array.from(
          new Set(
            results
              .map(
                (
                  result
                ) =>
                  result.subject
              )
              .filter(
                Boolean
              )
          )
        ).sort(),
      [
        results,
      ]
    );

  /* =======================================================
     Filter
     ======================================================= */

  const filtered =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return results.filter(
        (
          result
        ) => {
          const searchMatch =
            !keyword ||
            result.testName
              .toLowerCase()
              .includes(
                keyword
              ) ||
            result.subject
              .toLowerCase()
              .includes(
                keyword
              );

          const subjectMatch =
            !subjectFilter ||
            result.subject ===
              subjectFilter;

          const sourceMatch =
            sourceFilter ===
              "all" ||
            result.source ===
              sourceFilter;

          return (
            searchMatch &&
            subjectMatch &&
            sourceMatch
          );
        }
      );
    }, [
      results,
      search,
      subjectFilter,
      sourceFilter,
    ]);

  /* =======================================================
     Summary
     ======================================================= */

  const averagePercentage =
    filtered.length ===
    0
      ? null
      : filtered.reduce(
          (
            total,
            result
          ) =>
            total +
            result.percentage,
          0
        ) /
        filtered.length;

  const averageScore =
    filtered.length ===
    0
      ? null
      : filtered.reduce(
          (
            total,
            result
          ) =>
            total +
            result.score,
          0
        ) /
        filtered.length;

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

        <header className="pageHeader">
          <div>
            <h1>
              成績一覧
            </h1>

            <p className="muted">
              あなた自身の確定済み成績です。
            </p>
          </div>

          <Link
            href="/dashboard/student"
            className="button"
          >
            ホーム
          </Link>
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

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",

            gap:
              12,

            marginBottom:
              16,
          }}
        >
          <SummaryCard
            label="成績件数"
            value={
              filtered.length
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

        {/* ==================================================
            Filters
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 180px 180px",

              gap:
                10,
            }}
          >
            <input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="テスト名・教科"
            />

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

            <select
              value={
                sourceFilter
              }
              onChange={(
                event
              ) =>
                setSourceFilter(
                  event.target
                    .value as
                    | "all"
                    | "通常"
                    | "追試"
                )
              }
            >
              <option value="all">
                通常・追試
              </option>

              <option value="通常">
                通常
              </option>

              <option value="追試">
                追試
              </option>
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
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              marginBottom:
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
                成績
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "4px 0 0",

                  fontSize:
                    11,
                }}
              >
                {
                  filtered.length
                }
                件
              </p>
            </div>

            <Link
              href="/student/reports"
              className="button"
            >
              成績表
            </Link>
          </div>

          {filtered.length ===
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
                      平均
                    </th>

                    <th>
                      偏差値
                    </th>

                    <th>
                      順位
                    </th>

                    <th>
                      種別
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (
                      result
                    ) => (
                      <tr
                        key={
                          result.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              result.testName
                            }
                          </strong>
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
                              : result.average.toFixed(
                                  1
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

                        <td>
                          <SourceBadge
                            source={
                              result.source
                            }
                          />
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
   Source
   ========================================================= */

function SourceBadge({
  source,
}: {
  source:
    | "通常"
    | "追試";
}) {
  return (
    <span
      style={{
        display:
          "inline-block",

        padding:
          "4px 8px",

        borderRadius:
          999,

        background:
          source ===
          "追試"
            ? "#f1f1f1"
            : "#e8f5e9",

        fontSize:
          10,
      }}
    >
      {
        source
      }
    </span>
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
          55,

        textAlign:
          "center",

        color:
          "#777",
      }}
    >
      <strong>
        成績はありません。
      </strong>

      <p
        style={{
          marginTop:
            6,

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
   Normalize
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
