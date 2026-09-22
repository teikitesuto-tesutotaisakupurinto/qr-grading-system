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

import {
  confirmGrading,
} from "@/lib/grading";

import type {
  Answer,
  Student,
  Test,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type ConfirmRow =
  Answer & {
    studentName: string;
    testName: string;
    subjectName: string;
  };

/* =========================================================
   Page
   ========================================================= */

export default function GradingConfirmPage() {
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
    useState<ConfirmRow[]>(
      []
    );

  const [
    selectedIds,
    setSelectedIds,
  ] =
    useState<
      string[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    confirming,
    setConfirming,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

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
          "採点確定を利用する権限がありません。"
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

      /*
       * 最終確定できるのは
       * second_reviewだけ。
       */
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
          .filter(
            (
              answer
            ) =>
              answer.status ===
              "second_review"
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

      /*
       * 存在しなくなった選択状態を削除。
       */
      setSelectedIds(
        (
          current
        ) =>
          current.filter(
            (
              id
            ) =>
              loaded.some(
                (
                  answer
                ) =>
                  answer.id ===
                  id
              )
          )
      );
    } catch (
      error
    ) {
      console.error(
        "Grading confirm load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "確定対象を取得できませんでした。"
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

      if (
        !keyword
      ) {
        return answers;
      }

      return answers.filter(
        (
          answer
        ) =>
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
            )
      );
    }, [
      answers,
      search,
    ]);

  /* =======================================================
     Selection
     ======================================================= */

  const allVisibleSelected =
    filtered.length >
      0 &&
    filtered.every(
      (
        answer
      ) =>
        selectedIds.includes(
          answer.id
        )
    );

  function toggleAnswer(
    answerId: string
  ) {
    setSelectedIds(
      (
        current
      ) =>
        current.includes(
          answerId
        )
          ? current.filter(
              (
                id
              ) =>
                id !==
                answerId
            )
          : [
              ...current,
              answerId,
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
              answer
            ) =>
              answer.id
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
                answer
              ) =>
                answer.id
            ),
          ])
        )
    );
  }

  /* =======================================================
     Confirm
     ======================================================= */

  async function handleConfirm() {
    if (
      confirming
    ) {
      return;
    }

    if (
      selectedIds.length ===
      0
    ) {
      setError(
        "確定する答案を選択してください。"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `${selectedIds.length}件の答案を最終確定します。\n確定後は通常の採点フローから戻せません。`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setConfirming(
        true
      );

      setError("");

      setMessage("");

      const user =
        await getAppUser();

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
          "採点確定権限がありません。"
        );
      }

      const result =
        await confirmGrading(
          selectedIds,
          user.uid
        );

      setMessage(
        `${result.confirmed.length}件の採点を確定しました。`
      );

      setSelectedIds(
        []
      );

      await loadPage();
    } catch (
      error
    ) {
      console.error(
        "Confirm grading error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "採点を確定できませんでした。"
      );
    } finally {
      setConfirming(
        false
      );
    }
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
            採点確定
          </h1>

          <p>
            確定対象を読み込んでいます...
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
              採点確定
            </h1>

            <p className="muted">
              二次確認が完了した答案だけを最終確定します。
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
              href="/grading/second-review"
              className="button"
            >
              二次確認
            </Link>

            <Link
              href="/results/management"
              className="button"
            >
              成績
            </Link>
          </div>
        </header>

        {/* ==================================================
            Messages
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

        {message && (
          <div
            className="successMessage"
            role="status"
          >
            {
              message
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
            label="確定待ち"
            value={
              answers.length
            }
          />

          <SummaryCard
            label="表示件数"
            value={
              filtered.length
            }
          />

          <SummaryCard
            label="選択中"
            value={
              selectedIds.length
            }
          />
        </div>

        {/* ==================================================
            Filter / action
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr auto auto",

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
              placeholder="生徒番号・氏名・テスト名・教科"
            />

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
                : "表示分を全選択"}
            </button>

            <button
              type="button"
              className="button primary"
              onClick={
                handleConfirm
              }
              disabled={
                confirming ||
                selectedIds.length ===
                  0
              }
            >
              {confirming
                ? "確定中..."
                : `${selectedIds.length}件を確定`}
            </button>
          </div>
        </section>

        {/* ==================================================
            Warning
            ================================================== */}

        <section
          style={{
            marginTop:
              12,

            padding:
              13,

            borderRadius:
              8,

            background:
              "#fff4d6",

            fontSize:
              12,
          }}
        >
          <strong>
            確定前に確認してください
          </strong>

          <p
            style={{
              margin:
                "5px 0 0",
            }}
          >
            確定できるのは二次確認済みの答案だけです。
            確定後、この答案は成績集計へ進められます。
          </p>
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
                確定対象
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
                          50,
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
                        aria-label="表示中の答案をすべて選択"
                      />
                    </th>

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
                      得点
                    </th>

                    <th>
                      状態
                    </th>

                    <th>
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (
                      answer
                    ) => {
                      const checked =
                        selectedIds.includes(
                          answer.id
                        );

                      return (
                        <tr
                          key={
                            answer.id
                          }
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={
                                checked
                              }
                              onChange={() =>
                                toggleAnswer(
                                  answer.id
                                )
                              }
                              aria-label={`${answer.studentName}を選択`}
                            />
                          </td>

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
                            {
                              answer.totalMaxScore >
                              0
                                ? `${answer.totalScore} / ${answer.totalMaxScore}`
                                : "—"
                            }
                          </td>

                          <td>
                            <StatusBadge />
                          </td>

                          <td>
                            <Link
                              href={`/grading/second-review?answerId=${encodeURIComponent(
                                answer.id
                              )}`}
                              className="button"
                            >
                              確認
                            </Link>
                          </td>
                        </tr>
                      );
                    }
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
   Status
   ========================================================= */

function StatusBadge() {
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
          "#fff4d6",

        fontSize:
          10,
      }}
    >
      二次確認済み
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
        確定待ちの答案はありません。
      </strong>

      <p
        style={{
          marginTop:
            6,

          fontSize:
            12,
        }}
      >
        二次確認が完了した答案がここに表示されます。
      </p>
    </div>
  );
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
): ConfirmRow {
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
      "second_review",

    reviewRequired:
      false,

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
