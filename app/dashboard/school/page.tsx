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
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Answer,
  Retest,
  Student,
  StudentResult,
  Test,
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

export default function SchoolDashboardPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    managerName,
    setManagerName,
  ] =
    useState("");

  const [
    students,
    setStudents,
  ] =
    useState<Student[]>(
      []
    );

  const [
    tests,
    setTests,
  ] =
    useState<Test[]>(
      []
    );

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
        "校舎管理者"
      ) {
        throw new Error(
          "この画面は校舎管理者用です。"
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

      setManagerName(
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
        studentDocuments,
        testDocuments,
        answerDocuments,
        resultDocuments,
        retestDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            studentsQueries(
              scopeUser
            )
          ),

          getScopedDocs(
            testsQueries(
              scopeUser
            )
          ),

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

      setStudents(
        studentDocuments.map(
          (
            item
          ) =>
            normalizeStudent(
              item.id,
              item.data
            )
        )
      );

      setTests(
        testDocuments
          .map(
            (
              item
            ) =>
              normalizeTest(
                item.id,
                item.data
              )
          )
          .filter(
            (
              test
            ) =>
              !test.isRetest
          )
      );

      setAnswers(
        answerDocuments.map(
          (
            item
          ) =>
            normalizeAnswer(
              item.id,
              item.data
            )
        )
      );

      setResults(
        resultDocuments.map(
          (
            item
          ) =>
            normalizeResult(
              item.id,
              item.data
            )
        )
      );

      setRetests(
        retestDocuments.map(
          (
            item
          ) =>
            normalizeRetest(
              item.id,
              item.data
            )
        )
      );
    } catch (
      error
    ) {
      console.error(
        "School dashboard error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "校舎ホームを取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Statistics
     ======================================================= */

  const activeStudents =
    students.filter(
      (
        student
      ) =>
        student.active
    ).length;

  const activeTests =
    tests.filter(
      (
        test
      ) =>
        test.active
    ).length;

  const firstReviewCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "first_review"
    ).length;

  const secondReviewCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "second_review"
    ).length;

  const processingCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "processing"
    ).length;

  const errorAnswerCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "error"
    ).length;

  const confirmedCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
          "confirmed" ||
        answer.status ===
          "published"
    ).length;

  const pendingRetests =
    retests.filter(
      (
        retest
      ) =>
        retest.status ===
          "未受験" ||
        retest.status ===
          "採点待ち"
    ).length;

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

  const latestResults =
    results.slice(
      0,
      10
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
            校舎ホームを読み込んでいます...
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
            {managerName
              ? `${managerName}さん`
              : "校舎ホーム"}
          </h1>

          <p
            className="muted"
            style={{
              margin:
                "6px 0 0",
            }}
          >
            所属校舎の生徒・テスト・採点・成績を管理します。
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
            Main actions
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
              href="/students"
              title="生徒管理"
              description="所属校舎の生徒を管理"
              count={
                activeStudents
              }
            />

            <ActionCard
              href="/tests"
              title="テスト管理"
              description="テストと問題を管理"
              count={
                activeTests
              }
            />

            <ActionCard
              href="/grading"
              title="採点管理"
              description="答案と採点状況を管理"
              count={
                answers.length
              }
            />
          </div>
        </section>

        {/* ==================================================
            Grading
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
                採点状況
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
                現在の答案処理状況です。
              </p>
            </div>

            <Link
              href="/grading"
              className="button"
            >
              採点管理
            </Link>
          </div>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(5, minmax(0, 1fr))",

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
              label="一次確認"
              value={
                firstReviewCount
              }
            />

            <InfoCard
              label="二次確認"
              value={
                secondReviewCount
              }
            />

            <InfoCard
              label="確定"
              value={
                confirmedCount
              }
            />
          </div>

          {errorAnswerCount >
            0 && (
            <div
              style={{
                marginTop:
                  12,

                padding:
                  12,

                borderRadius:
                  7,

                background:
                  "#fff1f1",

                color:
                  "#8a2222",

                fontSize:
                  12,
              }}
            >
              エラー答案：
              {
                errorAnswerCount
              }
              件
            </div>
          )}
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
                追試は通常採点とは分離して手採点します。
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

              justifyContent:
                "space-between",

              alignItems:
                "center",

              padding:
                14,

              borderRadius:
                8,

              background:
                "#f7f7f7",
            }}
          >
            <span>
              対応が必要な追試
            </span>

            <strong
              style={{
                fontSize:
                  24,
              }}
            >
              {
                pendingRetests
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
              href="/results/management"
              className="button"
            >
              成績一覧
            </Link>
          </div>

          {results.length ===
          0 ? (
            <EmptyState
              text="確定済みの成績はありません。"
            />
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
            Quick links
            ================================================== */}

        <section
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
                "repeat(2, minmax(0, 1fr))",

              gap:
                12,
            }}
          >
            <Link
              href="/reports/management"
              className="card"
              style={{
                display:
                  "block",

                textDecoration:
                  "none",

                color:
                  "inherit",
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
                    12,
                }}
              >
                確定済みの成績表を確認します。
              </p>
            </Link>

            <Link
              href="/qr-stickers"
              className="card"
              style={{
                display:
                  "block",

                textDecoration:
                  "none",

                color:
                  "inherit",
              }}
            >
              <strong>
                QRシール
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
                生徒用QRシールを管理します。
              </p>
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
   Info
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
      }}
    >
      {
        text
      }
    </div>
  );
}

/* =========================================================
   Normalize Student
   ========================================================= */

function normalizeStudent(
  id: string,
  data: Record<
    string,
    unknown
  >
): Student {
  return {
    id,

    organizationId:
      stringValue(
        data.organizationId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    name:
      stringValue(
        data.name
      ),

    grade:
      stringValue(
        data.grade
      ),

    className:
      stringValue(
        data.className
      ),

    schoolId:
      stringValue(
        data.schoolId
      ),

    active:
      data.active !==
      false,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Normalize Test
   ========================================================= */

function normalizeTest(
  id: string,
  data: Record<
    string,
    unknown
  >
): Test {
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
      ) ||
      id,

    name:
      stringValue(
        data.name
      ),

    subject:
      stringValue(
        data.subject
      ),

    grade:
      stringValue(
        data.grade
      ),

    className:
      stringValue(
        data.className
      ),

    examDate:
      stringValue(
        data.examDate
      ),

    totalScore:
      safeNumber(
        data.totalScore
      ),

    active:
      data.active !==
      false,

    isRetest:
      data.isRetest ===
      true,

    originalTestId:
      nullableString(
        data.originalTestId
      ),

    automaticGrading:
      data.automaticGrading ===
      true,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Normalize Answer
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
   Normalize Result
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
   Normalize Retest
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
