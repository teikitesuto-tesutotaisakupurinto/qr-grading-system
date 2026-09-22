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

type ResultRow =
  StudentResult & {
    percentage: number;
  };

/* =========================================================
   Page
   ========================================================= */

export default function ResultsManagementPage() {
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

  const [
    selectedIds,
    setSelectedIds,
  ] =
    useState<string[]>(
      []
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
        user.role ===
        "生徒"
      ) {
        throw new Error(
          "この画面は管理者・講師用です。"
        );
      }

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織が設定されていません。"
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

      setSelectedIds(
        []
      );
    } catch (
      error
    ) {
      console.error(
        "Results management load error:",
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
            result.studentNumber
              .toLowerCase()
              .includes(
                keyword
              ) ||
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
     Statistics
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

  const selectedCount =
    selectedIds.length;

  /* =======================================================
     Selection
     ======================================================= */

  const allVisibleSelected =
    filtered.length >
      0 &&
    filtered.every(
      (
        result
      ) =>
        selectedIds.includes(
          result.id
        )
    );

  function toggleResult(
    id: string
  ) {
    setSelectedIds(
      (
        current
      ) =>
        current.includes(
          id
        )
          ? current.filter(
              (
                currentId
              ) =>
                currentId !==
                id
            )
          : [
              ...current,
              id,
            ]
    );
  }

  function toggleAllVisible() {
    if (
      allVisibleSelected
    ) {
      const visibleIds =
        new Set(
          filtered.map(
            (
              result
            ) =>
              result.id
          )
        );

      setSelectedIds(
        (
          current
        ) =>
          current.filter(
            (
              id
            ) =>
              !visibleIds.has(
                id
              )
          )
      );

      return;
    }

    setSelectedIds(
      (
        current
      ) =>
        Array.from(
          new Set([
            ...current,
            ...filtered.map(
              (
                result
              ) =>
                result.id
            ),
          ])
        )
    );
  }

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
            成績を読み込んでいます...
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

        {/* ==================================================
            Header
            ================================================== */}

        <header className="pageHeader">
          <div>
            <h1>
              成績
            </h1>

            <p className="muted">
              採点確定済みの成績だけを表示しています。
            </p>
          </div>

          <div
            style={{
              display:
                "flex",

              gap:
                8,
            }}
          >
            <Link
              href="/grading/confirm"
              className="button"
            >
              採点確定
            </Link>

            <Link
              href="/reports/management"
              className="button"
            >
              成績表
            </Link>
          </div>
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
              "repeat(4, minmax(0, 1fr))",

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

          <SummaryCard
            label="選択中"
            value={
              selectedCount
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
                "1fr 200px 180px auto",

              gap:
                10,

              alignItems:
                "center",
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
              placeholder="生徒番号・テスト名・教科"
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

            <button
              type="button"
              className="button"
              onClick={
                toggleAllVisible
              }
              disabled={
                filtered.length ===
                0
              }
            >
              {allVisibleSelected
                ? "表示分を解除"
                : "表示分を選択"}
            </button>
          </div>
        </section>

        {/* ==================================================
            Data
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
                成績一覧
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

            {selectedCount >
              0 && (
              <span
                className="muted"
                style={{
                  fontSize:
                    12,
                }}
              >
                {
                  selectedCount
                }
                件選択中
              </span>
            )}
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
                    <th
                      style={{
                        width:
                          45,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          allVisibleSelected
                        }
                        onChange={
                          toggleAllVisible
                        }
                        aria-label="表示中の成績をすべて選択"
                      />
                    </th>

                    <th>
                      生徒番号
                    </th>

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
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(
                              result.id
                            )}
                            onChange={() =>
                              toggleResult(
                                result.id
                              )
                            }
                            aria-label={`${result.studentNumber}の成績を選択`}
                          />
                        </td>

                        <td>
                          <strong>
                            {
                              result.studentNumber
                            }
                          </strong>
                        </td>

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

        {/* ==================================================
            Footer links
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
              16,
          }}
        >
          <Link
            href="/reports/management"
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
              成績表を確認
            </strong>

            <p
              className="muted"
              style={{
                margin:
                  "5px 0 0",

                fontSize:
                  12,
              }}
            >
              生徒ごとの科目別成績・偏差値・順位を確認します。
            </p>
          </Link>

          <Link
            href="/grading"
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
              採点へ戻る
            </strong>

            <p
              className="muted"
              style={{
                margin:
                  "5px 0 0",

                fontSize:
                  12,
              }}
            >
              未確定の答案は採点画面から確認します。
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
            21,
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
          60,

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
        採点確定した成績が登録されると、ここに表示されます。
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

  const storedPercentage =
    nullableNumber(
      data.percentage
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
      storedPercentage ??
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
