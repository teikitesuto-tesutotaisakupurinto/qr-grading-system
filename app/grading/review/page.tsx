"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  getDocs,
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
  getGradingResult,
  getFirstReview,
  saveFirstReview,
  type GradingResult,
} from "@/lib/grading";

import {
  answersQueries,
  getScopedDocs,
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

/* =========================================================
   Types
   ========================================================= */

type AnswerRecord = {
  id: string;

  testId: string;

  subjectId: string;

  studentId: string | null;

  studentNumber: string;

  fileName: string;

  fileKey: string;

  status: string;

  reviewRequired: boolean;

  totalScore: number;

  totalMaxScore: number;

  createdAt?: unknown;
};

type StudentRecord = {
  id: string;

  name: string;

  studentNumber: string;

  schoolId: string;
};

type TestRecord = {
  id: string;

  name: string;

  testId: string;

  subject: string;
};

type ReviewRow = GradingResult & {
  originalScore: number;

  changed: boolean;
};

/* =========================================================
   Page
   ========================================================= */

export default function GradingReviewPage() {
  const [
    answers,
    setAnswers,
  ] =
    useState<AnswerRecord[]>(
      []
    );

  const [
    students,
    setStudents,
  ] =
    useState<
      Map<
        string,
        StudentRecord
      >
    >(
      new Map()
    );

  const [
    tests,
    setTests,
  ] =
    useState<
      Map<
        string,
        TestRecord
      >
    >(
      new Map()
    );

  const [
    selectedAnswerId,
    setSelectedAnswerId,
  ] =
    useState<
      string | null
    >(
      null
    );

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
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      | "all"
      | "review"
      | "confirmed"
    >(
      "all"
    );

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
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
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

      const appUser =
        await getAppUser(
          auth.currentUser
        );

      if (
        !appUser
      ) {
        throw new Error(
          "ログインしてください。"
        );
      }

      if (
        appUser.role ===
        "生徒"
      ) {
        throw new Error(
          "採点確認は職員のみ利用できます。"
        );
      }

      const scopeUser:
        FirestoreUser =
        {
          uid:
            appUser.uid,

          organizationId:
            appUser.organizationId,

          role:
            appUser.role,

          schoolIds:
            appUser.schoolIds,

          studentId:
            appUser.studentId,
        };

      /*
       * 答案・生徒・テストを
       * 同時取得。
       */
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

      /*
       * 生徒Map
       */
      const studentMap =
        new Map<
          string,
          StudentRecord
        >();

      for (
        const document of
          studentDocuments
      ) {
        const data =
          document.data;

        studentMap.set(
          document.id,
          {
            id:
              document.id,

            name:
              stringValue(
                data.name
              ),

            studentNumber:
              stringValue(
                data.studentNumber
              ),

            schoolId:
              stringValue(
                data.schoolId
              ),
          }
        );
      }

      /*
       * テストMap
       */
      const testMap =
        new Map<
          string,
          TestRecord
        >();

      for (
        const document of
          testDocuments
      ) {
        const data =
          document.data;

        testMap.set(
          document.id,
          {
            id:
              document.id,

            name:
              stringValue(
                data.name
              ),

            testId:
              stringValue(
                data.testId
              ),

            subject:
              stringValue(
                data.subject
              ),
          }
        );
      }

      /*
       * 答案
       */
      const loadedAnswers =
        answerDocuments
          .map(
            (
              document
            ) => {
              const data =
                document.data;

              return {
                id:
                  document.id,

                testId:
                  stringValue(
                    data.testId
                  ),

                subjectId:
                  stringValue(
                    data.subjectId
                  ),

                studentId:
                  typeof data.studentId ===
                  "string"
                    ? data.studentId
                    : null,

                studentNumber:
                  stringValue(
                    data.studentNumber
                  ),

                fileName:
                  stringValue(
                    data.fileName
                  ),

                fileKey:
                  stringValue(
                    data.fileKey
                  ),

                status:
                  stringValue(
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

                createdAt:
                  data.createdAt,
              };
            }
          )
          .filter(
            (
              answer
            ) =>
              isFirstReviewTarget(
                answer
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              String(
                b.createdAt ??
                  ""
              ).localeCompare(
                String(
                  a.createdAt ??
                    ""
                )
              )
          );

      setAnswers(
        loadedAnswers
      );

      setStudents(
        studentMap
      );

      setTests(
        testMap
      );

      /*
       * 選択状態
       */
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
        "grading review load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "採点確認データを取得できませんでした。"
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
     Selected student / test
     ======================================================= */

  const selectedStudent =
    selectedAnswer?.studentId
      ? students.get(
          selectedAnswer.studentId
        )
      : null;

  const selectedTest =
    selectedAnswer
      ? tests.get(
          selectedAnswer.testId
        )
      : null;

  /* =======================================================
     Detail load
     ======================================================= */

  useEffect(() => {
    if (
      !selectedAnswer
    ) {
      setResults([]);
      setInternalNote("");
      setPublicAnnotation("");
      return;
    }

    void loadDetail(
      selectedAnswer
    );
  }, [
    selectedAnswerId,
  ]);

  async function loadDetail(
    answer: AnswerRecord
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
       * 一次確認済みなら一次確認結果を優先。
       * なければ自動採点結果。
       */
      const source =
        firstReview?.results?.length
          ? firstReview.results
          : grading?.results ??
            [];

      const reviewRows =
        source.map(
          (
            result
          ): ReviewRow => ({
            ...result,

            originalScore:
              result.score,

            changed:
              false,
          })
        );

      setResults(
        reviewRows
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
    } catch (
      error
    ) {
      console.error(
        "grading detail error:",
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
     Search/filter
     ======================================================= */

  const filteredAnswers =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return answers.filter(
        (
          answer
        ) => {
          const student =
            answer.studentId
              ? students.get(
                  answer.studentId
                )
              : null;

          const test =
            tests.get(
              answer.testId
            );

          const matchesKeyword =
            !keyword ||
            answer.studentNumber
              .toLowerCase()
              .includes(
                keyword
              ) ||
            (
              student?.name ??
              ""
            )
              .toLowerCase()
              .includes(
                keyword
              ) ||
            (
              test?.name ??
              ""
            )
              .toLowerCase()
              .includes(
                keyword
              );

          const matchesStatus =
            statusFilter ===
            "all"
              ? true
              : statusFilter ===
                "review"
              ? answer.status ===
                  "first_review" ||
                answer.reviewRequired
              : answer.status ===
                "confirmed";

          return (
            matchesKeyword &&
            matchesStatus
          );
        }
      );
    }, [
      answers,
      students,
      tests,
      search,
      statusFilter,
    ]);

  /* =======================================================
     Statistics
     ======================================================= */

  const reviewCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
          "first_review" ||
        answer.reviewRequired
    ).length;

  const confirmedCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "confirmed"
    ).length;

  const changedCount =
    results.filter(
      (
        result
      ) =>
        result.changed
    ).length;

  const currentTotal =
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

  const currentMax =
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

  /* =======================================================
     Score update
     ======================================================= */

  function updateScore(
    index: number,
    value: string
  ) {
    const score =
      Number(
        value
      );

    if (
      !Number.isFinite(
        score
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

            const maxScore =
              Math.max(
                0,
                safeNumber(
                  result.maxScore
                )
              );

            const nextScore =
              Math.min(
                maxScore,
                Math.max(
                  0,
                  score
                )
              );

            return {
              ...result,

              score:
                nextScore,

              changed:
                nextScore !==
                result.originalScore,
            };
          }
        )
    );

    setMessage("");
  }

  /* =======================================================
     Mark update
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
                    true,
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

  async function saveReview() {
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
      setSaving(true);

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
          "採点確認権限がありません。"
        );
      }

      if (
        results.length ===
        0
      ) {
        throw new Error(
          "採点結果がありません。"
        );
      }

      await saveFirstReview({
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

              mark:
                result.mark,

              score:
                safeNumber(
                  result.score
                ),

              maxScore:
                safeNumber(
                  result.maxScore
                ),

              answerText:
                result.answerText,

              confidence:
                safeNumber(
                  result.confidence
                ),

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
      });

      setMessage(
        "一次確認を保存しました。"
      );

      /*
       * 最新状態を再取得。
       */
      await loadPage();
    } catch (
      error
    ) {
      console.error(
        "save first review error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "一次確認を保存できませんでした。"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     Render
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
            採点結果を読み込んでいます...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="content">
        <header
          className="pageHeader"
          style={{
            marginBottom:
              20,
          }}
        >
          <div>
            <h1>
              一次確認
            </h1>

            <p className="muted">
              自動採点結果を確認し、必要な問題だけ採点を修正します。
            </p>
          </div>
        </header>

        {error && (
          <div className="errorMessage">
            {error}
          </div>
        )}

        {message && (
          <div className="successMessage">
            {message}
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
              20,
          }}
        >
          <SummaryCard
            label="確認待ち"
            value={
              reviewCount
            }
          />

          <SummaryCard
            label="確定済み"
            value={
              confirmedCount
            }
          />

          <SummaryCard
            label="現在の得点"
            value={`${currentTotal} / ${currentMax}`}
          />
        </div>

        {/* ==================================================
            Main layout
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
                display:
                  "flex",

                gap:
                  8,

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
                  flex:
                    1,

                  minWidth:
                    0,
                }}
              />

              <select
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
                  setStatusFilter(
                    event
                      .target
                      .value as
                      | "all"
                      | "review"
                      | "confirmed"
                  )
                }
              >
                <option value="all">
                  すべて
                </option>

                <option value="review">
                  確認待ち
                </option>

                <option value="confirmed">
                  確定済み
                </option>
              </select>
            </div>

            <div
              style={{
                maxHeight:
                  "calc(100vh - 250px)",

                overflowY:
                  "auto",
              }}
            >
              {filteredAnswers.length ===
                0 && (
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
                  確認対象の答案がありません。
                </div>
              )}

              {filteredAnswers.map(
                (
                  answer
                ) => {
                  const student =
                    answer.studentId
                      ? students.get(
                          answer.studentId
                        )
                      : null;

                  const test =
                    tests.get(
                      answer.testId
                    );

                  const active =
                    selectedAnswerId ===
                    answer.id;

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

                        padding:
                          14,

                        marginBottom:
                          8,

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
                            10,
                        }}
                      >
                        <strong>
                          {
                            student?.name ??
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
                        style={{
                          marginTop:
                            5,

                          fontSize:
                            12,

                          color:
                            "#666",
                        }}
                      >
                        生徒番号：
                        {
                          answer.studentNumber ||
                          "未登録"
                        }
                      </div>

                      <div
                        style={{
                          marginTop:
                            4,

                          fontSize:
                            12,

                          color:
                            "#666",
                        }}
                      >
                        {
                          test?.name ??
                          "テスト未設定"
                        }
                      </div>

                      <div
                        style={{
                          marginTop:
                            8,

                          fontWeight:
                            700,
                        }}
                      >
                        {
                          answer.totalScore
                        }
                        {" / "}
                        {
                          answer.totalMaxScore
                        }
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </section>

          {/* ================================================
              Detail
              ================================================ */}

          <section className="card">
            {!selectedAnswer ? (
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
                左側から確認する答案を選択してください。
              </div>
            ) : (
              <>
                <header
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    gap:
                      20,

                    alignItems:
                      "flex-start",

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
                        selectedStudent?.name ??
                        "生徒未紐付け"
                      }
                    </h2>

                    <p
                      style={{
                        margin:
                          "6px 0 0",

                        color:
                          "#666",
                      }}
                    >
                      生徒番号：
                      {
                        selectedAnswer.studentNumber ||
                        "未登録"
                      }
                    </p>

                    <p
                      style={{
                        margin:
                          "4px 0 0",

                        color:
                          "#666",
                      }}
                    >
                      {
                        selectedTest?.name ??
                        "テスト未設定"
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
                      style={{
                        fontSize:
                          12,

                        color:
                          "#777",
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
                        currentTotal
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
                          currentMax
                        }
                      </span>
                    </strong>
                  </div>
                </header>

                {detailLoading ? (
                  <div
                    style={{
                      padding:
                        50,

                      textAlign:
                        "center",
                    }}
                  >
                    採点結果を読み込んでいます...
                  </div>
                ) : (
                  <>
                    {/* ======================================
                        Results
                        ====================================== */}

                    <div
                      style={{
                        overflowX:
                          "auto",

                        marginTop:
                          20,
                      }}
                    >
                      {results.length ===
                        0 ? (
                        <div
                          style={{
                            padding:
                              40,

                            textAlign:
                              "center",

                            color:
                              "#777",
                          }}
                        >
                          自動採点結果がありません。
                        </div>
                      ) : (
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
                                自動判定
                              </th>

                              <th>
                                得点
                              </th>

                              <th>
                                確信度
                              </th>

                              <th>
                                変更理由
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {results.map(
                              (
                                result,
                                index
                              ) => (
                                <tr
                                  key={`${result.questionId}-${index}`}
                                >
                                  <td
                                    style={{
                                      whiteSpace:
                                        "nowrap",
                                    }}
                                  >
                                    {
                                      result.questionNumber
                                    }
                                  </td>

                                  <td
                                    style={{
                                      minWidth:
                                        180,
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
                                          5,
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min="0"
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
                                            80,
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
                                      placeholder="必要な場合のみ"
                                      style={{
                                        minWidth:
                                          180,
                                      }}
                                    />
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* ======================================
                        Notes
                        ====================================== */}

                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "1fr 1fr",

                        gap:
                          16,

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
                              7,
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
                              7,
                          }}
                        />
                      </label>
                    </div>

                    {/* ======================================
                        Actions
                        ====================================== */}

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

                        marginTop:
                          20,

                        paddingTop:
                          18,

                        borderTop:
                          "1px solid #eee",
                      }}
                    >
                      <div
                        style={{
                          color:
                            "#666",

                          fontSize:
                            13,
                        }}
                      >
                        {changedCount >
                        0
                          ? `${changedCount}問を変更しています。`
                          : "変更はありません。"}
                      </div>

                      <button
                        type="button"
                        className="primaryButton"
                        disabled={
                          saving ||
                          results.length ===
                            0
                        }
                        onClick={
                          saveReview
                        }
                      >
                        {saving
                          ? "保存中..."
                          : "一次確認を保存"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function isFirstReviewTarget(
  answer: AnswerRecord
) {
  if (
    answer.status ===
    "first_review"
  ) {
    return true;
  }

  if (
    answer.reviewRequired
  ) {
    return true;
  }

  return false;
}

function getStatusLabel(
  status: string
) {
  switch (
    status
  ) {
    case "uploaded":
      return "アップロード済み";

    case "processing":
      return "処理中";

    case "graded":
      return "自動採点済み";

    case "first_review":
      return "一次確認待ち";

    case "second_review":
      return "二次確認";

    case "confirmed":
      return "確定済み";

    case "published":
      return "公開済み";

    case "error":
      return "エラー";

    default:
      return status ||
        "未設定";
  }
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

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}

function formatConfidence(
  value: number
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  /*
   * 0〜1なら割合として表示。
   * 0〜100ならそのまま％。
   */
  const percentage =
    value <= 1
      ? value * 100
      : value;

  return `${percentage.toFixed(
    0
  )}%`;
}

/* =========================================================
   Summary card
   ========================================================= */

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
        style={{
          color:
            "#777",

          fontSize:
            12,
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
            5,

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
