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
  getAnswerWithUrl,
} from "@/lib/answers";

import {
  getFirstReview,
  getGradingResult,
  saveFirstReview,
  calculateTotalScore,
  calculateTotalMaxScore,
  type SaveReviewInput,
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

type ReviewRow =
  GradingResult & {
    originalScore: number;

    originalMark:
      GradingResult["mark"];

    changed: boolean;
  };

type AnswerListItem =
  Answer & {
    studentName: string;

    testName: string;

    subjectName: string;
  };

/* =========================================================
   Page
   ========================================================= */

export default function GradingReviewPage() {
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
    selectedAnswerId,
    setSelectedAnswerId,
  ] =
    useState<
      string | null
    >(null);

  const [
    results,
    setResults,
  ] =
    useState<ReviewRow[]>(
      []
    );

  const [
    internalNote,
    setInternalNote,
  ] =
    useState("");

  const [
    publicAnnotation,
    setPublicAnnotation,
  ] =
    useState("");

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
    detailLoading,
    setDetailLoading,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
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
    imageUrl,
    setImageUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    imageLoading,
    setImageLoading,
  ] =
    useState(false);

  /* =======================================================
     Initial load
     ======================================================= */

  useEffect(() => {
    void loadAnswers();
  }, []);

  async function loadAnswers() {
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
        user.role ===
        "生徒"
      ) {
        throw new Error(
          "一次確認は職員のみ利用できます。"
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

      const loadedAnswers =
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
                "first_review" ||
              answer.reviewRequired
          );

      setAnswers(
        loadedAnswers
      );

      setSelectedAnswerId(
        (
          current
        ) => {
          if (
            current &&
            loadedAnswers.some(
              (
                answer
              ) =>
                answer.id ===
                current
            )
          ) {
            return current;
          }

          return (
            loadedAnswers[0]?.id ??
            null
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        "First review load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "一次確認対象の答案を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Selected answer
     ======================================================= */

  const selectedAnswer =
    answers.find(
      (
        answer
      ) =>
        answer.id ===
        selectedAnswerId
    ) ??
    null;

  /* =======================================================
     Load selected answer
     ======================================================= */

  useEffect(() => {
    if (
      !selectedAnswer
    ) {
      setResults([]);
      setInternalNote("");
      setPublicAnnotation("");
      setImageUrl(null);
      return;
    }

    void loadDetail(
      selectedAnswer
    );
  }, [
    selectedAnswerId,
  ]);

  async function loadDetail(
    answer: AnswerListItem
  ) {
    try {
      setDetailLoading(
        true
      );

      setError("");

      setMessage("");

      const [
        grading,
        firstReview,
      ] =
        await Promise.all([
          getGradingResult(
            answer.id
          ),

          getFirstReview(
            answer.id
          ),
        ]);

      /*
       * 一次確認済みのデータがあれば
       * それを優先。
       *
       * なければ自動採点結果。
       */
      const source =
        firstReview?.results
          ?.length
          ? firstReview.results
          : grading?.results ??
            [];

      const rows =
        source.map(
          (
            result
          ): ReviewRow => ({
            ...result,

            originalScore:
              result.score,

            originalMark:
              result.mark,

            changed:
              false,
          })
        );

      setResults(
        rows
      );

      setInternalNote(
        firstReview?.internalNote ??
          grading?.internalNote ??
          ""
      );

      setPublicAnnotation(
        firstReview?.publicAnnotation ??
          grading?.publicAnnotation ??
          ""
      );

      /*
       * 答案画像は選択時だけ
       * Supabaseから署名URL取得。
       */
      void loadImage(
        answer.id
      );
    } catch (
      error
    ) {
      console.error(
        "First review detail error:",
        error
      );

      setResults([]);

      setError(
        "採点結果を取得できませんでした。"
      );
    } finally {
      setDetailLoading(
        false
      );
    }
  }

  /* =======================================================
     Image
     ======================================================= */

  async function loadImage(
    answerId: string
  ) {
    try {
      setImageLoading(
        true
      );

      setImageUrl(
        null
      );

      const user =
        await getAppUser();

      if (
        !user ||
        !user.organizationId
      ) {
        return;
      }

      const answer =
        await getAnswerWithUrl(
          answerId
        );

      if (
        !answer
      ) {
        return;
      }

      /*
       * getAnswerWithUrlは
       * answers側の権限確認を行う。
       */
      setImageUrl(
        answer.signedUrl
      );
    } catch (
      error
    ) {
      console.error(
        "Answer image error:",
        error
      );

      setImageUrl(
        null
      );
    } finally {
      setImageLoading(
        false
      );
    }
  }

  /* =======================================================
     Search
     ======================================================= */

  const filteredAnswers =
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
     Statistics
     ======================================================= */

  const changedCount =
    results.filter(
      (
        result
      ) =>
        result.changed
    ).length;

  const totalScore =
    calculateTotalScore(
      results
    );

  const totalMaxScore =
    calculateTotalMaxScore(
      results
    );

  const manualPendingCount =
    results.filter(
      (
        result
      ) =>
        result.reviewRequired
    ).length;

  /* =======================================================
     Update score
     ======================================================= */

  function updateScore(
    index: number,
    value: string
  ) {
    const parsed =
      Number(
        value
      );

    if (
      !Number.isFinite(
        parsed
      )
    ) {
      return;
    }

    setResults(
      (
        current
      ) =>
        current.map(
          (
            result,
            resultIndex
          ) => {
            if (
              resultIndex !==
              index
            ) {
              return result;
            }

            const score =
              Math.min(
                Math.max(
                  0,
                  parsed
                ),
                result.maxScore
              );

            return {
              ...result,

              score,

              changed:
                score !==
                  result.originalScore ||
                result.mark !==
                  result.originalMark,
            };
          }
        )
    );

    setMessage("");
  }

  /* =======================================================
     Update mark
     ======================================================= */

  function updateMark(
    index: number,
    mark: GradingResult["mark"]
  ) {
    setResults(
      (
        current
      ) =>
        current.map(
          (
            result,
            resultIndex
          ) =>
            resultIndex ===
            index
              ? {
                  ...result,

                  mark,

                  changed:
                    mark !==
                      result.originalMark ||
                    result.score !==
                      result.originalScore,
                }
              : result
        )
    );

    setMessage("");
  }

  /* =======================================================
     Update reason
     ======================================================= */

  function updateReason(
    index: number,
    reason: string
  ) {
    setResults(
      (
        current
      ) =>
        current.map(
          (
            result,
            resultIndex
          ) =>
            resultIndex ===
            index
              ? {
                  ...result,

                  reason,

                  changed:
                    true,
                }
              : result
        )
    );

    setMessage("");
  }

  /* =======================================================
     Complete manual grading
     ======================================================= */

  function completeManualGrading(
    index: number
  ) {
    setResults(
      (
        current
      ) =>
        current.map(
          (
            result,
            resultIndex
          ) => {
            if (
              resultIndex !==
              index
            ) {
              return result;
            }

            const score =
              Math.min(
                Math.max(
                  0,
                  result.score
                ),
                result.maxScore
              );

            const mark =
              score ===
              result.maxScore
                ? "○"
                : score >
                    0
                  ? "△"
                  : "×";

            return {
              ...result,

              score,

              mark,

              reviewRequired:
                false,

              reason:
                result.reason ||
                "手動採点完了",

              changed:
                true,
            };
          }
        )
    );

    setMessage("");
  }

  /* =======================================================
     Save
     ======================================================= */

  async function handleSave() {
    if (
      !selectedAnswer
    ) {
      return;
    }

    if (
      saving
    ) {
      return;
    }

    try {
      setSaving(
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
          "一次確認権限がありません。"
        );
      }

      if (
        !selectedAnswer.studentNumber
      ) {
        throw new Error(
          "生徒番号が答案に紐付いていません。"
        );
      }

      /*
       * 手動採点が残っている場合でも
       * 保存自体は可能。
       *
       * ただし二次確認へは進めない。
       */
      const input:
        SaveReviewInput =
        {
          answerId:
            selectedAnswer.id,

          testId:
            selectedAnswer.testId,

          subjectId:
            selectedAnswer.subjectId,

          studentNumber:
            selectedAnswer.studentNumber,

          reviewerId:
            user.uid,

          results:
            results.map(
              (
                result
              ) => ({
                questionId:
                  result.questionId,

                questionNumber:
                  result.questionNumber,

                answerText:
                  result.answerText,

                mark:
                  result.mark,

                score:
                  result.score,

                maxScore:
                  result.maxScore,

                confidence:
                  result.confidence,

                reviewRequired:
                  result.reviewRequired,

                reason:
                  result.reason,

                rubric:
                  result.rubric,
              })
            ),

          internalNote,

          publicAnnotation,
        };

      await saveFirstReview(
        input
      );

      setMessage(
        manualPendingCount >
          0
          ? "一次確認を保存しました。手動採点が残っているため、二次確認にはまだ進めません。"
          : "一次確認を保存しました。"
      );

      await loadAnswers();
    } catch (
      error
    ) {
      console.error(
        "First review save error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "一次確認を保存できませんでした。"
      );
    } finally {
      setSaving(
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
            一次確認
          </h1>

          <p>
            確認対象の答案を読み込んでいます...
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
              一次確認
            </h1>

            <p className="muted">
              自動採点結果と手動採点対象を確認・修正します。
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
              href="/grading"
              className="button"
            >
              採点管理
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
            Main
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "360px minmax(0, 1fr)",

            gap:
              20,

            alignItems:
              "start",
          }}
        >

          {/* ================================================
              Answer list
              ================================================ */}

          <section className="card">
            <div
              style={{
                marginBottom:
                  12,
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
                  width:
                    "100%",
                }}
              />
            </div>

            <div
              style={{
                marginBottom:
                  12,

                fontSize:
                  12,

                color:
                  "#666",
              }}
            >
              確認対象：
              {
                filteredAnswers.length
              }
              件
            </div>

            {filteredAnswers.length ===
              0 && (
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
                  一次確認対象の答案はありません。
                </strong>

                <p
                  style={{
                    fontSize:
                      12,
                  }}
                >
                  自動採点後に確認が必要な答案、または手動採点対象の答案がここに表示されます。
                </p>
              </div>
            )}

            {filteredAnswers.map(
              (
                answer
              ) => {
                const active =
                  answer.id ===
                  selectedAnswerId;

                return (
                  <button
                    key={
                      answer.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedAnswerId(
                        answer.id
                      )
                    }
                    style={{
                      display:
                        "block",

                      width:
                        "100%",

                      marginBottom:
                        8,

                      padding:
                        14,

                      textAlign:
                        "left",

                      border:
                        active
                          ? "2px solid #111"
                          : "1px solid #ddd",

                      borderRadius:
                        8,

                      background:
                        active
                          ? "#f7f7f7"
                          : "#fff",

                      cursor:
                        "pointer",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap:
                          8,
                      }}
                    >
                      <strong>
                        {
                          answer.studentName ||
                          "生徒未紐付け"
                        }
                      </strong>

                      <span
                        style={{
                          fontSize:
                            11,
                        }}
                      >
                        {
                          getStatusLabel(
                            answer.status
                          )
                        }
                      </span>
                    </div>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          5,

                        fontSize:
                          12,
                      }}
                    >
                      {
                        answer.studentNumber ||
                        "生徒番号未設定"
                      }
                    </div>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          3,

                        fontSize:
                          12,
                      }}
                    >
                      {
                        answer.testName
                      }
                      {" / "}
                      {
                        answer.subjectName ||
                        "—"
                      }
                    </div>
                  </button>
                );
              }
            )}
          </section>

          {/* ================================================
              Review detail
              ================================================ */}

          <section className="card">
            {!selectedAnswer ? (
              <EmptyDetail />
            ) : detailLoading ? (
              <div
                style={{
                  padding:
                    60,

                  textAlign:
                    "center",
                }}
              >
                採点結果を読み込んでいます...
              </div>
            ) : (
              <>
                {/* ==========================================
                    Header
                    ========================================== */}

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
                      18,

                    borderBottom:
                      "1px solid #eee",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin:
                          0,
                      }}
                    >
                      {
                        selectedAnswer.studentName ||
                        "生徒未紐付け"
                      }
                    </h2>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          5,
                      }}
                    >
                      生徒番号：
                      {
                        selectedAnswer.studentNumber ||
                        "未設定"
                      }
                    </div>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          3,
                      }}
                    >
                      {
                        selectedAnswer.testName
                      }
                      {" / "}
                      {
                        selectedAnswer.subjectName ||
                        "—"
                      }
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
                      現在の得点
                    </div>

                    <strong
                      style={{
                        fontSize:
                          28,
                      }}
                    >
                      {
                        totalScore
                      }

                      <span
                        style={{
                          fontSize:
                            14,

                          fontWeight:
                            400,
                        }}
                      >
                        {" / "}
                        {
                          totalMaxScore
                        }
                      </span>
                    </strong>
                  </div>
                </header>

                {/* ==========================================
                    Answer image
                    ========================================== */}

                <section
                  style={{
                    marginTop:
                      18,
                  }}
                >
                  <h3>
                    答案
                  </h3>

                  <div
                    style={{
                      minHeight:
                        300,

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",

                      background:
                        "#f5f5f5",

                      borderRadius:
                        8,

                      overflow:
                        "hidden",
                    }}
                  >
                    {imageLoading ? (
                      <span>
                        答案画像を読み込んでいます...
                      </span>
                    ) : imageUrl ? (
                      selectedAnswer.contentType ===
                      "application/pdf" ? (
                        <iframe
                          src={
                            imageUrl
                          }
                          title="答案"
                          style={{
                            width:
                              "100%",

                            height:
                              500,

                            border:
                              0,
                          }}
                        />
                      ) : (
                        <img
                          src={
                            imageUrl
                          }
                          alt="答案"
                          style={{
                            maxWidth:
                              "100%",

                            maxHeight:
                              550,

                            objectFit:
                              "contain",
                          }}
                        />
                      )
                    ) : (
                      <span className="muted">
                        答案画像を表示できません。
                      </span>
                    )}
                  </div>
                </section>

                {/* ==========================================
                    Results
                    ========================================== */}

                <section
                  style={{
                    marginTop:
                      22,
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
                        10,
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin:
                            0,
                        }}
                      >
                        採点結果
                      </h3>

                      {manualPendingCount >
                        0 && (
                        <p
                          style={{
                            margin:
                              "5px 0 0",

                            color:
                              "#9a6500",

                            fontSize:
                              12,
                          }}
                        >
                          手動採点待ち：
                          {
                            manualPendingCount
                          }
                          問
                        </p>
                      )}
                    </div>

                    <span
                      className="muted"
                      style={{
                        fontSize:
                          12,
                      }}
                    >
                      変更：
                      {
                        changedCount
                      }
                      問
                    </span>
                  </div>

                  {results.length ===
                  0 ? (
                    <div
                      style={{
                        padding:
                          35,

                        textAlign:
                          "center",

                        color:
                          "#777",

                        border:
                          "1px solid #eee",

                        borderRadius:
                          8,
                      }}
                    >
                      採点結果がありません。
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
                              問題
                            </th>

                            <th>
                              採点方式
                            </th>

                            <th>
                              解答
                            </th>

                            <th>
                              判定
                            </th>

                            <th>
                              得点
                            </th>

                            <th>
                              確信度
                            </th>

                            <th>
                              理由
                            </th>

                            <th>
                              操作
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {results.map(
                            (
                              result,
                              index
                            ) => {
                              const isManual =
                                result.reviewRequired;

                              return (
                                <tr
                                  key={`${result.questionId}-${index}`}
                                  style={{
                                    background:
                                      isManual
                                        ? "#fffaf0"
                                        : result.changed
                                          ? "#f5f9ff"
                                          : undefined,
                                  }}
                                >
                                  <td>
                                    <strong>
                                      {
                                        result.questionNumber
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    <span
                                      style={{
                                        fontSize:
                                          11,

                                        padding:
                                          "3px 7px",

                                        borderRadius:
                                          999,

                                        background:
                                          isManual
                                            ? "#fff0cf"
                                            : "#e9f1ff",
                                      }}
                                    >
                                      {isManual
                                        ? "手動"
                                        : "自動"}
                                    </span>
                                  </td>

                                  <td
                                    style={{
                                      minWidth:
                                        160,
                                    }}
                                  >
                                    {
                                      result.answerText ||
                                      "—"
                                    }
                                  </td>

                                  <td>
                                    <select
                                      value={
                                        result.mark
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateMark(
                                          index,
                                          event
                                            .target
                                            .value as GradingResult["mark"]
                                        )
                                      }
                                    >
                                      <option value="○">
                                        ○
                                      </option>

                                      <option value="△">
                                        △
                                      </option>

                                      <option value="×">
                                        ×
                                      </option>
                                    </select>
                                  </td>

                                  <td>
                                    <div
                                      style={{
                                        display:
                                          "flex",

                                        alignItems:
                                          "center",

                                        gap:
                                          4,
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min={
                                          0
                                        }
                                        max={
                                          result.maxScore
                                        }
                                        value={
                                          result.score
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateScore(
                                            index,
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        style={{
                                          width:
                                            70,
                                        }}
                                      />

                                      <span>
                                        /
                                        {
                                          result.maxScore
                                        }
                                      </span>
                                    </div>
                                  </td>

                                  <td>
                                    {formatConfidence(
                                      result.confidence
                                    )}
                                  </td>

                                  <td>
                                    <input
                                      value={
                                        result.reason ??
                                        ""
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateReason(
                                          index,
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      placeholder="理由"
                                      style={{
                                        width:
                                          160,
                                      }}
                                    />
                                  </td>

                                  <td>
                                    {isManual ? (
                                      <button
                                        type="button"
                                        className="button"
                                        onClick={() =>
                                          completeManualGrading(
                                            index
                                          )
                                        }
                                      >
                                        採点完了
                                      </button>
                                    ) : (
                                      <span
                                        className="muted"
                                        style={{
                                          fontSize:
                                            11,
                                        }}
                                      >
                                        自動採点
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

                {/* ==========================================
                    Notes
                    ========================================== */}

                <section
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "1fr 1fr",

                    gap:
                      14,

                    marginTop:
                      20,
                  }}
                >
                  <label>
                    <strong>
                      内部メモ
                    </strong>

                    <textarea
                      value={
                        internalNote
                      }
                      onChange={(
                        event
                      ) =>
                        setInternalNote(
                          event
                            .target
                            .value
                        )
                      }
                      rows={
                        5
                      }
                      style={{
                        display:
                          "block",

                        width:
                          "100%",

                        marginTop:
                          6,
                      }}
                    />
                  </label>

                  <label>
                    <strong>
                      生徒公開コメント
                    </strong>

                    <textarea
                      value={
                        publicAnnotation
                      }
                      onChange={(
                        event
                      ) =>
                        setPublicAnnotation(
                          event
                            .target
                            .value
                        )
                      }
                      rows={
                        5
                      }
                      style={{
                        display:
                          "block",

                        width:
                          "100%",

                        marginTop:
                          6,
                      }}
                    />
                  </label>
                </section>

                {/* ==========================================
                    Footer
                    ========================================== */}

                <footer
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "center",

                    gap:
                      10,

                    marginTop:
                      20,

                    paddingTop:
                      18,

                    borderTop:
                      "1px solid #eee",
                  }}
                >
                  <div
                    className="muted"
                    style={{
                      fontSize:
                        12,
                    }}
                  >
                    {manualPendingCount >
                    0
                      ? "手動採点を完了してから二次確認へ進みます。"
                      : "一次確認を保存すると二次確認へ進めます。"}
                  </div>

                  <div
                    style={{
                      display:
                        "flex",

                      gap:
                        8,
                    }}
                  >
                    <button
                      type="button"
                      className="button primary"
                      disabled={
                        saving ||
                        results.length ===
                          0
                      }
                      onClick={
                        handleSave
                      }
                    >
                      {saving
                        ? "保存中..."
                        : "一次確認を保存"}
                    </button>

                    {manualPendingCount ===
                      0 && (
                      <Link
                        href="/grading/second-review"
                        className="button"
                      >
                        二次確認へ
                      </Link>
                    )}
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
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

function normalizeAnswerStatus(
  value: unknown
) {
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
      return "uploaded" as const;
  }
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
   Confidence
   ========================================================= */

function formatConfidence(
  value: number
) {
  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    return "—";
  }

  const percentage =
    value <= 1
      ? value * 100
      : value;

  return `${percentage.toFixed(
    0
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

/* =========================================================
   Empty
   ========================================================= */

function EmptyDetail() {
  return (
    <div
      style={{
        minHeight:
          500,

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        textAlign:
          "center",
      }}
    >
      <div>
        <strong>
          答案を選択してください
        </strong>

        <p className="muted">
          左側から一次確認する答案を選択してください。
        </p>
      </div>
    </div>
  );
}
