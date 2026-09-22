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
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Answer,
  Student,
  Test,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type AnswerRow =
  Answer & {
    studentName: string;
    testName: string;
    subjectName: string;
  };

/* =========================================================
   Page
   ========================================================= */

export default function GradingPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    answers,
    setAnswers,
  ] =
    useState<AnswerRow[]>(
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
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      "all" | Answer["status"]
    >(
      "all"
    );

  /* =======================================================
     Load
     ======================================================= */

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
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
          "採点管理は職員のみ利用できます。"
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

      const [
        answerDocuments,
        studentDocuments,
        testDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            answersQueries(
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

      const students =
        studentDocuments.map(
          (
            item
          ) =>
            normalizeStudent(
              item.id,
              item.data
            )
        );

      const tests =
        testDocuments.map(
          (
            item
          ) =>
            normalizeTest(
              item.id,
              item.data
            )
        );

      const loaded =
        answerDocuments
          .map(
            (
              item
            ) =>
              normalizeAnswer(
                item.id,
                item.data,
                students,
                tests
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

      setAnswers(
        loaded
      );
    } catch (
      error
    ) {
      console.error(
        "Grading page error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "採点データを取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Filter
     ======================================================= */

  const filtered =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return answers.filter(
        (
          answer
        ) => {
          const statusMatch =
            statusFilter ===
              "all" ||
            answer.status ===
              statusFilter;

          const searchMatch =
            !keyword ||
            answer.studentName
              .toLowerCase()
              .includes(
                keyword
              ) ||
            (
              answer.studentNumber ??
              ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            answer.testName
              .toLowerCase()
              .includes(
                keyword
              ) ||
            answer.subjectName
              .toLowerCase()
              .includes(
                keyword
              );

          return (
            statusMatch &&
            searchMatch
          );
        }
      );
    }, [
      answers,
      search,
      statusFilter,
    ]);

  /* =======================================================
     Statistics
     ======================================================= */

  const uploaded =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "uploaded"
    ).length;

  const processing =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "processing"
    ).length;

  const graded =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "graded"
    ).length;

  const firstReview =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "first_review"
    ).length;

  const secondReview =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "second_review"
    ).length;

  const confirmed =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
          "confirmed" ||
        answer.status ===
          "published"
    ).length;

  const errors =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "error"
    ).length;

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
            採点管理
          </h1>

          <p>
            採点状況を読み込んでいます...
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
              採点管理
            </h1>

            <p className="muted">
              答案の処理状況を確認し、必要な確認画面へ進みます。
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
              href="/answers"
              className="button"
            >
              答案管理
            </Link>

            <Link
              href="/grading/review"
              className="button"
            >
              一次確認
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
            Flow
            ================================================== */}

        <section
          className="card"
          style={{
            marginBottom:
              18,
          }}
        >
          <h2>
            採点フロー
          </h2>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(5, minmax(0, 1fr))",

              gap:
                8,

              marginTop:
                14,
            }}
          >
            <FlowStep
              number="1"
              label="答案受付"
              count={
                uploaded
              }
            />

            <FlowStep
              number="2"
              label="採点処理"
              count={
                processing
              }
            />

            <FlowStep
              number="3"
              label="一次確認"
              count={
                firstReview
              }
            />

            <FlowStep
              number="4"
              label="二次確認"
              count={
                secondReview
              }
            />

            <FlowStep
              number="5"
              label="確定"
              count={
                confirmed
              }
            />
          </div>

          {errors >
            0 && (
            <div
              style={{
                marginTop:
                  12,

                padding:
                  11,

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
              処理エラー：
              {
                errors
              }
              件
            </div>
          )}
        </section>

        {/* ==================================================
            Statistics
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",

            gap:
              10,

            marginBottom:
              16,
          }}
        >
          <StatCard
            label="答案総数"
            value={
              answers.length
            }
          />

          <StatCard
            label="採点済み"
            value={
              graded
            }
          />

          <StatCard
            label="一次確認待ち"
            value={
              firstReview
            }
          />

          <StatCard
            label="二次確認待ち"
            value={
              secondReview
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
                "1fr 220px",

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
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value as
                    | "all"
                    | Answer["status"]
                )
              }
            >
              <option value="all">
                すべて
              </option>

              <option value="uploaded">
                受付済み
              </option>

              <option value="processing">
                処理中
              </option>

              <option value="graded">
                採点済み
              </option>

              <option value="first_review">
                一次確認待ち
              </option>

              <option value="second_review">
                二次確認待ち
              </option>

              <option value="confirmed">
                確定
              </option>

              <option value="published">
                公開済み
              </option>

              <option value="error">
                エラー
              </option>
            </select>
          </div>
        </section>

        {/* ==================================================
            List
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
                答案一覧
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
                件表示
              </p>
            </div>
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
                      生徒
                    </th>

                    <th>
                      テスト
                    </th>

                    <th>
                      教科
                    </th>

                    <th>
                      状態
                    </th>

                    <th>
                      得点
                    </th>

                    <th>
                      次の処理
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (
                      answer
                    ) => (
                      <tr
                        key={
                          answer.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              answer.studentName ||
                              "未紐付け"
                            }
                          </strong>

                          <div
                            className="muted"
                            style={{
                              fontSize:
                                11,
                            }}
                          >
                            {
                              answer.studentNumber ||
                              "生徒番号なし"
                            }
                          </div>
                        </td>

                        <td>
                          {
                            answer.testName
                          }
                        </td>

                        <td>
                          {
                            answer.subjectName ||
                            "—"
                          }
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              answer.status
                            }
                          />
                        </td>

                        <td>
                          {answer.totalMaxScore >
                          0
                            ? `${answer.totalScore} / ${answer.totalMaxScore}`
                            : "—"}
                        </td>

                        <td>
                          <NextAction
                            answerId={
                              answer.id
                            }
                            status={
                              answer.status
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
   Flow
   ========================================================= */

function FlowStep({
  number,
  label,
  count,
}: {
  number: string;

  label: string;

  count: number;
}) {
  return (
    <div
      style={{
        padding:
          12,

        border:
          "1px solid #ddd",

        borderRadius:
          8,

        textAlign:
          "center",
      }}
    >
      <div
        className="muted"
        style={{
          fontSize:
            10,
        }}
      >
        STEP {number}
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
          label
        }
      </strong>

      <strong
        style={{
          display:
            "block",

          marginTop:
            6,

          fontSize:
            22,
        }}
      >
        {
          count
        }
      </strong>
    </div>
  );
}

/* =========================================================
   Stat
   ========================================================= */

function StatCard({
  label,
  value,
}: {
  label: string;

  value: number;
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
   Status
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: Answer["status"];
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
          getStatusBackground(
            status
          ),

        fontSize:
          11,

        whiteSpace:
          "nowrap",
      }}
    >
      {
        getStatusLabel(
          status
        )
      }
    </span>
  );
}

function getStatusBackground(
  status: Answer["status"]
) {
  if (
    status ===
      "confirmed" ||
    status ===
      "published"
  ) {
    return "#e8f5e9";
  }

  if (
    status ===
    "error"
  ) {
    return "#fff1f1";
  }

  if (
    status ===
      "first_review" ||
    status ===
      "second_review"
  ) {
    return "#fff4d6";
  }

  return "#f1f1f1";
}

function getStatusLabel(
  status: Answer["status"]
) {
  switch (
    status
  ) {
    case "uploaded":
      return "受付済み";

    case "processing":
      return "処理中";

    case "graded":
      return "採点済み";

    case "first_review":
      return "一次確認";

    case "second_review":
      return "二次確認";

    case "confirmed":
      return "確定";

    case "published":
      return "公開済み";

    case "error":
      return "エラー";

    default:
      return "未設定";
  }
}

/* =========================================================
   Next action
   ========================================================= */

function NextAction({
  answerId,
  status,
}: {
  answerId: string;

  status: Answer["status"];
}) {
  switch (
    status
  ) {
    case "uploaded":
    case "processing":
      return (
        <Link
          href={`/answers?answerId=${encodeURIComponent(
            answerId
          )}`}
          className="button"
        >
          答案確認
        </Link>
      );

    case "graded":
    case "first_review":
      return (
        <Link
          href={`/grading/review?answerId=${encodeURIComponent(
            answerId
          )}`}
          className="button primary"
        >
          一次確認
        </Link>
      );

    case "second_review":
      return (
        <Link
          href={`/grading/second-review?answerId=${encodeURIComponent(
            answerId
          )}`}
          className="button primary"
        >
          二次確認
        </Link>
      );

    case "confirmed":
      return (
        <Link
          href={`/results/management?answerId=${encodeURIComponent(
            answerId
          )}`}
          className="button"
        >
          成績確認
        </Link>
      );

    case "published":
      return (
        <Link
          href={`/results/management?answerId=${encodeURIComponent(
            answerId
          )}`}
          className="button"
        >
          成績確認
        </Link>
      );

    case "error":
      return (
        <Link
          href={`/answers?answerId=${encodeURIComponent(
            answerId
          )}`}
          className="button"
        >
          エラー確認
        </Link>
      );

    default:
      return null;
  }
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
        答案はありません。
      </strong>

      <p
        style={{
          marginTop:
            6,

          fontSize:
            12,
        }}
      >
        登録された答案がここに表示されます。
      </p>
    </div>
  );
}

/* =========================================================
   Normalize answer
   ========================================================= */

function normalizeAnswer(
  id: string,
  data: Record<
    string,
    unknown
  >,
  students: Student[],
  tests: Test[]
): AnswerRow {
  const studentId =
    nullableString(
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

    testId,

    subjectId:
      stringValue(
        data.subjectId
      ),

    studentId,

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
      normalizeStatus(
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

    studentName:
      student?.name ??
      "",

    testName:
      test?.name ??
      "テスト未設定",

    subjectName:
      stringValue(
        data.subjectName
      ),
  };
}

/* =========================================================
   Normalize student
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
   Normalize test
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
   Status
   ========================================================= */

function normalizeStatus(
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

function nullableString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
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
