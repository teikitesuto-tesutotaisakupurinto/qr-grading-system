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
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  GradeReport,
  GradeReportSubject,
  Student,
  Test,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type StudentOption = {
  id: string;
  studentNumber: string;
  name: string;
};

type TestOption = {
  id: string;
  name: string;
  examDate: string;
};

/* =========================================================
   Page
   ========================================================= */

export default function TeacherReportsPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    reports,
    setReports,
  ] =
    useState<GradeReport[]>(
      []
    );

  const [
    students,
    setStudents,
  ] =
    useState<StudentOption[]>(
      []
    );

  const [
    tests,
    setTests,
  ] =
    useState<TestOption[]>(
      []
    );

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] =
    useState("");

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState("");

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

      setRole(
        user.role
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
        reportDocuments,
        studentDocuments,
        testDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            gradeReportsQueries(
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
        studentDocuments
          .map(
            (
              item
            ) => {
              const data =
                item.data;

              return {
                id:
                  item.id,

                studentNumber:
                  stringValue(
                    data.studentNumber
                  ),

                name:
                  stringValue(
                    data.name
                  ),
              };
            }
          )
          .sort(
            (
              a,
              b
            ) =>
              a.studentNumber.localeCompare(
                b.studentNumber
              )
          );

      const loadedTests =
        testDocuments
          .map(
            (
              item
            ) => {
              const data =
                item.data;

              return {
                id:
                  item.id,

                name:
                  stringValue(
                    data.name
                  ),

                examDate:
                  stringValue(
                    data.examDate
                  ),
              };
            }
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
              report.studentId &&
              report.testId
          );

      setStudents(
        loadedStudents
      );

      setTests(
        loadedTests
      );

      setReports(
        loadedReports
      );
    } catch (
      error
    ) {
      console.error(
        "Teacher reports error:",
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
     Filter options from actual reports
     ======================================================= */

  const reportStudentOptions =
    useMemo(() => {
      const ids =
        new Set(
          reports.map(
            (
              report
            ) =>
              report.studentId
          )
        );

      return students.filter(
        (
          student
        ) =>
          ids.has(
            student.id
          )
      );
    }, [
      reports,
      students,
    ]);

  const reportTestOptions =
    useMemo(() => {
      const ids =
        new Set(
          reports.map(
            (
              report
            ) =>
              report.testId
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
            test.id
          )
      );
    }, [
      reports,
      tests,
    ]);

  /* =======================================================
     Selected reports
     ======================================================= */

  const filteredReports =
    useMemo(() => {
      return reports.filter(
        (
          report
        ) => {
          const studentMatch =
            !selectedStudentId ||
            report.studentId ===
              selectedStudentId;

          const testMatch =
            !selectedTestId ||
            report.testId ===
              selectedTestId;

          return (
            studentMatch &&
            testMatch
          );
        }
      );
    }, [
      reports,
      selectedStudentId,
      selectedTestId,
    ]);

  /* =======================================================
     Summary
     ======================================================= */

  const subjectCount =
    filteredReports.reduce(
      (
        total,
        report
      ) =>
        total +
        report.subjects.length,
      0
    );

  const averageDeviation =
    calculateAverageDeviation(
      filteredReports
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
            成績表を読み込んでいます...
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
              担当範囲の生徒の成績表を確認します。
            </p>
          </div>

          <Link
            href="/results/teacher"
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
            {error}
          </div>
        )}

        {/* ==================================================
            Filters
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr",

              gap:
                12,
            }}
          >
            <label>
              <span
                style={{
                  display:
                    "block",

                  marginBottom:
                    6,

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
                ) =>
                  setSelectedStudentId(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                }}
              >
                <option value="">
                  全生徒
                </option>

                {reportStudentOptions.map(
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
                        student.studentNumber
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

            <label>
              <span
                style={{
                  display:
                    "block",

                  marginBottom:
                    6,

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
                ) =>
                  setSelectedTestId(
                    event.target
                      .value
                  )
                }
                style={{
                  width:
                    "100%",
                }}
              >
                <option value="">
                  全テスト
                </option>

                {reportTestOptions.map(
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

                      {test.examDate &&
                        ` / ${test.examDate}`}
                    </option>
                  )
                )}
              </select>
            </label>
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
              "repeat(3, minmax(0, 1fr))",

            gap:
              12,

            marginTop:
              16,
          }}
        >
          <SummaryCard
            label="成績表"
            value={
              filteredReports.length
            }
          />

          <SummaryCard
            label="科目数"
            value={
              subjectCount
            }
          />

          <SummaryCard
            label="平均偏差値"
            value={
              averageDeviation ===
              null
                ? "—"
                : averageDeviation.toFixed(
                    1
                  )
            }
          />
        </div>

        {/* ==================================================
            Reports
            ================================================== */}

        <section
          style={{
            marginTop:
              18,
          }}
        >
          {filteredReports.length ===
          0 ? (
            <EmptyState />
          ) : (
            filteredReports.map(
              (
                report
              ) => (
                <ReportCard
                  key={
                    report.id
                  }
                  report={
                    report
                  }
                />
              )
            )
          )}
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Report card
   ========================================================= */

function ReportCard({
  report,
}: {
  report: GradeReport;
}) {
  return (
    <article
      className="card"
      style={{
        marginBottom:
          18,
      }}
    >
      {/* Header */}

      <header
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            20,

          paddingBottom:
            16,

          borderBottom:
            "1px solid #eee",
        }}
      >
        <div>
          <div
            className="muted"
            style={{
              fontSize:
                12,
            }}
          >
            生徒番号
          </div>

          <h2
            style={{
              margin:
                "4px 0 0",
            }}
          >
            {
              report.studentNumber
            }
            {" / "}
            {
              report.studentName
            }
          </h2>

          <div
            className="muted"
            style={{
              marginTop:
                5,
            }}
          >
            {
              report.grade
            }

            {report.className &&
              ` / ${report.className}`}
          </div>
        </div>

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
            {
              report.testName
            }
          </div>

          <strong
            style={{
              display:
                "block",

              marginTop:
                5,

              fontSize:
                24,
            }}
          >
            {
              report.totalScore
            }

            <span
              style={{
                fontSize:
                  13,

                fontWeight:
                  400,
              }}
            >
              {" / "}
              {
                report.totalMaxScore
              }
            </span>
          </strong>
        </div>
      </header>

      {/* Basic information */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(4, 1fr)",

          gap:
            10,

          marginTop:
            16,
        }}
      >
        <InfoCard
          label="平均点"
          value={
            formatNullableNumber(
              report.totalAverage
            )
          }
        />

        <InfoCard
          label="偏差値"
          value={
            formatNullableNumber(
              report.totalDeviation
            )
          }
        />

        <InfoCard
          label="順位"
          value={
            report.totalRank ===
            null
              ? "—"
              : report.totalRank
          }
        />

        <InfoCard
          label="受験者数"
          value={
            report.totalPopulation ===
            null
              ? "—"
              : report.totalPopulation
          }
        />
      </div>

      {/* Subjects */}

      <section
        style={{
          marginTop:
            20,
        }}
      >
        <h3>
          科目別成績
        </h3>

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
                  平均点
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
                        formatNullableNumber(
                          subject.average
                        )
                      }
                    </td>

                    <td>
                      {
                        formatNullableNumber(
                          subject.deviation
                        )
                      }
                    </td>

                    <td>
                      {subject.rank ===
                      null
                        ? "—"
                        : subject.rank}
                    </td>

                    <td>
                      {subject.population ===
                      null
                        ? "—"
                        : subject.population}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Distribution */}

      <section
        style={{
          marginTop:
            20,
        }}
      >
        <h3>
          度数分布
        </h3>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",

            gap:
              10,
          }}
        >
          {getAllDistributions(
            report.subjects
          ).map(
            (
              item
            ) => (
              <div
                key={
                  item.range
                }
                style={{
                  padding:
                    12,

                  border:
                    "1px solid #ddd",

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
                    item.range
                  }
                </div>

                <strong
                  style={{
                    display:
                      "block",

                    marginTop:
                      4,

                    fontSize:
                      20,
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
      </section>
    </article>
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
    <section className="card">
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
          採点確定済みの成績表がここに表示されます。
        </p>
      </div>
    </section>
  );
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
          Array.isArray(
            data.distribution
          )
            ? data.distribution
                .map(
                  (
                    item
                  ) => {
                    const row =
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
                          row.range
                        ),

                      minScore:
                        safeNumber(
                          row.minScore
                        ),

                      maxScore:
                        safeNumber(
                          row.maxScore
                        ),

                      count:
                        safeNumber(
                          row.count
                        ),

                      selected:
                        row.selected ===
                        true,
                    };
                  }
                )
                .filter(
                  (
                    item
                  ) =>
                    item.range
                )
            : [],
      };
    }
  );
}

/* =========================================================
   Distribution
   ========================================================= */

function getAllDistributions(
  subjects: GradeReportSubject[]
) {
  const map =
    new Map<
      string,
      {
        range: string;
        count: number;
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

          count:
            (current?.count ??
              0) +
            item.count,
        }
      );
    }
  }

  return Array.from(
    map.values()
  );
}

/* =========================================================
   Average deviation
   ========================================================= */

function calculateAverageDeviation(
  reports: GradeReport[]
) {
  const values =
    reports
      .map(
        (
          report
        ) =>
          report.totalDeviation
      )
      .filter(
        (
          value
        ): value is number =>
          value !==
          null &&
          Number.isFinite(
            value
          )
      );

  if (
    values.length ===
    0
  ) {
    return null;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    values.length
  );
}

/* =========================================================
   Formatting
   ========================================================= */

function formatNullableNumber(
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
