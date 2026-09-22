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
  getSecondReview,
  saveSecondReview,
  returnToFirstReview,
  hasDisagreement,
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

type AnswerListItem =
  Answer & {
    studentName: string;

    testName: string;

    subjectName: string;
  };

type ReviewRow =
  GradingResult & {
    firstScore: number;

    firstMark:
      | GradingResult["mark"]
      | null;

    changed: boolean;
  };

/* =========================================================
   Page
   ========================================================= */

export default function SecondReviewPage() {
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
    returning,
    setReturning,
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
     Load
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
          "二次確認は職員のみ利用できます。"
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
       * 二次確認対象は、
       *
       * status = second_review
       *
       * の答案。
       *
       * first_reviewのままの答案は
       * 二次確認画面には出さない。
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

      setSelectedAnswerId(
        (
          current
        ) => {
          if (
            current &&
            loaded.some(
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
            loaded[0]?.id ??
            null
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        "Second review load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "二次確認対象の答案を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Selected
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
     Detail
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
        firstReview,
        secondReview,
      ] =
        await Promise.all([
          getFirstReview(
            answer.id
          ),

          getSecondReview(
            answer.id
          ),
        ]);

      /*
       * 二次確認済みなら
       * 二次確認結果を表示。
       *
       * 未作成なら一次確認結果。
       */
      const source =
        secondReview?.results
          ?.length
          ? secondReview.results
          : firstReview?.results ??
            [];

      const firstResults =
        firstReview?.results ??
        [];

      const rows =
        source.map(
          (
            result
          ): ReviewRow => {
            const first =
              firstResults.find(
                (
                  item
                ) =>
                  item.questionId ===
                  result.questionId
              );

            return {
              ...result,

              firstScore:
                first?.score ??
                result.score,

              firstMark:
                first?.mark ??
                null,

              changed:
                first
                  ? first.score !==
                      result.score ||
                    first.mark !==
                      result.mark
                  : false,
            };
          }
        );

      setResults(
        rows
      );

      setInternalNote(
        secondReview?.internalNote ??
          firstReview?.internalNote ??
          ""
      );

      setPublicAnnotation(
        secondReview?.publicAnnotation ??
          firstReview?.publicAnnotation ??
          ""
      );

      void loadImage(
        answer.id
      );
    } catch (
      error
    ) {
      console.error(
        "Second review detail error:",
        error
      );

      setResults([]);

      setError(
        "二次確認データを取得できませんでした。"
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
        !user
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

      setImageUrl(
        answer.signedUrl
      );
    } catch (
      error
    ) {
      console.error(
        "Second review image error:",
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

  const hasDisagreements =
    useMemo(
      () => {
        const first =
          results.map(
            (
              result
            ) => ({
              ...result,

              score:
                result.firstScore,

              mark:
                result.firstMark ??
                result.mark,
            })
          );

        return hasDisagreement(
          first,
          results
        );
      },
      [
        results,
      ]
    );

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
                result.firstScore,
            };
          }
        )
    );

    setMessage("");
  }

  /* =======================================================
     Mark
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
                    result.firstMark,
                }
              : result
        )
    );

    setMessage("");
  }

  /* =======================================================
     Reason
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
          "二次確認権限がありません。"
        );
      }

      if (
        !selectedAnswer.studentNumber
      ) {
        throw new Error(
          "生徒番号が答案に紐付いていません。"
        );
      }

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
                  false,

                reason:
                  result.reason,

                rubric:
                  result.rubric,
              })
            ),

          internalNote,

          publicAnnotation,
        };

      await saveSecondReview(
        input
      );

      setMessage(
        "二次確認を保存しました。"
      );

      await loadAnswers();
    } catch (
      error
    ) {
      console.error(
        "Second review save error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "二次確認を保存できませんでした。"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Return
     ======================================================= */

  async function handleReturn() {
    if (
      !selectedAnswer
    ) {
      return;
    }

    if (
      returning
    ) {
      return;
    }

    try {
      setReturning(
        true
      );

      setError("");

      setMessage("");

      await returnToFirstReview(
        selectedAnswer.id
      );

      setMessage(
        "一次確認へ差し戻しました。"
      );

      await loadAnswers();
    } catch (
      error
    ) {
      console.error(
        "Return to first review error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "一次確認へ差し戻せませんでした。"
      );
    } finally {
      setReturning(
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
            二次確認
          </h1>

          <p>
            二次確認対象の答案を読み込んでいます...
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
              二次確認
            </h1>

            <p className="muted">
              一次確認済みの採点結果を再確認し、差異を確認します。
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
              href="/grading/confirm"
              className="button primary"
            >
              採点確定
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
              List
              ================================================ */}

          <section className="card">
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

                marginBottom:
                  12,
              }}
            />

            <div
              className="muted"
              style={{
                marginBottom:
                  12,

                fontSize:
                  12,
              }}
            >
              二次確認対象：
              {
                filtered.length
              }
              件
            </div>

            {filtered.length ===
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
                  二次確認対象の答案はありません。
                </strong>

                <p
                  style={{
                    fontSize:
                      12,
                  }}
                >
                  一次確認を完了した答案がここに表示されます。
                </p>
              </div>
            )}

            {filtered.map(
              (
                answer
              ) => (
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
                      selectedAnswerId ===
                      answer.id
                        ? "2px solid #111"
                        : "1px solid #ddd",

                    borderRadius:
                      8,

                    background:
                      selectedAnswerId ===
                      answer.id
                        ? "#f7f7f7"
                        : "#fff",

                    cursor:
                      "pointer",
                  }}
                >
                  <strong>
                    {
                      answer.studentName ||
                      "生徒未紐付け"
                    }
                  </strong>

                  <div
                    className="muted"
                    style={{
                      marginTop:
                        4,

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
              )
            )}
          </section>

          {/* ================================================
              Detail
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
                二次確認データを読み込んでいます...
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

                    <p
                      className="muted"
                      style={{
                        margin:
                          "5px 0 0",
                      }}
                    >
                      {
                        selectedAnswer.studentNumber ||
                        "生徒番号未設定"
                      }

                      {" / "}

                      {
                        selectedAnswer.testName
                      }

                      {" / "}

                      {
                        selectedAnswer.subjectName ||
                        "—"
                      }
                    </p>
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
                      二次確認得点
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
                    Difference warning
                    ========================================== */}

                {hasDisagreements && (
                  <div
                    style={{
                      marginTop:
                        16,

                      padding:
                        14,

                      border:
                        "1px solid #e6b85c",

                      borderRadius:
                        8,

                      background:
                        "#fff9e8",
                    }}
                  >
                    <strong>
                      一次確認と現在の採点結果に差異があります。
                    </strong>

                    <p
                      style={{
                        margin:
                          "5px 0 0",

                        fontSize:
                          12,
                      }}
                    >
                      差異を確認し、二次確認結果を保存してください。
                    </p>
                  </div>
                )}

                {/* ==========================================
                    Image
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
                        280,

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
                    Comparison table
                    ========================================== */}

                <section
                  style={{
                    marginTop:
                      22,
                  }}
                >
                  <h3>
                    採点比較
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
                            問題
                          </th>

                          <th>
                            解答
                          </th>

                          <th>
                            一次確認
                          </th>

                          <th>
                            二次確認
                          </th>

                          <th>
                            得点
                          </th>

                          <th>
                            理由
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {results.map(
                          (
                            result,
                            index
                          ) => {
                            const difference =
                              result.changed;

                            return (
                              <tr
                                key={`${result.questionId}-${index}`}
                                style={{
                                  background:
                                    difference
                                      ? "#fff9e8"
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

                                <td
                                  style={{
                                    minWidth:
                                      150,
                                  }}
                                >
                                  {
                                    result.answerText ||
                                    "—"
                                  }
                                </td>

                                <td>
                                  <div>
                                    <strong>
                                      {
                                        result.firstMark ??
                                        "—"
                                      }
                                    </strong>
                                  </div>

                                  <div
                                    className="muted"
                                    style={{
                                      fontSize:
                                        11,
                                    }}
                                  >
                                    {
                                      result.firstScore
                                    }
                                    {" / "}
                                    {
                                      result.maxScore
                                    }
                                  </div>
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
                                    placeholder="必要な場合"
                                  />
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
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
                        4
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
                        4
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
                    Actions
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
                      12,

                    marginTop:
                      20,

                    paddingTop:
                      18,

                    borderTop:
                      "1px solid #eee",
                  }}
                >
                  <button
                    type="button"
                    className="button"
                    disabled={
                      returning ||
                      saving
                    }
                    onClick={
                      handleReturn
                    }
                  >
                    {returning
                      ? "差し戻し中..."
                      : "一次確認へ差し戻す"}
                  </button>

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
                        : "二次確認を保存"}
                    </button>

                    {!hasDisagreements && (
                      <Link
                        href="/grading/confirm"
                        className="button"
                      >
                        採点確定へ
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
   Helpers
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

function getStatusLabel(
  status: Answer["status"]
) {
  switch (
    status
  ) {
    case "second_review":
      return "二次確認";

    case "confirmed":
      return "確定";

    default:
      return status;
  }
}

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
          左側から二次確認する答案を選択してください。
        </p>
      </div>
    </div>
  );
}
