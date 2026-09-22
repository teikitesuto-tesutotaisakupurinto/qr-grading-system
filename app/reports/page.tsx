"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import SchoolHeader from "@/components/SchoolHeader";

import GradeReport, {
  type GradeReportData,
  type SectionResult,
} from "@/components/GradeReport";

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

type ReportResult =
  StudentResult;

type ReportStatus =
  | "未生成"
  | "生成済み"
  | "配信済み"
  | "紙のみ";

/* =========================================================
   Page
   ========================================================= */

export default function ReportsPage() {
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
    results,
    setResults,
  ] =
    useState<ReportResult[]>(
      []
    );

  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState("");

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] =
    useState("");

  const [
    isRetest,
    setIsRetest,
  ] =
    useState(false);

  const [
    status,
    setStatus,
  ] =
    useState<ReportStatus>(
      "未生成"
    );

  const [
    template,
    setTemplate,
  ] =
    useState("通常テスト用");

  const [
    delivery,
    setDelivery,
  ] =
    useState<
      "データ配信" | "紙のみ"
    >(
      "データ配信"
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
          .filter(
            (
              result
            ) =>
              result.score >=
                0 &&
              result.maxScore >=
                0
          );

      setResults(
        loaded
      );

      /*
       * 実データが存在する場合だけ
       * 最初のテスト・生徒を選択。
       */
      if (
        loaded.length >
        0
      ) {
        setSelectedTestId(
          loaded[0].testId
        );

        setSelectedStudentId(
          loaded[0].studentId
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Reports load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "成績データを取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Tests
     ======================================================= */

  const tests =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            {
              id: string;
              name: string;
            }
          >();

        results.forEach(
          (
            result
          ) => {
            if (
              !map.has(
                result.testId
              )
            ) {
              map.set(
                result.testId,
                {
                  id:
                    result.testId,

                  name:
                    result.testName,
                }
              );
            }
          }
        );

        return Array.from(
          map.values()
        );
      },
      [
        results,
      ]
    );

  /* =======================================================
     Students
     ======================================================= */

  const students =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            {
              id: string;
              name: string;
              number: string;
            }
          >();

        results
          .filter(
            (
              result
            ) =>
              !selectedTestId ||
              result.testId ===
                selectedTestId
          )
          .forEach(
            (
              result
            ) => {
              if (
                !map.has(
                  result.studentId
                )
              ) {
                map.set(
                  result.studentId,
                  {
                    id:
                      result.studentId,

                    name:
                      result.studentNumber ||
                      "生徒",

                    number:
                      result.studentNumber,
                  }
                );
              }
            }
          );

        return Array.from(
          map.values()
        );
      },
      [
        results,
        selectedTestId,
      ]
    );

  /* =======================================================
     Selected results
     ======================================================= */

  const selectedResults =
    useMemo(
      () =>
        results.filter(
          (
            result
          ) =>
            result.testId ===
              selectedTestId &&
            result.studentId ===
              selectedStudentId
        ),
      [
        results,
        selectedTestId,
        selectedStudentId,
      ]
    );

  /* =======================================================
     Report data
     ======================================================= */

  const reportData =
    useMemo<GradeReportData | null>(
      () => {
        if (
          selectedResults.length ===
          0
        ) {
          return null;
        }

        return buildReportData(
          selectedResults,
          isRetest
        );
      },
      [
        selectedResults,
        isRetest,
      ]
    );

  /* =======================================================
     Generate
     ======================================================= */

  function generateReport() {
    if (
      !reportData
    ) {
      setError(
        "成績表を生成できる成績データがありません。"
      );

      return;
    }

    setError("");

    setStatus(
      "生成済み"
    );
  }

  /* =======================================================
     Deliver
     ======================================================= */

  function deliverReport() {
    if (
      status ===
      "未生成"
    ) {
      return;
    }

    if (
      isRetest
    ) {
      setDelivery(
        "紙のみ"
      );

      setStatus(
        "紙のみ"
      );

      return;
    }

    setDelivery(
      "データ配信"
    );

    setStatus(
      "配信済み"
    );
  }

  /* =======================================================
     Print
     ======================================================= */

  function printReport() {
    if (
      !reportData
    ) {
      setError(
        "印刷する成績表がありません。"
      );

      return;
    }

    window.print();
  }

  /* =======================================================
     Loading
     ======================================================= */

  if (
    loading
  ) {
    return (
      <main className="page">
        <SchoolHeader
          title="成績表"
        />

        <section className="content">
          <div
            className="card"
            style={{
              padding:
                50,

              textAlign:
                "center",
            }}
          >
            成績データを読み込んでいます...
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
      <SchoolHeader
        title="成績表"
      />

      <section className="content">

        {/* ==================================================
            Header
            ================================================== */}

        <div className="pageHeader">
          <div>
            <h1>
              成績表
            </h1>

            <p className="muted">
              確定済みの成績から成績表を生成・確認します。
            </p>
          </div>

          <Link
            href="/results"
            className="button"
          >
            成績一覧
          </Link>
        </div>

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
            Settings
            ================================================== */}

        <section className="card">
          <h2>
            成績表設定
          </h2>

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
            {/* Test */}

            <label>
              <span
                style={{
                  display:
                    "block",

                  marginBottom:
                    6,

                  fontSize:
                    12,

                  fontWeight:
                    600,
                }}
              >
                テスト
              </span>

              <select
                value={
                  selectedTestId
                }
                onChange={(
                  event
                ) => {
                  setSelectedTestId(
                    event.target
                      .value
                  );

                  setSelectedStudentId(
                    ""
                  );

                  setStatus(
                    "未生成"
                  );
                }}
              >
                <option value="">
                  テストを選択
                </option>

                {tests.map(
                  (
                    test
                  ) => (
                    <option
                      key={
                        test.id
                      }
                      value={
                        test.id
                      }
                    >
                      {
                        test.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {/* Student */}

            <label>
              <span
                style={{
                  display:
                    "block",

                  marginBottom:
                    6,

                  fontSize:
                    12,

                  fontWeight:
                    600,
                }}
              >
                生徒
              </span>

              <select
                value={
                  selectedStudentId
                }
                onChange={(
                  event
                ) => {
                  setSelectedStudentId(
                    event.target
                      .value
                  );

                  setStatus(
                    "未生成"
                  );
                }}
              >
                <option value="">
                  生徒を選択
                </option>

                {students.map(
                  (
                    student
                  ) => (
                    <option
                      key={
                        student.id
                      }
                      value={
                        student.id
                      }
                    >
                      {
                        student.number
                      }
                      {" / "}
                      {
                        student.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {/* Template */}

            <label>
              <span
                style={{
                  display:
                    "block",

                  marginBottom:
                    6,

                  fontSize:
                    12,

                  fontWeight:
                    600,
                }}
              >
                成績表テンプレート
              </span>

              <select
                value={
                  template
                }
                onChange={(
                  event
                ) => {
                  setTemplate(
                    event.target
                      .value
                  );

                  setStatus(
                    "未生成"
                  );
                }}
              >
                <option>
                  通常テスト用
                </option>

                <option>
                  詳細成績表
                </option>

                <option>
                  模試用
                </option>

                <option>
                  追試用
                </option>
              </select>
            </label>
          </div>

          {/* Retest */}

          <div
            style={{
              marginTop:
                16,

              padding:
                12,

              borderRadius:
                8,

              background:
                "#f7f7f7",
            }}
          >
            <label
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  8,

                cursor:
                  "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={
                  isRetest
                }
                onChange={(
                  event
                ) => {
                  setIsRetest(
                    event.target
                      .checked
                  );

                  setStatus(
                    "未生成"
                  );

                  if (
                    event.target
                      .checked
                  ) {
                    setDelivery(
                      "紙のみ"
                    );
                  } else {
                    setDelivery(
                      "データ配信"
                    );
                  }
                }}
                style={{
                  width:
                    16,

                  minHeight:
                    16,
                }}
              />

              <span
                style={{
                  fontSize:
                    12,

                  fontWeight:
                    600,
                }}
              >
                追試の成績表
              </span>
            </label>

            <p
              className="muted"
              style={{
                margin:
                  "6px 0 0",

                fontSize:
                  11,
              }}
            >
              追試の場合は紙返却のみとして扱います。
            </p>
          </div>

          {/* Actions */}

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
                !reportData
              }
              onClick={
                generateReport
              }
            >
              成績表を生成
            </button>

            <button
              type="button"
              className="button"
              disabled={
                !reportData
              }
              onClick={
                printReport
              }
            >
              印刷
            </button>

            <button
              type="button"
              className="button"
              disabled={
                status ===
                "未生成"
              }
              onClick={
                deliverReport
              }
            >
              {isRetest
                ? "紙返却用に確定"
                : "データ配信"}
            </button>
          </div>
        </section>

        {/* ==================================================
            Status
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,

            display:
              "flex",

            flexWrap:
              "wrap",

            gap:
              14,
          }}
        >
          <strong>
            現在の状態：
            {status}
          </strong>

          <span>
            テンプレート：
            {template}
          </span>

          <span>
            配信：
            {delivery}
          </span>

          {role && (
            <span>
              権限：
              {role}
            </span>
          )}
        </section>

        {/* ==================================================
            Report
            ================================================== */}

        <section
          style={{
            marginTop:
              24,
          }}
        >
          {!reportData ? (
            <section
              className="card"
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
                成績表を表示できません。
              </strong>

              <p
                style={{
                  margin:
                    "7px 0 0",

                  fontSize:
                    12,
                }}
              >
                確定済みの成績データが登録されると、
                ここに成績表が表示されます。
              </p>
            </section>
          ) : (
            <GradeReport
              data={
                reportData
              }
            />
          )}
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Build report data
   ========================================================= */

function buildReportData(
  results: ReportResult[],
  isRetest: boolean
): GradeReportData {
  const first =
    results[0];

  const subjects =
    results.map(
      (
        result
      ) => ({
        subject:
          result.subject,

        score:
          result.score,

        maxScore:
          result.maxScore,

        percentage:
          result.maxScore >
          0
            ? result.score /
                result.maxScore *
              100
            : 0,

        deviationScore:
          result.deviationScore ??
          undefined,

        rank:
          result.rank ??
          undefined,
      })
    );

  const totalScore =
    results.reduce(
      (
        total,
        result
      ) =>
        total +
        result.score,
      0
    );

  const totalMaxScore =
    results.reduce(
      (
        total,
        result
      ) =>
        total +
        result.maxScore,
      0
    );

  const totalPercentage =
    totalMaxScore >
    0
      ? totalScore /
          totalMaxScore *
        100
      : 0;

  const deviations =
    results
      .map(
        (
          result
        ) =>
          result.deviationScore
      )
      .filter(
        (
          value
        ): value is number =>
          value !==
          null
      );

  const averageDeviation =
    deviations.length >
    0
      ? deviations.reduce(
          (
            total,
            value
          ) =>
            total +
            value,
          0
        ) /
        deviations.length
      : undefined;

  const ranks =
    results
      .map(
        (
          result
        ) =>
          result.rank
      )
      .filter(
        (
          value
        ): value is number =>
          value !==
          null
      );

  const overallRank =
    ranks.length >
    0
      ? Math.min(
          ...ranks
        )
      : undefined;

  const sections:
    SectionResult[] =
    [];

  return {
    studentName:
      first.studentNumber ||
      "生徒",

    studentNumber:
      first.studentNumber,

    testName:
      first.testName,

    testDate:
      formatDate(
        first.createdAt
      ),

    subjects,

    sections,

    totalScore,

    totalMaxScore,

    totalPercentage,

    totalDeviationScore:
      averageDeviation,

    overallRank,

    schoolRank:
      undefined,

    gradeRank:
      undefined,

    classRank:
      undefined,

    isRetest,
  };
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
): StudentResult {
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

    answerId:
      nullableString(
        data.answerId
      ),

    retestId:
      nullableString(
        data.retestId
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
      (
        maxScore >
        0
          ? score /
              maxScore *
            100
          : 0
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
   Date
   ========================================================= */

function formatDate(
  value: unknown
) {
  if (
    value &&
    typeof value ===
      "object" &&
    "toDate" in
      value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate ===
      "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    )
      .toDate()
      .toLocaleDateString(
        "ja-JP"
      );
  }

  if (
    value instanceof Date
  ) {
    return value.toLocaleDateString(
      "ja-JP"
    );
  }

  if (
    typeof value ===
    "string"
  ) {
    const date =
      new Date(
        value
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date.toLocaleDateString(
        "ja-JP"
      );
    }
  }

  return "—";
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
