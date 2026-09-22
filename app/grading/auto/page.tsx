"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  getAnswers,
  getGradingJob,
  startAutoGrading,
  type Answer,
  type GradingJob,
} from "@/lib/answers";

import {
  getAppUser,
} from "@/lib/auth";

import {
  auth,
} from "@/lib/firebase";

/* =========================================================
   Types
   ========================================================= */

type PageState =
  | "loading"
  | "ready"
  | "processing"
  | "completed"
  | "error";

/* =========================================================
   Page
   ========================================================= */

export default function AutoGradingPage() {
  const [
    testId,
    setTestId,
  ] = useState("");

  const [
    subjectId,
    setSubjectId,
  ] = useState("");

  const [
    answers,
    setAnswers,
  ] = useState<Answer[]>(
    []
  );

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<
    string[]
  >([]);

  const [
    job,
    setJob,
  ] =
    useState<GradingJob | null>(
      null
    );

  const [
    state,
    setState,
  ] =
    useState<PageState>(
      "ready"
    );

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
     Load answers
     ======================================================= */

  async function loadAnswers() {
    if (
      !testId.trim() ||
      !subjectId.trim()
    ) {
      setError(
        "テストIDと教科を指定してください。"
      );

      return;
    }

    try {
      setState(
        "loading"
      );

      setError("");

      setMessage("");

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
          "採点機能を利用する権限がありません。"
        );
      }

      const loaded =
        await getAnswers(
          testId.trim(),
          subjectId.trim()
        );

      setAnswers(
        loaded
      );

      /*
       * 初期状態では未処理答案だけ選択。
       */
      setSelectedIds(
        loaded
          .filter(
            (
              answer
            ) =>
              answer.status ===
                "uploaded" ||
              answer.status ===
                "error"
          )
          .map(
            (
              answer
            ) =>
              answer.id
          )
      );

      setState(
        "ready"
      );

      if (
        loaded.length ===
        0
      ) {
        setMessage(
          "対象となる答案はありません。"
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Load answers error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "答案を取得できませんでした。"
      );

      setState(
        "error"
      );
    }
  }

  /* =======================================================
     Start
     ======================================================= */

  async function handleStart() {
    if (
      selectedIds.length ===
      0
    ) {
      setError(
        "自動採点する答案を選択してください。"
      );

      return;
    }

    try {
      setState(
        "processing"
      );

      setError("");

      setMessage(
        "自動採点を開始しています..."
      );

      const result =
        await startAutoGrading(
          testId.trim(),
          subjectId.trim(),
          selectedIds
        );

      const initialJob =
        await getGradingJob(
          result.jobId
        );

      setJob(
        initialJob
      );

      /*
       * ジョブ監視。
       */
      await monitorJob(
        result.jobId
      );
    } catch (
      error
    ) {
      console.error(
        "Auto grading error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "自動採点を開始できませんでした。"
      );

      setState(
        "error"
      );
    }
  }

  /* =======================================================
     Monitor job
     ======================================================= */

  async function monitorJob(
    jobId: string
  ) {
    let stopped =
      false;

    while (
      !stopped
    ) {
      const currentJob =
        await getGradingJob(
          jobId
        );

      if (
        !currentJob
      ) {
        throw new Error(
          "採点ジョブが見つかりません。"
        );
      }

      setJob(
        currentJob
      );

      if (
        currentJob.status ===
          "completed" ||
        currentJob.status ===
          "completed_with_errors"
      ) {
        stopped =
          true;

        setState(
          "completed"
        );

        setMessage(
          currentJob.status ===
            "completed"
            ? "自動採点が完了しました。"
            : "自動採点が完了しました。一部に確認が必要な答案があります。"
        );

        /*
         * 最新状態を取得。
         */
        await loadAnswers();

        return;
      }

      if (
        currentJob.status ===
        "failed"
      ) {
        throw new Error(
          currentJob.errorMessage ||
            "自動採点処理に失敗しました。"
        );
      }

      await sleep(
        2000
      );
    }
  }

  /* =======================================================
     Selection
     ======================================================= */

  function toggleAnswer(
    answerId: string
  ) {
    setSelectedIds(
      (
        current: string[]
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

  function selectAll() {
    setSelectedIds(
      answers
        .filter(
          (
            answer
          ) =>
            answer.status ===
              "uploaded" ||
            answer.status ===
              "error"
        )
        .map(
          (
            answer
          ) =>
            answer.id
        )
    );
  }

  function clearSelection() {
    setSelectedIds(
      []
    );
  }

  /* =======================================================
     Statistics
     ======================================================= */

  const statistics =
    useMemo(
      () => {
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

        const review =
          answers.filter(
            (
              answer
            ) =>
              answer.status ===
                "first_review" ||
              answer.status ===
                "second_review"
          ).length;

        const confirmed =
          answers.filter(
            (
              answer
            ) =>
              answer.status ===
              "confirmed"
          ).length;

        const errors =
          answers.filter(
            (
              answer
            ) =>
              answer.status ===
              "error"
          ).length;

        return {
          uploaded,

          processing,

          graded,

          review,

          confirmed,

          errors,
        };
      },
      [
        answers,
      ]
    );

  /* =======================================================
     Progress
     ======================================================= */

  const progress =
    job &&
    job.total >
      0
      ? Math.min(
          100,
          Math.round(
            job.processed /
              job.total *
              100
          )
        )
      : 0;

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
            <div
              className="muted"
              style={{
                fontSize:
                  11,
              }}
            >
              採点
            </div>

            <h1>
              自動採点処理
            </h1>

            <p className="muted">
              自動採点可能な答案だけを処理します。
              手動採点が必要な問題は別途採点します。
            </p>
          </div>

          <Link
            href="/grading"
            className="button"
          >
            採点へ戻る
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
            Test selection
            ================================================== */}

        <section className="card">
          <h2>
            対象を指定
          </h2>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr auto",

              gap:
                10,

              alignItems:
                "end",
            }}
          >
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
                テストID
              </span>

              <input
                value={
                  testId
                }
                onChange={(
                  event
                ) =>
                  setTestId(
                    event.target
                      .value
                  )
                }
                placeholder="テストID"
                disabled={
                  state ===
                  "processing"
                }
              />
            </label>

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
                教科ID
              </span>

              <input
                value={
                  subjectId
                }
                onChange={(
                  event
                ) =>
                  setSubjectId(
                    event.target
                      .value
                  )
                }
                placeholder="教科ID"
                disabled={
                  state ===
                  "processing"
                }
              />
            </label>

            <button
              type="button"
              className="button"
              onClick={
                loadAnswers
              }
              disabled={
                state ===
                "processing"
              }
            >
              答案を読み込む
            </button>
          </div>
        </section>

        {/* ==================================================
            Statistics
            ================================================== */}

        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(6, minmax(0, 1fr))",

            gap:
              10,

            marginTop:
              16,
          }}
        >
          <StatusCard
            label="未処理"
            value={
              statistics.uploaded
            }
          />

          <StatusCard
            label="処理中"
            value={
              statistics.processing
            }
          />

          <StatusCard
            label="採点済み"
            value={
              statistics.graded
            }
          />

          <StatusCard
            label="確認待ち"
            value={
              statistics.review
            }
          />

          <StatusCard
            label="確定"
            value={
              statistics.confirmed
            }
          />

          <StatusCard
            label="エラー"
            value={
              statistics.errors
            }
          />
        </section>

        {/* ==================================================
            Processing
            ================================================== */}

        {job && (
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

                gap:
                  10,
              }}
            >
              <strong>
                自動採点処理
              </strong>

              <span
                className="muted"
              >
                {
                  job.status
                }
              </span>
            </div>

            <div
              style={{
                marginTop:
                  12,

                height:
                  10,

                borderRadius:
                  999,

                background:
                  "#eeeeee",

                overflow:
                  "hidden",
              }}
            >
              <div
                style={{
                  width:
                    `${progress}%`,

                  height:
                    "100%",

                  background:
                    "#222",

                  transition:
                    "width .2s ease",
                }}
              />
            </div>

            <div
              style={{
                marginTop:
                  8,

                display:
                  "flex",

                justifyContent:
                  "space-between",

                fontSize:
                  11,

                color:
                  "#777",
              }}
            >
              <span>
                {
                  job.processed
                }
                {" / "}
                {
                  job.total
                }
                件
              </span>

              <span>
                {
                  progress
                }
                %
              </span>
            </div>
          </section>
        )}

        {/* ==================================================
            Answer list
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
                10,

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
                答案
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
                自動処理する答案を選択してください。
              </p>
            </div>

            <div
              style={{
                display:
                  "flex",

                gap:
                  7,
              }}
            >
              <button
                type="button"
                className="button"
                onClick={
                  selectAll
                }
              >
                未処理を全選択
              </button>

              <button
                type="button"
                className="button"
                onClick={
                  clearSelection
                }
              >
                選択解除
              </button>
            </div>
          </div>

          {answers.length ===
          0 ? (
            <div
              style={{
                padding:
                  50,

                textAlign:
                  "center",

                color:
                  "#777",

                fontSize:
                  12,
              }}
            >
              答案がありません。
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
                    <th>
                      選択
                    </th>

                    <th>
                      答案ID
                    </th>

                    <th>
                      生徒番号
                    </th>

                    <th>
                      ファイル
                    </th>

                    <th>
                      状態
                    </th>

                    <th>
                      確認
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {answers.map(
                    (
                      answer
                    ) => {
                      const selectable =
                        answer.status ===
                          "uploaded" ||
                        answer.status ===
                          "error";

                      const selected =
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
                                selected
                              }
                              disabled={
                                !selectable ||
                                state ===
                                  "processing"
                              }
                              onChange={() =>
                                toggleAnswer(
                                  answer.id
                                )
                              }
                            />
                          </td>

                          <td>
                            {
                              answer.id
                            }
                          </td>

                          <td>
                            {
                              answer.studentNumber ??
                              "未紐付け"
                            }
                          </td>

                          <td>
                            {
                              answer.fileName
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
                            {answer.reviewRequired
                              ? "必要"
                              : "—"}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* =================================================
              Start
              ================================================= */}

          <div
            style={{
              marginTop:
                16,

              display:
                "flex",

              justifyContent:
                "flex-end",

              alignItems:
                "center",

              gap:
                12,
            }}
          >
            <span
              className="muted"
              style={{
                fontSize:
                  11,
              }}
            >
              選択：
              {
                selectedIds.length
              }
              件
            </span>

            <button
              type="button"
              className="button primary"
              onClick={
                handleStart
              }
              disabled={
                selectedIds.length ===
                  0 ||
                state ===
                  "processing"
              }
            >
              {state ===
              "processing"
                ? "自動採点中..."
                : "自動採点を開始"}
            </button>
          </div>
        </section>

        {/* ==================================================
            Important notice
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,

            background:
              "#fafafa",
          }}
        >
          <strong
            style={{
              fontSize:
                12,
            }}
          >
            採点方式について
          </strong>

          <p
            className="muted"
            style={{
              margin:
                "7px 0 0",

              fontSize:
                11,

              lineHeight:
                1.7,
            }}
          >
            この画面ですべての問題を自動採点するわけではありません。
            テスト登録時に手動採点に設定された問題は、
            自動採点後も手動採点の対象として残ります。
          </p>

          <Link
            href="/grading"
            className="button"
            style={{
              marginTop:
                10,
            }}
          >
            採点状況を確認
          </Link>
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Status card
   ========================================================= */

function StatusCard({
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
            3,

          fontSize:
            20,
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
   Status badge
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: string;
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
          10,

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

/* =========================================================
   Status label
   ========================================================= */

function getStatusLabel(
  status: string
) {
  switch (
    status
  ) {
    case "uploaded":
      return "未処理";

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
      return status;
  }
}

/* =========================================================
   Status background
   ========================================================= */

function getStatusBackground(
  status: string
) {
  switch (
    status
  ) {
    case "error":
      return "#fff0f0";

    case "confirmed":
      return "#e8f5e9";

    case "graded":
      return "#eef5ff";

    case "first_review":
    case "second_review":
      return "#fff8e6";

    case "processing":
      return "#f0f0f0";

    default:
      return "#f5f5f5";
  }
}

/* =========================================================
   Sleep
   ========================================================= */

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}
