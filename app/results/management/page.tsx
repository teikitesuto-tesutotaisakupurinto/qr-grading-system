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
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Student,
  Test,
  StudentResult,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type ResultRow =
  StudentResult & {
    studentName: string;
    testSubject: string;
  };

/* =========================================================
   Page
   ========================================================= */

export default function ManagementResultsPage() {
  const [
    userRole,
    setUserRole,
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
    selectedTestId,
    setSelectedTestId,
  ] =
    useState("");

  const [
    selectedSchoolId,
    setSelectedSchoolId,
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
          "本部管理者" &&
        user.role !==
          "校舎管理者"
      ) {
        throw new Error(
          "この成績画面は管理者用です。"
        );
      }

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織が設定されていません。"
        );
      }

      setUserRole(
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
        studentDocuments,
        testDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            resultsQueries(
              scopeUser
            )
          ),

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
        ]);

      const loadedStudents =
        studentDocuments.map(
          (
            item
          ) =>
            normalizeStudent(
              item.id,
              item.data
            )
        );

      const loadedTests =
        testDocuments.map(
          (
            item
          ) =>
            normalizeTest(
              item.id,
              item.data
            )
        );

      /*
       * 確定済み結果のみ。
       *
       * resultsコレクションそのものが
       * 確定結果を保持する。
       */
      const loadedResults =
        resultDocuments
          .map(
            (
              item
            ) =>
              normalizeResult(
                item.id,
                item.data,
                loadedStudents,
                loadedTests
              )
          )
          .filter(
            (
              result
            ) =>
              result.studentId &&
              result.testId
          );

      setStudents(
        loadedStudents
      );

      setTests(
        loadedTests
      );

      setResults(
        loadedResults
      );
    } catch (
      error
    ) {
      console.error(
        "Management results error:",
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
     Filters
     ======================================================= */

  const filteredResults =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return results.filter(
        (
          result
        ) => {
          const matchesTest =
            !selectedTestId ||
            result.testId ===
              selectedTestId;

          const matchesSchool =
            !selectedSchoolId ||
            result.schoolId ===
              selectedSchoolId;

          const matchesSearch =
            !keyword ||
            result.studentName
              .toLowerCase()
              .includes(
                keyword
              ) ||
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

          return (
            matchesTest &&
            matchesSchool &&
            matchesSearch
          );
        }
      );
    }, [
      results,
      search,
      selectedTestId,
      selectedSchoolId,
    ]);

  /* =======================================================
     Tests used by results
     ======================================================= */

  const resultTests =
    useMemo(
      () => {
        const ids =
          new Set(
            results.map(
              (
                result
              ) =>
                result.testId
            )
          );

        return tests.filter(
          (
            test
          ) =>
            ids.has(
              test.id
            ) ||
            ids.has(
              test.testId
            )
        );
      },
      [
        results,
        tests,
      ]
    );

  /* =======================================================
     Schools
     ======================================================= */

  const schoolIds =
    useMemo(
      () =>
        Array.from(
          new Set(
            results.map(
              (
                result
              ) =>
                result.schoolId
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
     Statistics
     ======================================================= */

  const average =
    calculateAverage(
      filteredResults
    );

  const max =
    filteredResults.length >
    0
      ? Math.max(
          ...filteredResults.map(
            (
              result
            ) =>
              result.score
          )
        )
      : 0;

  const min =
    filteredResults.length >
    0
      ? Math.min(
          ...filteredResults.map(
            (
              result
            ) =>
              result.score
          )
        )
      : 0;

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
            確定済みの成績を読み込んでいます...
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
              確定したテスト結果を確認します。
            </p>
          </div>

          <Link
            href="/reports/management"
            className="button"
          >
            成績表
          </Link>
        </header>

        {error && (
          <div className="errorMessage">
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
            label="平均点"
            value={
              formatScore(
                average
              )
            }
          />

          <SummaryCard
            label="最高点"
            value={
              max
            }
          />

          <SummaryCard
            label="最低点"
            value={
              min
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
                "1fr 240px 220px",

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
              placeholder="生徒番号・氏名・テスト名・教科"
            />

            <select
              value={
                selectedTestId
              }
              onChange={(
                event
              ) =>
                setSelectedTestId(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                全テスト
              </option>

              {resultTests.map(
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

            <select
              value={
                selectedSchoolId
              }
              onChange={(
                event
              ) =>
                setSelectedSchoolId(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                全校舎
              </option>

              {schoolIds.map(
                (
                  schoolId
                ) => (
                  <option
                    key={
                      schoolId
                    }
                    value={
                      schoolId
                    }
                  >
                    {
                      schoolId
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
                      生徒番号
                    </th>

                    <th>
                      生徒名
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
                      偏差値
                    </th>

                    <th>
                      順位
                    </th>

                    <th>
                      受験者数
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
                            result.studentNumber
                          }
                        </td>

                        <td>
                          {
                            result.studentName
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
                            formatPercentage(
                              result.percentage
                            )
                          }
                        </td>

                        <td>
                          {result.deviationScore ===
                          null
                            ? "—"
                            : result.deviationScore.toFixed(
                                1
                              )}
                        </td>

                        <td>
                          {result.rank ===
                          null
                            ? "—"
                            : result.rank}
                        </td>

                        <td>
                          {result.population ===
                          null
                            ? "—"
                            : result.population}
                        </td>

                        <td>
                          <Link
                            href={`/reports/management?studentId=${encodeURIComponent(
                              result.studentId
                            )}&testId=${encodeURIComponent(
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
   Normalize result
   ========================================================= */

function normalizeResult(
  id: string,
  data: Record<
    string,
    unknown
  >,
  students: Student[],
  tests: Test[]
): ResultRow {
  const studentId =
    stringValue(
      data.studentId
    );

  const testId =
    stringValue(
      data.testId
    );

  const student =
    students.find(
      (
        item
      ) =>
        item.id ===
        studentId
    );

  const test =
    tests.find(
      (
        item
      ) =>
        item.id ===
          testId ||
        item.testId ===
          testId
    );

  const maxScore =
    safeNumber(
      data.maxScore
    );

  const score =
    safeNumber(
      data.score
    );

  const percentage =
    maxScore > 0
      ? (score /
          maxScore) *
        100
      : 0;

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

    studentId,

    studentNumber:
      stringValue(
        data.studentNumber
      ) ||
      student?.studentNumber ||
      "",

    testId,

    testName:
      stringValue(
        data.testName
      ) ||
      test?.name ||
      "テスト未設定",

    subject:
      stringValue(
        data.subject
      ) ||
      test?.subject ||
      "",

    score,

    maxScore,

    percentage,

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

    studentName:
      student?.name ??
      stringValue(
        data.studentName
      ),

    testSubject:
      test?.subject ??
      "",
  };
}

/* =========================================================
   Student
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
   Test
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
        確定済みの成績はありません。
      </strong>

      <p
        style={{
          fontSize:
            12,
        }}
      >
        採点確定した結果が登録されると、ここに表示されます。
      </p>
    </div>
  );
}

/* =========================================================
   Statistics
   ========================================================= */

function calculateAverage(
  results: ResultRow[]
) {
  if (
    results.length ===
    0
  ) {
    return 0;
  }

  const total =
    results.reduce(
      (
        sum,
        result
      ) =>
        sum +
        result.score,
      0
    );

  return (
    total /
    results.length
  );
}

function formatScore(
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

function formatPercentage(
  value: number
) {
  return `${value.toFixed(
    1
  )}%`;
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
    value === null ||
    value === undefined ||
    value === ""
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
      value ?? 0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
