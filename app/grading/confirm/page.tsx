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
  confirmGrading,
  getFirstReview,
  getSecondReview,
} from "@/lib/grading";

import {
  answersQueries,
  getScopedDocs,
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Answer,
  GradingResult,
  Student,
  Test,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type AnswerListItem =
  Answer & {
    studentName: string;

    testName: string;

    subjectName: string;
  };

type ConfirmState = {
  answerId: string;

  ready: boolean;

  reason: string;

  firstScore: number;

  secondScore: number;

  totalMaxScore: number;
};

/* =========================================================
   Page
   ========================================================= */

export default function GradingConfirmPage() {
  const [
    userRole,
    setUserRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    answers,
    setAnswers,
  ] =
    useState<AnswerListItem[]>(
      []
    );

  const [
    states,
    setStates,
  ] =
    useState<
      Map<
        string,
        ConfirmState
      >
    >(
      new Map()
    );

  const [
    selectedIds,
    setSelectedIds,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    checking,
    setChecking,
  ] =
    useState(false);

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

  /* =======================================================
     Initial load
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
          "採点確定は職員のみ利用できます。"
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
       * 二次確認が完了した答案だけを対象にする。
       *
       * confirmed済みは除外。
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
          );

      setAnswers(
        loaded
      );

      /*
       * 各答案の確定可能性を確認。
       */
      await checkAnswers(
        loaded
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
          : "採点確定対象を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Check answers
     ======================================================= */

  async function checkAnswers(
    targetAnswers: AnswerListItem[]
  ) {
    setChecking(true);

    try {
      const next =
        new Map<
          string,
          ConfirmState
        >();

      /*
       * 各答案について一次・二次確認を確認。
       */
      await Promise.all(
        targetAnswers.map(
          async (
            answer
          ) => {
            try {
              const [
                first,
                second,
              ] =
                await Promise.all([
                  getFirstReview(
                    answer.id
                  ),

                  getSecondReview(
                    answer.id
                  ),
                ]);

              const firstReady =
                Boolean(
                  first &&
                    first.status ===
                      "completed"
                );

              const secondReady =
                Boolean(
                  second &&
                    second.status ===
                      "completed"
                );

              const disagreement =
                second?.disagreement ===
                true;

              let ready =
                firstReady &&
                secondReady &&
                !disagreement;

              let reason =
                "";

              if (
                !firstReady
              ) {
                ready =
                  false;

                reason =
                  "一次確認が完了していません。";
              } else if (
                !secondReady
              ) {
                ready =
                  false;

                reason =
                  "二次確認が完了していません。";
              } else if (
                disagreement
              ) {
                ready =
                  false;

                reason =
                  "一次確認と二次確認に差異があります。";
              }

              const firstScore =
                first?.totalScore ??
                0;

              const secondScore =
                second?.totalScore ??
                0;

              const totalMaxScore =
                second?.totalMaxScore ??
                first?.totalMaxScore ??
                answer.totalMaxScore;

              next.set(
                answer.id,
                {
                  answerId:
                    answer.id,

                  ready,

                  reason,

                  firstScore,

                  secondScore,

                  totalMaxScore,
                }
              );
            } catch (
              error
            ) {
              console.error(
                "Answer confirmation check error:",
                error
              );

              next.set(
                answer.id,
                {
                  answerId:
                    answer.id,

                  ready:
                    false,

                  reason:
                    "確認状態を取得できませんでした。",

                  firstScore:
                    0,

                  secondScore:
                    0,

                  totalMaxScore:
                    answer.totalMaxScore,
                }
              );
            }
          }
        )
      );

      setStates(
        next
      );
    } finally {
      setChecking(false);
    }
  }

  /* =======================================================
     Search
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
     Select
     ======================================================= */

  function toggleSelection(
    answerId: string
  ) {
    const state =
      states.get(
        answerId
      );

    /*
     * 確定できない答案は選択できない。
     */
    if (
      !state?.ready
    ) {
      return;
    }

    setSelectedIds(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        if (
          next.has(
            answerId
          )
        ) {
          next.delete(
            answerId
          );
        } else {
          next.add(
            answerId
          );
        }

        return next;
      }
    );
  }

  /* =======================================================
     Select all ready
     ======================================================= */

  function selectAllReady() {
    const next =
      new Set<string>();

    for (
      const answer of
        filtered
    ) {
      const state =
        states.get(
          answer.id
        );

      if (
        state?.ready
      ) {
        next.add(
          answer.id
        );
      }
    }

    setSelectedIds(
      next
    );
  }

  /* =======================================================
     Clear selection
     ======================================================= */

  function clearSelection() {
    setSelectedIds(
      new Set()
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
      selectedIds.size ===
      0
    ) {
      setError(
        "確定する答案を選択してください。"
      );

      return;
    }

    /*
     * 最終的なreadyチェック。
     */
    const invalid =
      Array.from(
        selectedIds
      ).filter(
        (
          answerId
        ) =>
          !states.get(
            answerId
          )?.ready
      );

    if (
      invalid.length >
      0
    ) {
      setError(
        "確定できない答案が選択されています。"
      );

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

      await confirmGrading(
        Array.from(
          selectedIds
        ),
        user.uid
      );

      setMessage(
        `${selectedIds.size}件の採点を確定しました。`
      );

      setSelectedIds(
        new Set()
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
     Summary
     ======================================================= */

  const readyCount =
    filtered.filter(
      (
        answer
      ) =>
        states.get(
          answer.id
        )?.ready
    ).length;

  const blockedCount =
    filtered.length -
    readyCount;

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
            確定対象を確認しています...
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
              一次確認・二次確認が完了した答案のみ確定できます。
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
              href="/grading/review"
              className="button"
            >
              一次確認
            </Link>

            <Link
              href="/grading/second-review"
              className="button"
            >
              二次確認
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
              18,
          }}
        >
          <SummaryCard
            label="確定可能"
            value={
              readyCount
            }
          />

          <SummaryCard
            label="確認が必要"
            value={
              blockedCount
            }
          />

          <SummaryCard
            label="選択中"
            value={
              selectedIds.size
            }
          />
        </div>

        {/* ==================================================
            Filter
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "flex",

              gap:
                10,

              alignItems:
                "center",

              flexWrap:
                "wrap",
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
              placeholder="生徒番号・氏名・テスト名"
              style={{
                flex:
                  "1 1 280px",
              }}
            />

            <button
              type="button"
              className="button"
              disabled={
                checking ||
                readyCount ===
                  0
              }
              onClick={
                selectAllReady
              }
            >
              確定可能なものを全選択
            </button>

            <button
              type="button"
              className="button"
              disabled={
                selectedIds.size ===
                0
              }
              onClick={
                clearSelection
              }
            >
              選択解除
            </button>
          </div>
        </section>

        {/* ==================================================
            Table
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >
          {checking ? (
            <div
              style={{
                padding:
                  50,

                textAlign:
                  "center",
              }}
            >
              一次確認・二次確認の状態を確認しています...
            </div>
          ) : filtered.length ===
            0 ? (
            <div
              style={{
                padding:
                  50,

                textAlign:
                  "center",

                color:
                  "#777",
              }}
            >
              <strong>
                採点確定対象の答案はありません。
              </strong>

              <p
                style={{
                  fontSize:
                    12,
                }}
              >
                二次確認まで完了した答案がここに表示されます。
              </p>
            </div>
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
                      選択
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
                      一次確認
                    </th>

                    <th>
                      二次確認
                    </th>

                    <th>
                      状態
                    </th>

                    <th>
                      理由
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (
                      answer
                    ) => {
                      const state =
                        states.get(
                          answer.id
                        );

                      const selected =
                        selectedIds.has(
                          answer.id
                        );

                      return (
                        <tr
                          key={
                            answer.id
                          }
                          style={{
                            background:
                              selected
                                ? "#f5f9ff"
                                : undefined,
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={
                                selected
                              }
                              disabled={
                                !state?.ready
                              }
                              onChange={() =>
                                toggleSelection(
                                  answer.id
                                )
                              }
                            />
                          </td>

                          <td>
                            <strong>
                              {
                                answer.studentName ||
                                "生徒未紐付け"
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
                                "未設定"
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
                            {state ? (
                              <>
                                {
                                  state.firstScore
                                }
                                {" / "}
                                {
                                  state.totalMaxScore
                                }
                              </>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td>
                            {state ? (
                              <>
                                {
                                  state.secondScore
                                }
                                {" / "}
                                {
                                  state.totalMaxScore
                                }
                              </>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td>
                            <ConfirmStatus
                              ready={
                                Boolean(
                                  state?.ready
                                )
                              }
                            />
                          </td>

                          <td>
                            {state?.reason ? (
                              <span
                                style={{
                                  color:
                                    "#9a6500",

                                  fontSize:
                                    12,
                                }}
                              >
                                {
                                  state.reason
                                }
                              </span>
                            ) : (
                              <span className="muted">
                                確定可能
                              </span>
                            )}
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

        {/* ==================================================
            Confirm action
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

              gap:
                20,
            }}
          >
            <div>
              <strong>
                選択した答案：
                {
                  selectedIds.size
                }
                件
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
                確定すると答案の状態が「確定」になり、成績集計の対象になります。
              </p>
            </div>

            <button
              type="button"
              className="button primary"
              disabled={
                confirming ||
                selectedIds.size ===
                  0
              }
              onClick={
                handleConfirm
              }
            >
              {confirming
                ? "確定処理中..."
                : "選択した答案を確定"}
            </button>
          </div>
        </section>
      </section>
    </main>
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
): AnswerListItem {
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
   Confirm badge
   ========================================================= */

function ConfirmStatus({
  ready,
}: {
  ready: boolean;
}) {
  return (
    <span
      style={{
        display:
          "inline-block",

        padding:
          "4px 9px",

        borderRadius:
          999,

        background:
          ready
            ? "#e8f5e9"
            : "#fff4d6",

        fontSize:
          11,

        whiteSpace:
          "nowrap",
      }}
    >
      {ready
        ? "確定可能"
        : "確認必要"}
    </span>
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
            25,
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
      value ?? 0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
