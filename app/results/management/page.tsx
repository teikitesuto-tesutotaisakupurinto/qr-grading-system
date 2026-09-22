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

type PublicationStatus =
  | "未公開"
  | "公開済み";

type CalculationStatus =
  | "未計算"
  | "計算済み";

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

  const [
    publicationStatus,
    setPublicationStatus,
  ] =
    useState<PublicationStatus>(
      "未公開"
    );

  const [
    calculationStatus,
    setCalculationStatus,
  ] =
    useState<CalculationStatus>(
      "未計算"
    );

  const [
    processing,
    setProcessing,
  ] =
    useState(false);

  const [
    processMessage,
    setProcessMessage,
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

      /*
       * 現在のデータに計算済み情報があるか確認。
       */
      const hasCalculatedData =
        loaded.some(
          (
            result
          ) =>
            result.average !==
              null ||
            result.deviationScore !==
              null ||
            result.rank !==
              null
        );

      setCalculationStatus(
        hasCalculatedData
          ? "計算済み"
          : "未計算"
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
        current: string[]
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
          current: string[]
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
        current: string[]
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
     Publication
     ======================================================= */

  /*
   * 現時点では、正式な「点数公開」APIが
   * lib/results.tsにまだ存在しないため、
   * UI上の状態だけを勝手にFirestoreへ
   * 書き込まない。
   */
  function handlePublication() {
    setError("");

    setProcessMessage(
      "点数公開処理は、全員の採点確定を確認する公開処理と接続してから実行します。"
    );
  }

  /* =======================================================
     Calculation
     ======================================================= */

  function handleCalculation() {
    setError("");

    if (
      publicationStatus !==
      "公開済み"
    ) {
      setProcessMessage(
        "先に全員分の点数を公開してください。"
      );

      return;
    }

    setProcessMessage(
      "成績計算処理は、平均・偏差値・順位を一括計算する処理と接続してから実行します。"
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
              採点確定後の点数公開・成績計算を管理します。
            </p>
          </div>

          <Link
            href="/reports"
            className="button"
          >
            成績表
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

        {processMessage && (
          <div
            className="successMessage"
            role="status"
          >
            {
              processMessage
            }
          </div>
        )}

        {/* ==================================================
            Workflow
            ================================================== */}

        <section className="card">
          <h2>
            成績処理
          </h2>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",

              gap:
                12,

              marginTop:
                12,
            }}
          >
            {/* Step 1 */}

            <WorkflowCard
              number="1"
              title="採点確定"
              status="採点確定済み"
              description="全員・全問題の採点が確定してから次へ進みます。"
              completed={
                results.length >
                0
              }
            />

            {/* Step 2 */}

            <WorkflowCard
              number="2"
              title="点数公開"
              status={
                publicationStatus
              }
              description="確定した点数を公開します。"
              completed={
                publicationStatus ===
                "公開済み"
              }
            />

            {/* Step 3 */}

            <WorkflowCard
              number="3"
              title="成績計算"
              status={
                calculationStatus
              }
              description="公開後に平均・偏差値・順位を計算します。"
              completed={
                calculationStatus ===
                "計算済み"
              }
            />
          </div>

          <div
            style={{
              display:
                "flex",

              flexWrap:
                "wrap",

              gap:
                8,

              marginTop:
                16,
            }}
          >
            <button
              type="button"
              className="button primary"
              disabled={
                processing ||
                results.length ===
                  0 ||
                publicationStatus ===
                  "公開済み"
              }
              onClick={
                handlePublication
              }
            >
              点数を公開
            </button>

            <button
              type="button"
              className="button"
              disabled={
                processing ||
                publicationStatus !==
                  "公開済み" ||
                calculationStatus ===
                  "計算済み"
              }
              onClick={
                handleCalculation
              }
            >
              成績計算
            </button>
          </div>
        </section>

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

            marginTop:
              16,

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
                  event.target.value
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
                  event.target.value
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
            Report
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >
          <h2>
            次の処理
          </h2>

          <p
            className="muted"
            style={{
              fontSize:
                12,

              margin:
                "5px 0 12px",
            }}
          >
            点数公開と成績計算が完了したら、成績表を作成できます。
          </p>

          <Link
            href="/reports"
            className="button"
          >
            成績表を確認
          </Link>
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Workflow Card
   ========================================================= */

function WorkflowCard({
  number,
  title,
  status,
  description,
  completed,
}: {
  number: string;

  title: string;

  status: string;

  description: string;

  completed: boolean;
}) {
  return (
    <div
      style={{
        padding:
          16,

        border:
          "1px solid #ddd",

        borderRadius:
          9,

        background:
          completed
            ? "#f5faf6"
            : "#fff",
      }}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          gap:
            8,
        }}
      >
        <span
          style={{
            width:
              28,

            height:
              28,

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            borderRadius:
              "50%",

            background:
              completed
                ? "#e1f0e4"
                : "#eee",

            fontSize:
              11,

            fontWeight:
              700,
          }}
        >
          {
            number
          }
        </span>

        <strong>
          {
            title
          }
        </strong>
      </div>

      <div
        style={{
          marginTop:
            10,

          fontSize:
            12,

          fontWeight:
            600,
        }}
      >
        {
          status
        }
      </div>

      <p
        className="muted"
        style={{
          margin:
            "5px 0 0",

          fontSize:
            10,

          lineHeight:
            1.6,
        }}
      >
        {
          description
        }
      </p>
    </div>
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
