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
} from "@/lib/firestore-scope";

type AnswerItem = {
  id: string;

  testId: string;

  studentId: string | null;

  studentNumber: string;

  status: string;

  totalScore: number;

  totalMaxScore: number;

  reviewRequired: boolean;

  fileName: string;

  testName: string;

  studentName: string;
};

export default function GradingReviewPage() {
  const [
    items,
    setItems,
  ] =
    useState<AnswerItem[]>(
      []
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<string | null>(
      null
    );

  const [
    results,
    setResults,
  ] =
    useState<GradingResult[]>(
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
     Load
     ======================================================= */

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      setError("");

      const user =
        await getAppUser();

      if (
        !user
      ) {
        setError(
          "ログインしてください。"
        );

        return;
      }

      if (
        user.role ===
        "生徒"
      ) {
        setError(
          "採点確認は職員のみ利用できます。"
        );

        return;
      }

      const firestoreUser =
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
              firestoreUser
            )
          ),

          getScopedDocs(
            studentsQueries(
              firestoreUser
            )
          ),

          getScopedDocs(
            testsQueries(
              firestoreUser
            )
          ),
        ]);

      const studentMap =
        new Map<
          string,
          {
            name: string;
            studentNumber: string;
          }
        >();

      for (
        const item of
          studentDocuments
      ) {
        studentMap.set(
          item.id,
          {
            name:
              stringValue(
                item.data.name
              ),

            studentNumber:
              stringValue(
                item.data
                  .studentNumber
              ),
          }
        );
      }

      const testMap =
        new Map<
          string,
          string
        >();

      for (
        const item of
          testDocuments
      ) {
        testMap.set(
          item.id,
          stringValue(
            item.data.name
          )
        );
      }

      const loaded: AnswerItem[] =
        answerDocuments
          .map(
            (
              item
            ) => {
              const data =
                item.data;

              const student =
                data.studentId
                  ? studentMap.get(
                      String(
                        data.studentId
                      )
                    )
                  : undefined;

              const status =
                stringValue(
                  data.status
                );

              const gradingStatus =
                stringValue(
                  data.gradingStatus
                );

              const reviewRequired =
                data.reviewRequired ===
                true;

              const shouldShow =
                reviewRequired ||
                status ===
                  "first_review" ||
                gradingStatus ===
                  "first_review";

              if (
                !shouldShow
              ) {
                return null;
              }

              return {
                id:
                  item.id,

                testId:
                  stringValue(
                    data.testId
                  ),

                studentId:
                  typeof data.studentId ===
                  "string"
                    ? data.studentId
                    : null,

                studentNumber:
                  stringValue(
                    data.studentNumber
                  ) ||
                  student
                    ?.studentNumber ||
                  "",

                status,

                totalScore:
                  numberValue(
                    data.totalScore
                  ),

                totalMaxScore:
                  numberValue(
                    data.totalMaxScore
                  ),

                reviewRequired,

                fileName:
                  stringValue(
                    data.fileName
                  ),

                testName:
                  testMap.get(
                    String(
                      data.testId
                    )
                  ) ??
                  "テスト",

                studentName:
                  student?.name ??
                  "未紐付け",
              };
            }
          )
          .filter(
            (
              item
            ): item is AnswerItem =>
              item !== null
          );

      setItems(
        loaded
      );

      if (
        loaded.length >
        0
      ) {
        setSelectedId(
          loaded[0].id
        );
      }
    } catch (
      err
    ) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "答案を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Selected answer
     ======================================================= */

  const selected =
    items.find(
      (
        item
      ) =>
        item.id ===
        selectedId
    ) ??
    null;

  /* =======================================================
     Load grading result
     ======================================================= */

  useEffect(() => {
    if (
      !selectedId
    ) {
      setResults([]);
      return;
    }

    void loadGrading(
      selectedId
    );
  }, [
    selectedId,
  ]);

  async function loadGrading(
    answerId: string
  ) {
    try {
      setError("");

      const [
        grading,
        review,
      ] =
        await Promise.all([
          getGradingResult(
            answerId
          ),

          getFirstReview(
            answerId
          ),
        ]);

      const gradingResults =
        Array.isArray(
          grading?.results
        )
          ? grading.results
          : [];

      const reviewResults =
        Array.isArray(
          review?.results
        )
          ? review.results
          : [];

      const nextResults =
        reviewResults.length >
        0
          ? reviewResults
          : gradingResults;

      setResults(
        nextResults as GradingResult[]
      );

      setInternalNote(
        review?.internalNote ??
          ""
      );

      setPublicAnnotation(
        review?.publicAnnotation ??
          ""
      );
    } catch (
      err
    ) {
      console.error(
        err
      );

      setError(
        "採点結果を取得できませんでした。"
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
        return items;
      }

      return items.filter(
        (
          item
        ) =>
          item.studentNumber.includes(
            keyword
          ) ||
          item.studentName
            .toLowerCase()
            .includes(
              keyword
            ) ||
          item.testName
            .toLowerCase()
            .includes(
              keyword
            )
      );
    }, [
      items,
      search,
    ]);

  /* =======================================================
     Change score
     ======================================================= */

  function changeScore(
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
            item,
            itemIndex
          ) =>
            itemIndex ===
            index
              ? {
                  ...item,

                  score:
                    Math.min(
                      Math.max(
                        score,
                        0
                      ),
                      item.maxScore
                    ),

                  mark:
                    score ===
                    0
                      ? "×"
                      : score <
                          item.maxScore
                        ? "△"
                        : "○",
                }
              : item
        )
    );
  }

  /* =======================================================
     Reason
     ======================================================= */

  function changeReason(
    index: number,
    value: string
  ) {
    setResults(
      (
        current
      ) =>
        current.map(
          (
            item,
            itemIndex
          ) =>
            itemIndex ===
            index
              ? {
                  ...item,

                  reason:
                    value,
                }
              : item
        )
    );
  }

  /* =======================================================
     Save
     ======================================================= */

  async function saveReview() {
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

      await saveFirstReview({
        answerId:
          selected.id,

        testId:
          selected.testId,

        subjectId:
          "",

        studentNumber:
          selected.studentNumber,

        reviewerId:
          user.uid,

        results,

        internalNote,

        publicAnnotation,
      });

      setMessage(
        "一次確認を保存しました。"
      );

      await load();
    } catch (
      err
    ) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
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
        <header className="pageHeader">
          <div>
            <h1>
              一次確認
            </h1>

            <p>
              自動採点結果を確認し、必要な採点修正を行います。
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

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "360px minmax(0, 1fr)",

            gap:
              20,
          }}
        >
          {/* ================================================
              Answer list
              ================================================ */}

          <section className="listCard">
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

                padding:
                  10,

                marginBottom:
                  12,
              }}
            />

            {filtered.length ===
              0 && (
              <p>
                確認対象の答案はありません。
              </p>
            )}

            {filtered.map(
              (
                item
              ) => (
                <button
                  key={
                    item.id
                  }
                  type="button"
                  onClick={() =>
                    setSelectedId(
                      item.id
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
                      selectedId ===
                      item.id
                        ? "2px solid #111"
                        : "1px solid #ddd",

                    borderRadius:
                      8,

                    background:
                      "#fff",

                    cursor:
                      "pointer",
                  }}
                >
                  <strong>
                    {
                      item.studentName
                    }
                  </strong>

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
                      item.studentNumber
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        4,

                      fontSize:
                        12,
                    }}
                  >
                    {
                      item.testName
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
                      item.totalScore
                    }
                    {" / "}
                    {
                      item.totalMaxScore
                    }
                  </div>
                </button>
              )
            )}
          </section>

          {/* ================================================
              Review
              ================================================ */}

          <section className="stepCard">
            {!selected ? (
              <p>
                確認する答案を選択してください。
              </p>
            ) : (
              <>
                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "center",

                    marginBottom:
                      20,
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
                        selected.studentName
                      }
                    </h2>

                    <p
                      style={{
                        margin:
                          "5px 0 0",

                        color:
                          "#666",
                      }}
                    >
                      {
                        selected.testName
                      }
                      {" / "}
                      {
                        selected.studentNumber
                      }
                    </p>
                  </div>

                  <strong>
                    {
                      selected.totalScore
                    }
                    {" / "}
                    {
                      selected.totalMaxScore
                    }
                  </strong>
                </div>

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
                          答え
                        </th>

                        <th>
                          自動採点
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
                        ) => (
                          <tr
                            key={`${result.questionId}-${index}`}
                          >
                            <td>
                              {
                                result.questionNumber
                              }
                            </td>

                            <td>
                              {
                                result.answerText ||
                                "—"
                              }
                            </td>

                            <td>
                              {result.mark}
                            </td>

                            <td>
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
                                  changeScore(
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
                              {" / "}
                              {
                                result.maxScore
                              }
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
                                  changeReason(
                                    index,
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="確認理由"
                              />
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    marginTop:
                      20,
                  }}
                >
                  <label>
                    内部メモ

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
                      rows={4}
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
                </div>

                <div
                  style={{
                    marginTop:
                      16,
                  }}
                >
                  <label>
                    生徒公開コメント

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
                      rows={4}
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
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "flex-end",

                    marginTop:
                      20,
                  }}
                >
                  <button
                    type="button"
                    className="primaryButton"
                    disabled={
                      saving
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
          </section>
        </div>
      </section>
    </main>
  );
}

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}

function numberValue(
  value: unknown
) {
  return typeof value ===
    "number"
    ? value
    : Number(
        value ?? 0
      );
}
