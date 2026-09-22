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
  answersQueries,
  resultsQueries,
  retestsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Answer,
  Retest,
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

export default function TeacherDashboardPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    teacherName,
    setTeacherName,
  ] =
    useState("");

  const [
    answers,
    setAnswers,
  ] =
    useState<Answer[]>(
      []
    );

  const [
    results,
    setResults,
  ] =
    useState<ResultItem[]>(
      []
    );

  const [
    retests,
    setRetests,
  ] =
    useState<Retest[]>(
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
        "講師"
      ) {
        throw new Error(
          "この画面は講師用です。"
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

      setTeacherName(
        user.name
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
        answerDocuments,
        resultDocuments,
        retestDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            answersQueries(
              scopeUser
            )
          ),

          getScopedDocs(
            resultsQueries(
              scopeUser
            )
          ),

          getScopedDocs(
            retestsQueries(
              scopeUser
            )
          ),
        ]);

      const loadedAnswers =
        answerDocuments.map(
          (
            item
          ) =>
            normalizeAnswer(
              item.id,
              item.data
            )
        );

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
          );

      const loadedRetests =
        retestDocuments.map(
          (
            item
          ) =>
            normalizeRetest(
              item.id,
              item.data
            )
        );

      setAnswers(
        loadedAnswers
      );

      setResults(
        loadedResults
      );

      setRetests(
        loadedRetests
      );
    } catch (
      error
    ) {
      console.error(
        "Teacher dashboard error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "講師ホームを取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Statistics
     ======================================================= */

  const firstReviewCount =
    useMemo(
      () =>
        answers.filter(
          (
            answer
          ) =>
            answer.status ===
            "first_review"
        ).length,
      [
        answers,
      ]
    );

  const secondReviewCount =
    useMemo(
      () =>
        answers.filter(
          (
            answer
          ) =>
            answer.status ===
            "second_review"
        ).length,
      [
        answers,
      ]
    );

  const processingCount =
    useMemo(
      () =>
        answers.filter(
          (
            answer
          ) =>
            answer.status ===
            "processing"
        ).length,
      [
        answers,
      ]
    );

  const errorCount =
    useMemo(
      () =>
        answers.filter(
          (
            answer
          ) =>
            answer.status ===
            "error"
        ).length,
      [
        answers,
      ]
    );

  const waitingRetestCount =
    useMemo(
      () =>
        retests.filter(
          (
            retest
          ) =>
            retest.status ===
              "未受験" ||
            retest.status ===
              "採点待ち"
        ).length,
      [
        retests,
      ]
    );

  const confirmedResultCount =
    results.length;

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

  const latestResults =
    results.slice(
      0,
      8
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
            講師ホームを読み込んでいます...
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
            {teacherName
              ? `${teacherName}先生`
              : "講師ホーム"}
          </h1>

          <p
            className="muted"
            style={{
              margin:
                "6px 0 0",
            }}
          >
            担当範囲の採点・成績を確認できます。
          </p>
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
            Important actions
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
            <ActionCard
              href="/grading"
              title="採点管理"
              description="答案の受付・採点状況を確認"
              count={
                answers.length
              }
            />

            <ActionCard
              href="/grading/review"
              title="一次確認"
              description="確認が必要な答案"
              count={
                firstReviewCount
              }
            />

            <ActionCard
              href="/grading/second-review"
              title="二次確認"
              description="二次確認が必要な答案"
              count={
                secondReviewCount
              }
            />
          </div>
        </section>

        {/* ==================================================
            Processing
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
                採点状況
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                担当範囲の実データです。
              </p>
            </div>

            <Link
              href="/grading"
              className="button"
            >
              詳細を見る
            </Link>
          </div>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",

              gap:
                10,

              marginTop:
                18,
            }}
          >
            <InfoCard
              label="答案"
              value={
                answers.length
              }
            />

            <InfoCard
              label="処理中"
              value={
                processingCount
              }
            />

            <InfoCard
              label="エラー"
              value={
                errorCount
              }
            />

            <InfoCard
              label="確定成績"
              value={
                confirmedResultCount
              }
            />
          </div>
        </section>

        {/* ==================================================
            Retest
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
                追試
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",
                  fontSize:
                    12,
                }}
              >
                追試は手動採点です。
              </p>
            </div>

            <Link
              href="/retests"
              className="button"
            >
              追試管理
            </Link>
          </div>

          <div
            style={{
              marginTop:
                16,

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "space-between",

              padding:
                14,

              background:
                "#f7f7f7",

              borderRadius:
                8,
            }}
          >
            <span>
              採点・対応が必要な追試
            </span>

            <strong
              style={{
                fontSize:
                  22,
              }}
            >
              {
                waitingRetestCount
              }
            </strong>
          </div>
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
                    "5px 0 0",
                  fontSize:
                    12,
                }}
              >
                採点確定済みの成績です。
              </p>
            </div>

            <Link
              href="/results/teacher"
              className="button"
            >
              成績一覧
            </Link>
          </div>

          {latestResults.length ===
          0 ? (
            <div
              style={{
                padding:
                  35,

                textAlign:
                  "center",

                color:
                  "#777",
              }}
            >
              <strong>
                確定済みの成績はありません。
              </strong>

              <p
                style={{
                  fontSize:
                    12,
                }}
              >
                採点を確定すると、ここに表示されます。
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",

                  gap:
                    10,

                  marginTop:
                    16,
                }}
              >
                <InfoCard
                  label="成績件数"
                  value={
                    results.length
                  }
                />

                <InfoCard
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
              </div>

              <div
                style={{
                  overflowX:
                    "auto",

                  marginTop:
                    16,
                }}
              >
                <table className="dataTable">
                  <thead>
                    <tr>
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
                              result.studentNumber
                            }
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
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* ==================================================
            Report
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
                  fontSize:
                    12,
                }}
              >
                担当範囲の生徒の成績表を確認できます。
              </p>
            </div>

            <Link
              href="/reports/teacher"
              className="button"
            >
              成績表を開く
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Action card
   ========================================================= */

function ActionCard({
  href,
  title,
  description,
  count,
}: {
  href: string;

  title: string;

  description: string;

  count: number;
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
            "flex-start",

          gap:
            10,
        }}
      >
        <div>
          <strong
            style={{
              fontSize:
                17,
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
                "5px 0 0",

              fontSize:
                11,

              lineHeight:
                1.6,
            }}
          >
            {
              description
            }
          </p>
        </div>

        <strong
          style={{
            fontSize:
              24,
          }}
        >
          {
            count
          }
        </strong>
      </div>
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

  value:
    | string
    | number;
}) {
  return (
    <div
      style={{
        padding:
          13,

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
            19,
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
   Answer
   ========================================================= */

function normalizeAnswer(
  id: string,
  data: Record<
    string,
    unknown
  >
): Answer {
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

    testId:
      stringValue(
        data.testId
      ),

    subjectId:
      stringValue(
        data.subjectId
      ),

    studentId:
      nullableString(
        data.studentId
      ),

    studentNumber:
      nullableString(
        data.studentNumber
      ),

    fileKey:
      stringValue(
        data.fileKey
      ),

    fileName:
      stringValue(
        data.fileName
      ),

    contentType:
      stringValue(
        data.contentType
      ),

    size:
      safeNumber(
        data.size
      ),

    status:
      normalizeAnswerStatus(
        data.status
      ),

    reviewRequired:
      data.reviewRequired ===
      true,

    totalScore:
      safeNumber(
        data.totalScore
      ),

    totalMaxScore:
      safeNumber(
        data.totalMaxScore
      ),

    qrText:
      stringValue(
        data.qrText
      ),

    qrConfidence:
      safeNumber(
        data.qrConfidence
      ),

    ocrConfidence:
      safeNumber(
        data.ocrConfidence
      ),

    processingError:
      stringValue(
        data.processingError
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    processedAt:
      data.processedAt,

    confirmedAt:
      data.confirmedAt,
  };
}

/* =========================================================
   Result
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
   Retest
   ========================================================= */

function normalizeRetest(
  id: string,
  data: Record<
    string,
    unknown
  >
): Retest {
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

    originalTestId:
      stringValue(
        data.originalTestId
      ),

    studentId:
      stringValue(
        data.studentId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    retestTestId:
      stringValue(
        data.retestTestId
      ),

    scheduledDate:
      stringValue(
        data.scheduledDate
      ),

    status:
      normalizeRetestStatus(
        data.status
      ),

    manualScore:
      nullableNumber(
        data.manualScore
      ),

    manualMaxScore:
      safeNumber(
        data.manualMaxScore
      ),

    finalized:
      data.finalized ===
      true,

    appliedToResult:
      data.appliedToResult ===
      true,

    createdBy:
      stringValue(
        data.createdBy
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Status
   ========================================================= */

function normalizeAnswerStatus(
  value: unknown
): Answer["status"] {
  switch (
    value
  ) {
    case "uploaded":
    case "processing":
    case "graded":
    case "first_review":
    case "second_review":
    case "confirmed":
    case "published":
    case "error":
      return value;

    default:
      return "uploaded";
  }
}

function normalizeRetestStatus(
  value: unknown
): Retest["status"] {
  switch (
    value
  ) {
    case "未受験":
    case "採点待ち":
    case "採点済み":
    case "確定":
      return value;

    default:
      return "未受験";
  }
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

function nullableString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : null;
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
