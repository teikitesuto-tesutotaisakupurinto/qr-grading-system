"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useSearchParams,
} from "next/navigation";

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
  getScopedDocs,
  answersQueries,
  studentsQueries,
  testsQueries,
  testQuestionsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import {
  getGradingResult,
  saveFirstReview,
} from "@/lib/grading";

import type {
  Answer,
  GradingMark,
  GradingResult,
  Student,
  Test,
  TestQuestion,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type ReviewRow =
  Answer & {
    studentName: string;
    testName: string;
    subjectName: string;
  };

type EditableResult =
  GradingResult & {
    changed: boolean;
  };

/* =========================================================
   Page
   ========================================================= */

export default function GradingReviewPage() {
  const searchParams =
    useSearchParams();

  const requestedAnswerId =
    searchParams.get(
      "answerId"
    );

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
    useState<ReviewRow[]>(
      []
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(
      requestedAnswerId
    );

  const [
    questions,
    setQuestions,
  ] =
    useState<TestQuestion[]>(
      []
    );

  const [
    results,
    setResults,
  ] =
    useState<EditableResult[]>(
      []
    );

  const [
    imageUrl,
    setImageUrl,
  ] =
    useState<
      string | null
    >(null);

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

  /* =======================================================
     Initial load
     ======================================================= */

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(
        true
      );

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
          "一次確認を利用する権限がありません。"
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
       * 一次確認対象だけ。
       *
       * すでに二次確認・確定した答案は
       * この一覧には出さない。
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
                "graded" ||
              answer.status ===
                "first_review"
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

      setSelectedId(
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
        "First review load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "一次確認対象を取得できませんでした。"
      );
    } finally {
      setLoading(
        false
      );
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
     Selected answer
     ======================================================= */

  const selected =
    answers.find(
      (
        answer
      ) =>
        answer.id ===
        selectedId
    ) ??
    null;

  /* =======================================================
     Load review detail
     ======================================================= */

  useEffect(() => {
    if (
      !selected
    ) {
      setQuestions([]);

      setResults([]);

      setImageUrl(
        null
      );

      setInternalNote("");

      setPublicAnnotation("");

      return;
    }

    void loadReviewDetail(
      selected
    );
  }, [
    selectedId,
  ]);

  async function loadReviewDetail(
    answer: ReviewRow
  ) {
    try {
      setDetailLoading(
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
        !user.organizationId
      ) {
        throw new Error(
          "所属組織がありません。"
        );
      }

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
        questionDocuments,
        grading,
        image,
      ] =
        await Promise.all([
          getScopedDocs(
            testQuestionsQueries(
              scopeUser,
              answer.testId
            )
          ),

          getGradingResult(
            answer.id
          ),

          getAnswerWithUrl(
            answer.id
          ),
        ]);

      const loadedQuestions =
        questionDocuments
          .map(
            (
              item
            ) =>
              normalizeQuestion(
                item.id,
                item.data
              )
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
        loadedQuestions
      );

      setImageUrl(
        image?.signedUrl ??
        null
      );

      /*
       * grading結果がある場合はそれを使う。
       *
       * ない場合でも問題設定から空の採点表を作る。
       */
      const initialResults =
        buildEditableResults(
          loadedQuestions,
          grading?.results ??
            []
        );

      setResults(
        initialResults
      );

      setInternalNote(
        grading?.internalNote ??
          ""
      );

      setPublicAnnotation(
        grading?.publicAnnotation ??
          ""
      );
    } catch (
      error
    ) {
      console.error(
        "First review detail error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "一次確認データを取得できませんでした。"
      );
    } finally {
      setDetailLoading(
        false
      );
    }
  }

  /* =======================================================
     Update result
     ======================================================= */

  function updateResult(
    questionId: string,
    patch: Partial<EditableResult>
  ) {
    setResults(
      (
        current
      ) =>
        current.map(
          (
            result
          ) =>
            result.questionId ===
            questionId
              ? {
                  ...result,
                  ...patch,
                  changed:
                    true,
                }
              : result
        )
    );
  }

  /* =======================================================
     Save
     ======================================================= */

  async function handleSave() {
    if (
      !selected
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

      /*
       * 手動採点が未完了の場合は
       * 0点のまま保存しない。
       *
       * 手動問題はreviewRequired=trueのまま
       * でもよいが、点数は明示入力させる。
       */
      const validationError =
        validateEditableResults(
          results,
          questions
        );

      if (
        validationError
      ) {
        throw new Error(
          validationError
        );
      }

      const cleanedResults =
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
              result.reason ??
              "",

            rubric:
              result.rubric ??
              "",
          })
        );

      const result =
        await saveFirstReview(
          {
            answerId:
              selected.id,

            testId:
              selected.testId,

            subjectId:
              selected.subjectId,

            studentNumber:
              selected.studentNumber ??
              "",

            reviewerId:
              user.uid,

            results:
              cleanedResults,

            internalNote,

            publicAnnotation,
          }
        );

      setMessage(
        result.status ===
          "second_review"
          ? "一次確認が完了しました。二次確認へ進めます。"
          : "一次確認結果を保存しました。"
      );

      await loadPage();
    } catch (
      error
    ) {
      console.error(
        "Save first review error:",
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
     Summary
     ======================================================= */

  const totalScore =
    results.reduce(
      (
        total,
        result
      ) =>
        total +
        safeNumber(
          result.score
        ),
      0
    );

  const totalMaxScore =
    results.reduce(
      (
        total,
        result
      ) =>
        total +
        safeNumber(
          result.maxScore
        ),
      0
    );

  const pendingManual =
    results.filter(
      (
        result
      ) =>
        result.reviewRequired
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
            一次確認
          </h1>

          <p>
            一次確認対象を読み込んでいます...
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
              自動採点結果と手動採点結果を確認・修正します。
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
              "minmax(350px, .85fr) minmax(0, 1.55fr)",

            gap:
              18,

            marginTop:
              16,

            alignItems:
              "start",
          }}
        >

          {/* ================================================
              List
              ================================================ */}

          <section className="card">
            <h2>
              確認対象
            </h2>

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

                marginTop:
                  10,
              }}
            />

            <div
              style={{
                marginTop:
                  12,
              }}
            >
              {filtered.length ===
              0 ? (
                <EmptyList />
              ) : (
                filtered.map(
                  (
                    answer
                  ) => (
                    <button
                      key={
                        answer.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedId(
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
                          13,

                        border:
                          selectedId ===
                          answer.id
                            ? "2px solid #111"
                            : "1px solid #ddd",

                        borderRadius:
                          8,

                        background:
                          selectedId ===
                          answer.id
                            ? "#f7f7f7"
                            : "#fff",

                        textAlign:
                          "left",

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
                        <div>
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

                              marginTop:
                                3,
                            }}
                          >
                            {
                              answer.studentNumber ||
                              "生徒番号なし"
                            }
                          </div>
                        </div>

                        <StatusBadge
                          status={
                            answer.status
                          }
                        />
                      </div>

                      <div
                        style={{
                          marginTop:
                            8,

                          fontSize:
                            12,
                        }}
                      >
                        {
                          answer.testName
                        }
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop:
                            3,

                          fontSize:
                            11,
                        }}
                      >
                        {
                          answer.subjectName ||
                          "—"
                        }
                      </div>
                    </button>
                  )
                )
              )}
            </div>
          </section>

          {/* ================================================
              Detail
              ================================================ */}

          <section className="card">
            {!selected ? (
              <EmptyDetail />
            ) : detailLoading ? (
              <div
                style={{
                  minHeight:
                    650,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",
                }}
              >
                一次確認データを読み込んでいます...
              </div>
            ) : (
              <>
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
                    <h2
                      style={{
                        margin:
                          0,
                      }}
                    >
                      {
                        selected.studentName ||
                        "生徒未紐付け"
                      }
                    </h2>

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
                        selected.studentNumber ||
                        "生徒番号なし"
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
                        selected.testName
                      }

                      {" / "}

                      {
                        selected.subjectName ||
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
                          10,
                      }}
                    >
                      現在の合計
                    </div>

                    <strong
                      style={{
                        fontSize:
                          24,
                      }}
                    >
                      {
                        totalScore
                      }
                      {" / "}
                      {
                        totalMaxScore
                      }
                    </strong>
                  </div>
                </header>

                {/* =================================================
                    Answer image
                    ================================================= */}

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

                      maxHeight:
                        520,

                      overflow:
                        "auto",

                      display:
                        "flex",

                      justifyContent:
                        "center",

                      alignItems:
                        "flex-start",

                      background:
                        "#f5f5f5",

                      borderRadius:
                        8,
                    }}
                  >
                    {imageUrl ? (
                      selected.contentType ===
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
                              500,

                            objectFit:
                              "contain",
                          }}
                        />
                      )
                    ) : (
                      <div
                        style={{
                          padding:
                            50,

                          color:
                            "#777",
                        }}
                      >
                        答案画像を表示できません。
                      </div>
                    )}
                  </div>
                </section>

                {/* =================================================
                    Questions
                    ================================================= */}

                <section
                  style={{
                    marginTop:
                      20,
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
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin:
                            0,
                        }}
                      >
                        問題別採点
                      </h3>

                      {pendingManual >
                        0 && (
                        <p
                          className="muted"
                          style={{
                            margin:
                              "5px 0 0",

                            fontSize:
                              11,
                          }}
                        >
                          手動確認が必要：
                          {
                            pendingManual
                          }
                          問
                        </p>
                      )}
                    </div>
                  </div>

                  {results.length ===
                  0 ? (
                    <div
                      style={{
                        padding:
                          30,

                        textAlign:
                          "center",

                        color:
                          "#777",
                      }}
                    >
                      問題別採点結果がありません。
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop:
                          12,
                      }}
                    >
                      {results.map(
                        (
                          result
                        ) => (
                          <QuestionReviewRow
                            key={
                              result.questionId
                            }
                            result={
                              result
                            }
                            onChange={
                              updateResult
                            }
                          />
                        )
                      )}
                    </div>
                  )}
                </section>

                {/* =================================================
                    Notes
                    ================================================= */}

                <section
                  style={{
                    marginTop:
                      20,
                  }}
                >
                  <h3>
                    確認メモ
                  </h3>

                  <label
                    style={{
                      display:
                        "block",
                    }}
                  >
                    <span
                      className="muted"
                      style={{
                        display:
                          "block",

                        marginBottom:
                          5,

                        fontSize:
                          11,
                      }}
                    >
                      内部メモ
                    </span>

                    <textarea
                      value={
                        internalNote
                      }
                      onChange={(
                        event
                      ) =>
                        setInternalNote(
                          event.target
                            .value
                        )
                      }
                      rows={
                        3
                      }
                      style={{
                        width:
                          "100%",
                      }}
                      placeholder="講師間で共有する確認メモ"
                    />
                  </label>

                  <label
                    style={{
                      display:
                        "block",

                      marginTop:
                        12,
                    }}
                  >
                    <span
                      className="muted"
                      style={{
                        display:
                          "block",

                        marginBottom:
                          5,

                        fontSize:
                          11,
                      }}
                    >
                      生徒向けコメント
                    </span>

                    <textarea
                      value={
                        publicAnnotation
                      }
                      onChange={(
                        event
                      ) =>
                        setPublicAnnotation(
                          event.target
                            .value
                        )
                      }
                      rows={
                        3
                      }
                      style={{
                        width:
                          "100%",
                      }}
                      placeholder="生徒へ公開するコメント"
                    />
                  </label>
                </section>

                {/* =================================================
                    Footer
                    ================================================= */}

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
                  <div
                    className="muted"
                    style={{
                      fontSize:
                        11,
                    }}
                  >
                    保存すると一次確認結果として記録されます。
                  </div>

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
   Question row
   ========================================================= */

function QuestionReviewRow({
  result,
  onChange,
}: {
  result: EditableResult;

  onChange: (
    questionId: string,
    patch: Partial<EditableResult>
  ) => void;
}) {
  return (
    <div
      style={{
        padding:
          14,

        marginBottom:
          10,

        border:
          result.changed
            ? "2px solid #333"
            : "1px solid #ddd",

        borderRadius:
          8,

        background:
          "#fff",
      }}
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            12,
        }}
      >
        <div>
          <strong>
            問
            {
              result.questionNumber
            }
          </strong>

          {result.reason && (
            <div
              className="muted"
              style={{
                marginTop:
                  4,

                fontSize:
                  11,
              }}
            >
              {
                result.reason
              }
            </div>
          )}
        </div>

        <span
          style={{
            padding:
              "4px 8px",

            borderRadius:
              999,

            background:
              result.reviewRequired
                ? "#fff4d6"
                : "#e8f5e9",

            fontSize:
              10,
          }}
        >
          {result.reviewRequired
            ? "確認必要"
            : "確認済み"}
        </span>
      </div>

      {/* Answer */}

      <div
        style={{
          marginTop:
            10,

          padding:
            10,

          background:
            "#f7f7f7",

          borderRadius:
            6,

          fontSize:
            12,

          wordBreak:
            "break-word",
        }}
      >
        <span
          className="muted"
          style={{
            fontSize:
              10,
          }}
        >
          答案
        </span>

        <div
          style={{
            marginTop:
              3,
          }}
        >
          {
            result.answerText ||
            "（答案テキストなし）"
          }
        </div>
      </div>

      {/* Editing */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "100px 120px 1fr",

          gap:
            10,

          marginTop:
            10,
        }}
      >
        <label>
          <span
            className="muted"
            style={{
              display:
                "block",

              marginBottom:
                4,

              fontSize:
                10,
            }}
          >
            判定
          </span>

          <select
            value={
              result.mark
            }
            onChange={(
              event
            ) =>
              onChange(
                result.questionId,
                {
                  mark:
                    event.target
                      .value as GradingMark,

                  /*
                   * ○×△を変更したら
                   * 確認済みとして扱う。
                   */
                  reviewRequired:
                    false,
                }
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
        </label>

        <label>
          <span
            className="muted"
            style={{
              display:
                "block",

              marginBottom:
                4,

              fontSize:
                10,
            }}
          >
            得点
          </span>

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
              onChange(
                result.questionId,
                {
                  score:
                    clampScore(
                      Number(
                        event.target
                          .value
                      ),
                      result.maxScore
                    ),

                  reviewRequired:
                    false,
                }
              )
            }
          />
        </label>

        <label>
          <span
            className="muted"
            style={{
              display:
                "block",

              marginBottom:
                4,

              fontSize:
                10,
            }}
          >
            確認理由
          </span>

          <input
            value={
              result.reason ??
              ""
            }
            onChange={(
              event
            ) =>
              onChange(
                result.questionId,
                {
                  reason:
                    event.target
                      .value,
                }
              )
            }
            placeholder="必要に応じて入力"
          />
        </label>
      </div>

      {/* Rubric */}

      {result.rubric && (
        <div
          style={{
            marginTop:
              10,

            fontSize:
              11,

            color:
              "#666",
          }}
        >
          <strong>
            採点基準：
          </strong>

          {
            result.rubric
          }
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Status badge
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
          status ===
            "first_review"
            ? "#fff4d6"
            : "#f1f1f1",

        fontSize:
          10,
      }}
    >
      {status ===
      "first_review"
        ? "一次確認"
        : "採点済み"}
    </span>
  );
}

/* =========================================================
   Build results
   ========================================================= */

function buildEditableResults(
  questions: TestQuestion[],
  existing: GradingResult[]
): EditableResult[] {
  const existingMap =
    new Map<
      string,
      GradingResult
    >();

  existing.forEach(
    (
      result
    ) => {
      existingMap.set(
        result.questionId,
        result
      );
    }
  );

  return questions.map(
    (
      question
    ) => {
      const current =
        existingMap.get(
          question.id
        );

      if (
        current
      ) {
        return {
          ...current,

          maxScore:
            question.maxScore,

          changed:
            false,
        };
      }

      return {
        questionId:
          question.id,

        questionNumber:
          question.questionNumber,

        answerText:
          "",

        mark:
          question.gradingMethod ===
            "automatic"
            ? "×"
            : "△",

        score:
          0,

        maxScore:
          question.maxScore,

        confidence:
          0,

        reviewRequired:
          question.gradingMethod ===
            "manual" ||
          question.requiresReview,

        reason:
          question.gradingMethod ===
          "manual"
            ? "手動採点"
            : "",

        rubric:
          question.rubric,

        changed:
          false,
      };
    }
  );
}

/* =========================================================
   Validation
   ========================================================= */

function validateEditableResults(
  results: EditableResult[],
  questions: TestQuestion[]
) {
  const questionMap =
    new Map<
      string,
      TestQuestion
    >();

  questions.forEach(
    (
      question
    ) => {
      questionMap.set(
        question.id,
        question
      );
    }
  );

  for (
    const result of
      results
  ) {
    const question =
      questionMap.get(
        result.questionId
      );

    if (
      !question
    ) {
      return `問${result.questionNumber}の問題設定が見つかりません。`;
    }

    if (
      !Number.isFinite(
        result.score
      )
    ) {
      return `問${result.questionNumber}の得点が不正です。`;
    }

    if (
      result.score <
        0 ||
      result.score >
        question.maxScore
    ) {
      return `問${result.questionNumber}の得点は0〜${question.maxScore}点です。`;
    }

    /*
     * 手動採点で確認理由が空でも
     * 保存自体は許可。
     *
     * 理由を必須にすると現場で
     * 余計な入力負担になるため。
     */
  }

  return null;
}

/* =========================================================
   Clamp
   ========================================================= */

function clampScore(
  value: number,
  maxScore: number
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  return Math.min(
    Math.max(
      0,
      value
    ),
    maxScore
  );
}

/* =========================================================
   Normalize question
   ========================================================= */

function normalizeQuestion(
  id: string,
  data: Record<
    string,
    unknown
  >
): TestQuestion {
  const method =
    data.gradingMethod ===
    "automatic"
      ? "automatic"
      : "manual";

  return {
    id,

    organizationId:
      stringValue(
        data.organizationId
      ),

    testId:
      stringValue(
        data.testId
      ),

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
      method,

    correctAnswer:
      stringValue(
        data.correctAnswer
      ),

    rubric:
      stringValue(
        data.rubric
      ),

    requiresReview:
      method ===
        "manual"
        ? true
        : data.requiresReview ===
          true,

    order:
      safeNumber(
        data.order
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
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
): ReviewRow {
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
   Status
   ========================================================= */

function normalizeAnswerStatus(
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
   Question order
   ========================================================= */

function questionOrder(
  question: TestQuestion
) {
  if (
    Number.isFinite(
      question.order
    )
  ) {
    return question.order;
  }

  const numeric =
    Number(
      question.questionNumber
    );

  return Number.isFinite(
    numeric
  )
    ? numeric
    : Number.MAX_SAFE_INTEGER;
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
   Empty
   ========================================================= */

function EmptyList() {
  return (
    <div
      style={{
        padding:
          45,

        textAlign:
          "center",

        color:
          "#777",
      }}
    >
      <strong>
        一次確認対象はありません。
      </strong>

      <p
        style={{
          marginTop:
            6,

          fontSize:
            12,
        }}
      >
        自動採点または手動採点が完了すると、ここに表示されます。
      </p>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div
      style={{
        minHeight:
          650,

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        textAlign:
          "center",

        color:
          "#777",
      }}
    >
      <div>
        <strong>
          一次確認する答案を選択してください
        </strong>

        <p
          style={{
            marginTop:
              6,

            fontSize:
              12,
          }}
        >
          左側から答案を選択してください。
        </p>
      </div>
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
      value ??
        0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
