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
  StudentResult,
  Test,
  UserRole,
} from "@/lib/types";

type ResultRow =
  StudentResult & {
    studentName: string;
  };

export default function TeacherResultsPage() {
  const [
    role,
    setRole,
  ] = useState<UserRole | null>(
    null
  );

  const [
    results,
    setResults,
  ] = useState<ResultRow[]>(
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

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    testFilter,
    setTestFilter,
  ] = useState("");

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

      if (!user) {
        throw new Error(
          "ログインしてください。"
        );
      }

      if (
        user.role !== "講師"
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

      setRole(user.role);

      const scopeUser:
        FirestoreUser = {
          uid: user.uid,
          organizationId:
            user.organizationId,
          role: user.role,
          schoolIds:
            user.schoolIds,
          studentId:
            user.studentId,
        };

      const [
        resultDocuments,
        studentDocuments,
      ] = await Promise.all([
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
      ]);

      const students =
        studentDocuments.map(
          (item) =>
            normalizeStudent(
              item.id,
              item.data
            )
        );

      const loaded =
        resultDocuments.map(
          (item) =>
            normalizeResult(
              item.id,
              item.data,
              students
            )
        );

      setResults(
        loaded
      );
    } catch (error) {
      console.error(
        "Teacher results error:",
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

  const tests =
    useMemo(
      () =>
        Array.from(
          new Map(
            results.map(
              (result) => [
                result.testId,
                result,
              ]
            )
          ).values()
        ),
      [results]
    );

  const filtered =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return results.filter(
        (result) => {
          const testMatch =
            !testFilter ||
            result.testId ===
              testFilter;

          const searchMatch =
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
            testMatch &&
            searchMatch
          );
        }
      );
    }, [
      results,
      search,
      testFilter,
    ]);

  const average =
    filtered.length === 0
      ? 0
      : filtered.reduce(
          (sum, result) =>
            sum + result.score,
          0
        ) /
        filtered.length;

  if (loading) {
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

  return (
    <main className="page">
      <section className="content">

        <header className="pageHeader">
          <div>
            <h1>
              成績
            </h1>

            <p className="muted">
              担当範囲の確定済み成績を確認します。
            </p>
          </div>

          <Link
            href="/reports/teacher"
            className="button"
          >
            成績表
          </Link>
        </header>

        {error && (
          <div className="errorMessage">
            {error}
          </div>
        )}

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <SummaryCard
            label="成績件数"
            value={
              filtered.length
            }
          />

          <SummaryCard
            label="平均点"
            value={
              average.toFixed(1)
            }
          />

          <SummaryCard
            label="テスト数"
            value={
              tests.length
            }
          />
        </div>

        <section className="card">
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "1fr 260px",
              gap: 10,
            }}
          >
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="生徒番号・氏名・テスト名・教科"
            />

            <select
              value={testFilter}
              onChange={(event) =>
                setTestFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                全テスト
              </option>

              {tests.map(
                (result) => (
                  <option
                    key={
                      result.testId
                    }
                    value={
                      result.testId
                    }
                  >
                    {
                      result.testName
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </section>

        <section
          className="card"
          style={{
            marginTop: 16,
          }}
        >
          {filtered.length === 0 ? (
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
                      成績表
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (result) => (
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
                            result.rank ===
                            null
                              ? "—"
                              : `${result.rank}${
                                  result.population
                                    ? ` / ${result.population}`
                                    : ""
                                }`
                          }
                        </td>

                        <td>
                          <Link
                            href={`/reports/teacher?studentId=${encodeURIComponent(
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

function normalizeResult(
  id: string,
  data: Record<
    string,
    unknown
  >,
  students: Student[]
): ResultRow {
  const studentId =
    stringValue(
      data.studentId
    );

  const student =
    students.find(
      (item) =>
        item.id ===
        studentId
    );

  const maxScore =
    safeNumber(
      data.maxScore
    );

  const score =
    safeNumber(
      data.score
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

    studentId,

    studentNumber:
      stringValue(
        data.studentNumber
      ) ||
      student?.studentNumber ||
      "",

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

    studentName:
      student?.name ??
      stringValue(
        data.studentName
      ),
  };
}

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

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="card">
      <div
        className="muted"
        style={{
          fontSize: 11,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display:
            "block",
          marginTop: 4,
          fontSize: 25,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 60,
        textAlign:
          "center",
        color: "#777",
      }}
    >
      <strong>
        確定済みの成績はありません。
      </strong>

      <p
        style={{
          fontSize: 12,
        }}
      >
        担当範囲で採点確定された成績がここに表示されます。
      </p>
    </div>
  );
}

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
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

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
