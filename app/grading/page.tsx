"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import {
  getAllAnswers,
  getAnswerWithUrl,
  type Answer,
} from "@/lib/answers";

import {
  getGradingResult,
  saveFirstReview,
} from "@/lib/grading";

import type {
  GradingMark,
  GradingResult,
  Test,
  TestQuestion,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type TestRow = Test;

type QuestionRow =
  TestQuestion & {
    order: number;
  };

type AnswerCard = {
  answer: Answer;

  imageUrl: string | null;

  result:
    | GradingResult
    | null;

  selected: boolean;

  saving: boolean;
};

type MarkMode =
  | "○"
  | "×"
  | "△";

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
    tests,
    setTests,
  ] =
    useState<TestRow[]>(
      []
    );

  const [
    questions,
    setQuestions,
  ] =
    useState<QuestionRow[]>(
      []
    );

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState("");

  const [
    selectedQuestionId,
    setSelectedQuestionId,
  ] =
    useState("");

  const [
    answers,
    setAnswers,
  ] =
    useState<AnswerCard[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    loadingQuestions,
    setLoadingQuestions,
  ] =
    useState(false);

  const [
    loadingAnswers,
    setLoadingAnswers,
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
    markMode,
    setMarkMode,
  ] =
    useState<MarkMode | null>(
      null
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  /* =======================================================
     Initial
     ======================================================= */

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
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
          "採点権限がありません。"
        );
      }

      setRole(
        user.role
      );

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織が設定されていません。"
        );
      }

      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "tests"
            ),
            where(
              "organizationId",
              "==",
              user.organizationId
            ),
            where(
              "active",
              "==",
              true
            ),
            orderBy(
              "createdAt",
              "desc"
            )
          )
        );

      const loaded =
        snapshot.docs
          .map(
            (
              item
            ) =>
              normalizeTest(
                item.id,
                item.data()
              )
          )
          .filter(
            (
              test
            ) =>
              !test.isRetest
          );

      setTests(
        loaded
      );

      if (
        loaded.length >
        0
      ) {
        setSelectedTestId(
          loaded[0].id
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Grading initialize error:",
        error
      );

      setError(
        userError(
          error,
          "採点画面を読み込めませんでした。"
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /* =======================================================
     Selected test
     ======================================================= */

  const selectedTest =
    tests.find(
      (
        test
      ) =>
        test.id ===
        selectedTestId
    ) ??
    null;

  /* =======================================================
     Load questions
     ======================================================= */

  useEffect(() => {
    if (
      !selectedTest
    ) {
      setQuestions([]);
      setSelectedQuestionId("");
      return;
    }

    void loadQuestions(
      selectedTest
    );
  }, [
    selectedTestId,
  ]);

  async function loadQuestions(
    test: Test
  ) {
    try {
      setLoadingQuestions(
        true
      );

      setError("");

      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "testQuestions"
            ),
            where(
              "testId",
              "==",
              test.id
            )
          )
        );

      const loaded =
        snapshot.docs
          .map(
            (
              item
            ) => {
              const data =
                item.data();

              return {
                id:
                  item.id,

                testId:
                  test.id,

                questionNumber:
                  stringValue(
                    data.questionNumber
                  ),

                title:
                  stringValue(
                    data.title
                  ),

                maxScore:
                  safeNumber(
                    data.maxScore
                  ),

                gradingMethod:
                  data.gradingMethod ===
                  "automatic"
                    ? "automatic"
                    : "manual",

                correctAnswer:
                  stringValue(
                    data.correctAnswer
                  ),

                rubric:
                  stringValue(
                    data.rubric
                  ),

                requiresReview:
                  data.requiresReview ===
                  true,

                order:
                  safeNumber(
                    data.order
                  ),
              } as QuestionRow;
            }
          )
          .sort(
            (
              a,
              b
            ) =>
              questionOrder(
                a
              ) -
              questionOrder(
                b
              )
          );

      setQuestions(
        loaded
      );

      if (
        loaded.length >
        0
      ) {
        setSelectedQuestionId(
          loaded[0].id
        );
      } else {
        setSelectedQuestionId("");
      }
    } catch (
      error
    ) {
      console.error(
        "Question load error:",
        error
      );

      setQuestions([]);

      setError(
        userError(
          error,
          "問題を取得できませんでした。"
        )
      );
    } finally {
      setLoadingQuestions(
        false
      );
    }
  }

  /* =======================================================
     Selected question
     ======================================================= */

  const selectedQuestion =
    questions.find(
      (
        question
      ) =>
        question.id ===
        selectedQuestionId
    ) ??
    null;

  /* =======================================================
     Load answers
     ======================================================= */

  useEffect(() => {
    if (
      !selectedTest
    ) {
      setAnswers([]);
      return;
    }

    void loadAnswers(
      selectedTest
    );
  }, [
    selectedTestId,
  ]);

  async function loadAnswers(
    test: Test
  ) {
    try {
      setLoadingAnswers(
        true
      );

      setError("");

      const loaded =
        await getAllAnswers(
          test.testId ||
            test.id,
          test.subject
        );

      const cards =
        await Promise.all(
          loaded.map(
            async (
              answer
            ): Promise<AnswerCard> => {
              let imageUrl:
                | string
                | null =
                null;

              let result:
                | GradingResult
                | null =
                null;

              try {
                const withUrl =
                  await getAnswerWithUrl(
                    answer.id
                  );

                imageUrl =
                  withUrl?.signedUrl ??
                  null;
              } catch (
                error
              ) {
                console.error(
                  "Answer image error:",
                  error
                );
              }

              try {
                const grading =
                  await getGradingResult(
                    answer.id
                  );

                if (
                  grading &&
                  Array.isArray(
                    grading.results
                  )
                ) {
                  result =
                    grading.results.find(
                      (
                        item: GradingResult
                      ) =>
                        item.questionId ===
                        selectedQuestionId
                    ) ??
                    null;
                }
              } catch (
                error
              ) {
                console.error(
                  "Grading result error:",
                  error
                );
              }

              return {
                answer,

                imageUrl,

                result,

                selected:
                  false,

                saving:
                  false,
              };
            }
          )
        );

      setAnswers(
        cards
      );
    } catch (
      error
    ) {
      console.error(
        "Answer load error:",
        error
      );

      setAnswers([]);

      setError(
        userError(
          error,
          "答案を取得できませんでした。"
        )
      );
    } finally {
      setLoadingAnswers(
        false
      );
    }
  }

  /* =======================================================
     Question change
     ======================================================= */

  function changeQuestion(
    questionId: string
  ) {
    setSelectedQuestionId(
      questionId
    );

    setMarkMode(
      null
    );

    setAnswers(
      (
        current: AnswerCard[]
      ) =>
        current.map(
          (
            item
          ) => ({
            ...item,

            selected:
              false,
          })
        )
    );

    /*
     * 現在ロード済みのgrading結果から
     * 新しい問題の結果を表示。
     */
    void refreshQuestionResults(
      questionId
    );
  }

  async function refreshQuestionResults(
    questionId: string
  ) {
    const next =
      await Promise.all(
        answers.map(
          async (
            card
          ) => {
            let result:
              | GradingResult
              | null =
              null;

            try {
              const grading =
                await getGradingResult(
                  card.answer.id
                );

              result =
                grading?.results?.find(
                  (
                    item: GradingResult
                  ) =>
                    item.questionId ===
                    questionId
                ) ??
                null;
            } catch (
              error
            ) {
              console.error(
                error
              );
            }

            return {
              ...card,

              result,

              selected:
                false,
            };
          }
        )
      );

    setAnswers(
      next
    );
  }

  /* =======================================================
     Selection
     ======================================================= */

  function toggleAnswer(
    answerId: string
  ) {
    setAnswers(
      (
        current: AnswerCard[]
      ) =>
        current.map(
          (
            card
          ) =>
            card.answer.id ===
            answerId
              ? {
                  ...card,

                  selected:
                    !card.selected,
                }
              : card
        )
    );
  }

  function selectAllVisible() {
    setAnswers(
      (
        current: AnswerCard[]
      ) =>
        current.map(
          (
            card
          ) => ({
            ...card,

            selected:
              true,
          })
        )
    );
  }

  function clearSelection() {
    setAnswers(
      (
        current: AnswerCard[]
      ) =>
        current.map(
          (
            card
          ) => ({
            ...card,

            selected:
              false,
          })
        )
    );
  }

  /* =======================================================
     Apply mark
     ======================================================= */

  async function applyMark(
    mark: MarkMode
  ) {
    if (
      !selectedQuestion
    ) {
      return;
    }

    const selected =
      answers.filter(
        (
          card
        ) =>
          card.selected
      );

    if (
      selected.length ===
      0
    ) {
      setError(
        "採点する答案を選択してください。"
      );

      return;
    }

    if (
      mark ===
      "△"
    ) {
      setMarkMode(
        "△"
      );

      return;
    }

    setSaving(
      true
    );

    setError("");
    setMessage("");

    try {
      for (
        const card of
          selected
      ) {
        await saveMark(
          card,
          mark,
          selectedQuestion
        );
      }

      setAnswers(
        (
          current: AnswerCard[]
        ) =>
          current.map(
            (
              card
            ) =>
              card.selected
                ? {
                    ...card,

                    selected:
                      false,

                    result:
                      createLocalResult(
                        card.result,
                        selectedQuestion,
                        mark
                      ),
                  }
                : card
          )
      );

      setMessage(
        `${selected.length}件に${mark}を付けました。`
      );

      setMarkMode(
        null
      );
    } catch (
      error
    ) {
      console.error(
        "Apply mark error:",
        error
      );

      setError(
        userError(
          error,
          "採点結果を保存できませんでした。"
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Partial score
     ======================================================= */

  async function applyPartialScore(
    score: number
  ) {
    if (
      !selectedQuestion
    ) {
      return;
    }

    const selected =
      answers.filter(
        (
          card
        ) =>
          card.selected
      );

    if (
      selected.length ===
      0
    ) {
      setError(
        "部分点を付ける答案を選択してください。"
      );

      return;
    }

    setSaving(
      true
    );

    try {
      for (
        const card of
          selected
      ) {
        await saveMark(
          card,
          "△",
          selectedQuestion,
          score
        );
      }

      setAnswers(
        (
          current: AnswerCard[]
        ) =>
          current.map(
            (
              card
            ) =>
              card.selected
                ? {
                    ...card,

                    selected:
                      false,

                    result:
                      createLocalResult(
                        card.result,
                        selectedQuestion,
                        "△",
                        score
                      ),
                  }
                : card
          )
      );

      setMessage(
        `${selected.length}件を${score}点にしました。`
      );

      setMarkMode(
        null
      );
    } catch (
      error
    ) {
      console.error(
        "Partial score error:",
        error
      );

      setError(
        userError(
          error,
          "部分点を保存できませんでした。"
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Save mark
     ======================================================= */

  async function saveMark(
    card: AnswerCard,
    mark: MarkMode,
    question: QuestionRow,
    scoreOverride?: number
  ) {
    /*
     * この画面では1問ずつ採点するため、
     * 既存結果を取得して該当問題だけ変更。
     */
    const grading =
      await getGradingResult(
        card.answer.id
      );

    const existingResults:
      GradingResult[] =
      Array.isArray(
        grading?.results
      )
        ? grading.results
        : [];

    const result =
      createLocalResult(
        existingResults.find(
          (
            item: GradingResult
          ) =>
            item.questionId ===
            question.id
        ) ??
          null,
        question,
        mark,
        scoreOverride
      );

    const index =
      existingResults.findIndex(
        (
          item: GradingResult
        ) =>
          item.questionId ===
          question.id
      );

    const nextResults =
      [...existingResults];

    if (
      index >=
      0
    ) {
      nextResults[index] =
        result;
    } else {
      nextResults.push(
        result
      );
    }

    const totalScore =
      nextResults.reduce(
        (
          total,
          item
        ) =>
          total +
          safeNumber(
            item.score
          ),
        0
      );

    const totalMaxScore =
      nextResults.reduce(
        (
          total,
          item
        ) =>
          total +
          safeNumber(
            item.maxScore
          ),
        0
      );

    /*
     * 既存の一次確認保存処理を利用。
     *
     * reviewerIdには現在ログイン中UIDを使用。
     */
    const user =
      await getAppUser();

    if (
      !user
    ) {
      throw new Error(
        "ログインしてください。"
      );
    }

    await saveFirstReview({
      answerId:
        card.answer.id,

      testId:
        card.answer.testId,

      subjectId:
        card.answer.subjectId,

      studentNumber:
        card.answer.studentNumber ??
        "",

      reviewerId:
        user.uid,

      results:
        nextResults,

      internalNote:
        "",

      publicAnnotation:
        "",
    });

    void totalScore;
    void totalMaxScore;
  }

  /* =======================================================
     Keyboard
     ======================================================= */

  useEffect(() => {
    function onKeyDown(
      event: KeyboardEvent
    ) {
      /*
       * input / textarea / select入力中は
       * 採点ショートカットを発火させない。
       */
      const target =
        event.target;

      if (
        target instanceof
          HTMLInputElement ||
        target instanceof
          HTMLTextAreaElement ||
        target instanceof
          HTMLSelectElement
      ) {
        return;
      }

      if (
        event.key ===
        "k" ||
        event.key ===
        "K"
      ) {
        event.preventDefault();

        void applyMark(
          "○"
        );

        return;
      }

      if (
        event.key ===
        "l" ||
        event.key ===
        "L"
      ) {
        event.preventDefault();

        void applyMark(
          "×"
        );

        return;
      }

      if (
        event.key ===
        "Escape"
      ) {
        setMarkMode(
          null
        );

        clearSelection();
      }
    }

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, [
    answers,
    selectedQuestion,
  ]);

  /* =======================================================
     Display answers
     ======================================================= */

  const visibleAnswers =
    useMemo(
      () =>
        answers,
      [
        answers,
      ]
    );

  const selectedCount =
    answers.filter(
      (
        card
      ) =>
        card.selected
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
            採点
          </h1>

          <p>
            採点画面を読み込んでいます...
          </p>
        </section>
      </main>
    );
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <main
      className="page"
      style={{
        minHeight:
          "100vh",
      }}
    >
      <section
        className="content"
        style={{
          maxWidth:
            1800,

          margin:
            "0 auto",
        }}
      >
        {/* ==================================================
            Header
            ================================================== */}

        <header
          className="pageHeader"
        >
          <div>
            <h1>
              採点
            </h1>

            <p className="muted">
              同じ問題の答案を並べて一括で丸付けします。
            </p>
          </div>
        </header>

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
            Test
            ================================================== */}

        <section
          className="card"
          style={{
            marginBottom:
              12,
          }}
        >
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "minmax(0, 1fr) minmax(0, 1fr)",

              gap:
                12,
            }}
          >
            <label>
              <strong>
                テスト
              </strong>

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

                  marginTop:
                    6,
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

            <label>
              <strong>
                問題
              </strong>

              <select
                value={
                  selectedQuestionId
                }
                onChange={(
                  event
                ) =>
                  changeQuestion(
                    event.target
                      .value
                  )
                }
                disabled={
                  loadingQuestions ||
                  questions.length ===
                    0
                }
                style={{
                  width:
                    "100%",

                  marginTop:
                    6,
                }}
              >
                {questions.map(
                  (
                    question
                  ) => (
                    <option
                      key={
                        question.id
                      }
                      value={
                        question.id
                      }
                    >
                      問
                      {
                        question.questionNumber
                      }
                      {" "}
                      {
                        question.title
                      }
                      {" / "}
                      {
                        question.maxScore
                      }
                      点
                    </option>
                  )
                )}
              </select>
            </label>
          </div>
        </section>

        {!selectedQuestion ? (
          <section className="card">
            <EmptyState />
          </section>
        ) : (
          <>
            {/* ==================================================
                Question navigation
                ================================================== */}

            <section
              className="card"
              style={{
                marginBottom:
                  12,
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
                    12,
                }}
              >
                <div>
                  <strong>
                    問
                    {
                      selectedQuestion.questionNumber
                    }
                  </strong>

                  <span
                    style={{
                      marginLeft:
                        10,
                    }}
                  >
                    {
                      selectedQuestion.maxScore
                    }
                    点
                  </span>
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      6,
                  }}
                >
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      moveQuestion(
                        questions,
                        selectedQuestionId,
                        -1,
                        changeQuestion
                      )
                    }
                  >
                    ← 前
                  </button>

                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      moveQuestion(
                        questions,
                        selectedQuestionId,
                        1,
                        changeQuestion
                      )
                    }
                  >
                    次 →
                  </button>
                </div>
              </div>
            </section>

            {/* ==================================================
                Mark toolbar
                ================================================== */}

            <section
              className="card"
              style={{
                marginBottom:
                  12,
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    8,

                  flexWrap:
                    "wrap",
                }}
              >
                <button
                  type="button"
                  className="button"
                  onClick={
                    selectAllVisible
                  }
                >
                  全選択
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

                <span
                  className="muted"
                  style={{
                    margin:
                      "0 8px",
                  }}
                >
                  {
                    selectedCount
                  }
                  件選択
                </span>

                <button
                  type="button"
                  className="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void applyMark(
                      "○"
                    )
                  }
                >
                  ○
                </button>

                <button
                  type="button"
                  className="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void applyMark(
                      "×"
                    )
                  }
                >
                  ×
                </button>

                <button
                  type="button"
                  className="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void applyMark(
                      "△"
                    )
                  }
                >
                  △
                </button>

                <span
                  className="muted"
                  style={{
                    marginLeft:
                      10,

                    fontSize:
                      11,
                  }}
                >
                  K = ○　L = ×
                </span>
              </div>

              {markMode ===
                "△" && (
                <div
                  style={{
                    marginTop:
                      12,

                    padding:
                      12,

                    background:
                      "#f7f7f7",

                    borderRadius:
                      8,
                  }}
                >
                  <strong>
                    部分点
                  </strong>

                  <div
                    style={{
                      display:
                        "flex",

                      gap:
                        6,

                      flexWrap:
                        "wrap",

                      marginTop:
                        8,
                    }}
                  >
                    {createScoreOptions(
                      selectedQuestion.maxScore
                    ).map(
                      (
                        score
                      ) => (
                        <button
                          key={
                            score
                          }
                          type="button"
                          className="button"
                          disabled={
                            saving
                          }
                          onClick={() =>
                            void applyPartialScore(
                              score
                            )
                          }
                        >
                          {
                            score
                          }
                          点
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ==================================================
                Answer board
                ================================================== */}

            <section
              className="card"
              style={{
                overflow:
                  "hidden",
              }}
            >
              <div
                style={{
                  marginBottom:
                    12,
                }}
              >
                <strong>
                  問
                  {
                    selectedQuestion.questionNumber
                  }
                  の採点
                </strong>

                <span
                  className="muted"
                  style={{
                    marginLeft:
                      10,

                    fontSize:
                      11,
                  }}
                >
                  画面に収まる答案を表示します
                </span>
              </div>

              {loadingAnswers ? (
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
                  答案を読み込んでいます...
                </div>
              ) : visibleAnswers.length ===
                0 ? (
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
                  このテストの答案がありません。
                </div>
              ) : (
                <AnswerBoard
                  question={
                    selectedQuestion
                  }
                  answers={
                    visibleAnswers
                  }
                  onToggle={
                    toggleAnswer
                  }
                />
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

/* =========================================================
   Answer board
   ========================================================= */

function AnswerBoard({
  question,
  answers,
  onToggle,
}: {
  question: QuestionRow;

  answers: AnswerCard[];

  onToggle: (
    answerId: string
  ) => void;
}) {
  return (
    <div
      style={{
        display:
          "grid",

        /*
         * 模範解答1枚 +
         * 生徒答案。
         *
         * auto-fitで画面幅に応じて
         * 表示数を調整する。
         */
        gridTemplateColumns:
          "repeat(auto-fit, minmax(190px, 1fr))",

        gap:
          10,

        alignItems:
          "start",
      }}
    >
      {/* ==================================================
          Model answer
          ================================================== */}

      <div
        style={{
          border:
            "2px solid #222",

          borderRadius:
            8,

          overflow:
            "hidden",

          background:
            "#fff",
        }}
      >
        <div
          style={{
            padding:
              "7px 8px",

            fontWeight:
              700,

            fontSize:
              11,

            background:
              "#222",

            color:
              "#fff",

            textAlign:
              "center",
          }}
        >
          模範解答
        </div>

        <div
          style={{
            aspectRatio:
              "4 / 3",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            padding:
              10,

            overflow:
              "hidden",

            background:
              "#fafafa",
          }}
        >
          <div
            style={{
              width:
                "100%",

              textAlign:
                "center",

              fontSize:
                16,

              lineHeight:
                1.6,

              wordBreak:
                "break-word",
            }}
          >
            {
              question.correctAnswer ||
              "正答未設定"
            }
          </div>
        </div>

        <div
          style={{
            padding:
              8,

            fontSize:
              10,

            borderTop:
              "1px solid #eee",
          }}
        >
          配点：
          {
            question.maxScore
          }
          点
        </div>
      </div>

      {/* ==================================================
          Student answers
          ================================================== */}

      {answers.map(
        (
          card
        ) => (
          <AnswerTile
            key={
              card.answer.id
            }
            card={
              card
            }
            onToggle={
              onToggle
            }
          />
        )
      )}
    </div>
  );
}

/* =========================================================
   Answer tile
   ========================================================= */

function AnswerTile({
  card,
  onToggle,
}: {
  card: AnswerCard;

  onToggle: (
    answerId: string
  ) => void;
}) {
  const mark =
    card.result?.mark ??
    null;

  return (
    <button
      type="button"
      onClick={() =>
        onToggle(
          card.answer.id
        )
      }
      style={{
        position:
          "relative",

        border:
          card.selected
            ? "3px solid #111"
            : "1px solid #ccc",

        borderRadius:
          8,

        overflow:
          "hidden",

        background:
          "#fff",

        padding:
          0,

        cursor:
          "pointer",

        textAlign:
          "left",

        boxShadow:
          card.selected
            ? "0 0 0 2px rgba(0,0,0,.08)"
            : "none",
      }}
    >
      <div
        style={{
          aspectRatio:
            "4 / 3",

          position:
            "relative",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          overflow:
            "hidden",

          background:
            "#f5f5f5",
        }}
      >
        {card.imageUrl ? (
          <img
            src={
              card.imageUrl
            }
            alt=""
            style={{
              width:
                "100%",

              height:
                "100%",

              objectFit:
                "contain",
            }}
          />
        ) : (
          <span
            style={{
              color:
                "#999",

              fontSize:
                11,
            }}
          >
            答案画像なし
          </span>
        )}

        {mark && (
          <span
            style={{
              position:
                "absolute",

              right:
                8,

              bottom:
                8,

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              width:
                42,

              height:
                42,

              borderRadius:
                "50%",

              background:
                "rgba(255,255,255,.9)",

              border:
                "3px solid #111",

              fontSize:
                24,

              fontWeight:
                700,
            }}
          >
            {
              mark
            }
          </span>
        )}
      </div>

      {card.result && (
        <div
          style={{
            padding:
              7,

            borderTop:
              "1px solid #eee",

            textAlign:
              "center",

            fontSize:
              11,
          }}
        >
          {
            card.result.score
          }
          {" / "}
          {
            card.result.maxScore
          }
          点
        </div>
      )}
    </button>
  );
}

/* =========================================================
   Local result
   ========================================================= */

function createLocalResult(
  previous:
    | GradingResult
    | null,
  question: QuestionRow,
  mark: GradingMark,
  scoreOverride?: number
): GradingResult {
  let score = 0;

  if (
    scoreOverride !==
    undefined
  ) {
    score =
      Math.max(
        0,
        Math.min(
          question.maxScore,
          scoreOverride
        )
      );
  } else if (
    mark ===
    "○"
  ) {
    score =
      question.maxScore;
  }

  return {
    questionId:
      question.id,

    questionNumber:
      question.questionNumber,

    answerText:
      previous?.answerText ??
      "",

    mark,

    score,

    maxScore:
      question.maxScore,

    confidence:
      previous?.confidence ??
      1,

    reviewRequired:
      mark ===
        "△" ||
      question.requiresReview,

    reason:
      mark ===
      "○"
        ? "手動採点：正解"
        : mark ===
            "×"
          ? "手動採点：不正解"
          : "手動採点：部分点",

    rubric:
      question.rubric,
  };
}

/* =========================================================
   Score options
   ========================================================= */

function createScoreOptions(
  maxScore: number
) {
  if (
    maxScore <=
    0
  ) {
    return [
      0,
    ];
  }

  /*
   * 1点刻み。
   * 配点が大きい場合でも全点を選択可能。
   */
  return Array.from(
    {
      length:
        maxScore +
        1,
    },
    (
      _,
      index
    ) =>
      index
  );
}

/* =========================================================
   Question navigation
   ========================================================= */

function moveQuestion(
  questions: QuestionRow[],
  currentId: string,
  direction: number,
  change: (
    id: string
  ) => void
) {
  const index =
    questions.findIndex(
      (
        question
      ) =>
        question.id ===
        currentId
    );

  if (
    index <
    0
  ) {
    return;
  }

  const next =
    index +
    direction;

  if (
    next <
      0 ||
    next >=
      questions.length
  ) {
    return;
  }

  change(
    questions[next].id
  );
}

/* =========================================================
   Test normalize
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
   Question order
   ========================================================= */

function questionOrder(
  question: QuestionRow
) {
  const numeric =
    Number(
      question.questionNumber
    );

  if (
    Number.isFinite(
      numeric
    )
  ) {
    return numeric;
  }

  return Number.MAX_SAFE_INTEGER;
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
        採点する問題がありません。
      </strong>

      <p
        style={{
          marginTop:
            6,

          fontSize:
            12,
        }}
      >
        テストと問題を選択してください。
      </p>
    </div>
  );
}

/* =========================================================
   Error
   ========================================================= */

function userError(
  error: unknown,
  fallback: string
) {
  const message =
    error instanceof Error
      ? error.message
      : String(
          error ??
            ""
        );

  if (
    message.includes(
      "Missing or insufficient permissions"
    ) ||
    message.includes(
      "permission-denied"
    ) ||
    message.includes(
      "PERMISSION_DENIED"
    )
  ) {
    return "この操作を実行する権限がありません。";
  }

  if (
    message.includes(
      "unauthenticated"
    ) ||
    message.includes(
      "UNAUTHENTICATED"
    )
  ) {
    return "ログインが必要です。";
  }

  if (
    /[ぁ-んァ-ヶ一-龯]/.test(
      message
    )
  ) {
    return message;
  }

  return fallback;
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
