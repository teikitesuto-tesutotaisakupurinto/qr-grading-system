"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  ANSWERS_BUCKET,
  supabase,
} from "@/lib/supabase";

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type CurrentUser = {
  uid: string;
  name: string;
  organizationId: string | null;
  role: UserRole | null;
  schoolIds: string[];
};

type Answer = {
  id: string;
  organizationId: string;
  testId: string;
  testCode: string;
  studentId: string | null;
  studentNumber: string | null;
  schoolId: string;
  storagePath: string;
  status: string;
  gradingStatus: string;
  firstReviewStatus: string;
  secondReviewStatus: string;
  finalized: boolean;
};

type Student = {
  id: string;
  name: string;
  studentNumber: string;
  schoolId: string;
};

type GradingQuestion = {
  questionId: string;
  questionNumber: number;
  answer: string | null;
  correctAnswers: string[];
  points: number;
  score: number;
  method: string;
  result:
    | "正解"
    | "不正解"
    | "部分点"
    | "判定不能"
    | "手動採点";
  confidence: number | null;
  reviewRequired: boolean;
  reason?: string;
};

type GradingResult = {
  answerId: string;
  testId: string;
  studentId: string | null;
  studentNumber: string | null;
  totalScore: number;
  maxScore: number;
  percentage: number;
  reviewStatus: string;
  results: GradingQuestion[];
};

export default function SecondReviewPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(null);

  const [
    answers,
    setAnswers,
  ] = useState<Answer[]>([]);

  const [
    students,
    setStudents,
  ] = useState<Student[]>([]);

  const [
    selectedAnswerId,
    setSelectedAnswerId,
  ] = useState("");

  const [
    gradingResult,
    setGradingResult,
  ] = useState<GradingResult | null>(
    null
  );

  const [
    editedScores,
    setEditedScores,
  ] = useState<Record<string, number>>(
    {}
  );

  const [
    answerImageUrl,
    setAnswerImageUrl,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    reviewComment,
    setReviewComment,
  ] = useState("");

  /*
   * ========================================================
   * 認証
   * ========================================================
   */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          if (!firebaseUser) {
            setLoading(false);

            setError(
              "ログイン状態を確認できません。"
            );

            return;
          }

          try {
            const snapshot =
              await getDocs(
                query(
                  collection(
                    db,
                    "users"
                  ),
                  where(
                    "uid",
                    "==",
                    firebaseUser.uid
                  )
                )
              );

            /*
             * uidフィールドがない既存users構造にも
             * 対応するため、ID検索を追加で行う。
             */
            let userData:
              Record<string, unknown> | null =
              null;

            if (
              !snapshot.empty
            ) {
              userData =
                snapshot.docs[0].data();
            } else {
              const direct =
                await getDoc(
                  doc(
                    db,
                    "users",
                    firebaseUser.uid
                  )
                );

              if (
                direct.exists()
              ) {
                userData =
                  direct.data();
              }
            }

            if (!userData) {
              setLoading(false);

              setError(
                "システムのユーザー情報が登録されていません。"
              );

              return;
            }

            const role =
              isUserRole(
                userData.role
              )
                ? userData.role
                : null;

            setCurrentUser({
              uid:
                firebaseUser.uid,

              name:
                typeof userData.name ===
                "string"
                  ? userData.name
                  : firebaseUser.displayName ??
                    "",

              organizationId:
                typeof userData.organizationId ===
                "string"
                  ? userData.organizationId
                  : null,

              role,

              schoolIds:
                Array.isArray(
                  userData.schoolIds
                )
                  ? userData.schoolIds.filter(
                      (
                        value
                      ): value is string =>
                        typeof value ===
                        "string"
                    )
                  : [],
            });
          } catch (err) {
            console.error(
              err
            );

            setError(
              getSafeErrorMessage(
                err
              )
            );

            setLoading(false);
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /*
   * ========================================================
   * 答案一覧
   * ========================================================
   */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadAnswers(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadAnswers(
    organizationId: string
  ) {
    try {
      setLoading(true);
      setError("");

      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "answers"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            ),
            where(
              "firstReviewStatus",
              "==",
              "確認済み"
            ),
            where(
              "secondReviewStatus",
              "==",
              "未確認"
            )
          )
        );

      const loaded =
        snapshot.docs.map(
          (
            item
          ): Answer => {
            const data =
              item.data();

            return {
              id:
                item.id,

              organizationId,

              testId:
                stringValue(
                  data.testId
                ),

              testCode:
                stringValue(
                  data.testCode
                ),

              studentId:
                nullableString(
                  data.studentId
                ),

              studentNumber:
                nullableString(
                  data.studentNumber
                ),

              schoolId:
                stringValue(
                  data.schoolId
                ),

              storagePath:
                stringValue(
                  data.storagePath
                ),

              status:
                stringValue(
                  data.status
                ),

              gradingStatus:
                stringValue(
                  data.gradingStatus
                ),

              firstReviewStatus:
                stringValue(
                  data.firstReviewStatus
                ),

              secondReviewStatus:
                stringValue(
                  data.secondReviewStatus
                ),

              finalized:
                data.finalized ===
                true,
            };
          }
        );

      const accessible =
        currentUser?.role ===
        "本部管理者"
          ? loaded
          : loaded.filter(
              (
                answer
              ) =>
                currentUser?.schoolIds.includes(
                  answer.schoolId
                )
            );

      setAnswers(
        accessible
      );
    } catch (err) {
      console.error(
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ========================================================
   * 生徒
   * ========================================================
   */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadStudents(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadStudents(
    organizationId: string
  ) {
    try {
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "students"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            )
          )
        );

      setStudents(
        snapshot.docs.map(
          (
            item
          ): Student => {
            const data =
              item.data();

            return {
              id:
                item.id,

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
            };
          }
        )
      );
    } catch (err) {
      console.error(
        err
      );
    }
  }

  /*
   * ========================================================
   * 検索
   * ========================================================
   */

  const filteredAnswers =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return answers;
      }

      return answers.filter(
        (
          answer
        ) => {
          const student =
            students.find(
              (
                item
              ) =>
                item.id ===
                answer.studentId
            );

          return (
            answer.testCode
              .toLowerCase()
              .includes(
                keyword
              ) ||
            (
              answer.studentNumber ??
              ""
            ).includes(
              keyword
            ) ||
            (
              student?.name ??
              ""
            )
              .toLowerCase()
              .includes(
                keyword
              )
          );
        }
      );
    }, [
      answers,
      students,
      search,
    ]);

  /*
   * ========================================================
   * 詳細取得
   * ========================================================
   */

  useEffect(() => {
    if (
      !selectedAnswerId
    ) {
      return;
    }

    void loadDetail(
      selectedAnswerId
    );
  }, [
    selectedAnswerId,
  ]);

  async function loadDetail(
    answerId: string
  ) {
    try {
      setDetailLoading(true);
      setError("");
      setMessage("");

      /*
       * gradingResults/{answerId}
       * を直接取得。
       */

      const gradingDocument =
        await getDoc(
          doc(
            db,
            "gradingResults",
            answerId
          )
        );

      if (
        !gradingDocument.exists()
      ) {
        setGradingResult(
          null
        );

        setEditedScores(
          {}
        );

        setError(
          "この答案の採点結果が見つかりません。"
        );

        return;
      }

      const data =
        gradingDocument.data();

      const rawResults =
        Array.isArray(
          data.results
        )
          ? data.results
          : [];

      const results =
        rawResults.map(
          (
            item: any
          ): GradingQuestion => ({
            questionId:
              stringValue(
                item.questionId
              ),

            questionNumber:
              numberValue(
                item.questionNumber
              ),

            answer:
              nullableString(
                item.answer
              ),

            correctAnswers:
              Array.isArray(
                item.correctAnswers
              )
                ? item.correctAnswers.filter(
                    (
                      value: unknown
                    ): value is string =>
                      typeof value ===
                      "string"
                  )
                : [],

            points:
              numberValue(
                item.points
              ),

            score:
              numberValue(
                item.score
              ),

            method:
              stringValue(
                item.method
              ),

            result:
              isGradingResult(
                item.result
              )
                ? item.result
                : "判定不能",

            confidence:
              typeof item.confidence ===
              "number"
                ? item.confidence
                : null,

            reviewRequired:
              item.reviewRequired ===
              true,

            reason:
              nullableString(
                item.reason
              ) ??
              undefined,
          })
        );

      const result: GradingResult =
        {
          answerId,

          testId:
            stringValue(
              data.testId
            ),

          studentId:
            nullableString(
              data.studentId
            ),

          studentNumber:
            nullableString(
              data.studentNumber
            ),

          totalScore:
            numberValue(
              data.totalScore
            ),

          maxScore:
            numberValue(
              data.maxScore
            ),

          percentage:
            numberValue(
              data.percentage
            ),

          reviewStatus:
            stringValue(
              data.reviewStatus
            ),

          results,
        };

      setGradingResult(
        result
      );

      const scores:
        Record<
          string,
          number
        > = {};

      for (
        const item of
          results
      ) {
        scores[
          item.questionId
        ] =
          item.score;
      }

      setEditedScores(
        scores
      );

      /*
       * 答案画像
       */

      const answer =
        answers.find(
          (
            item
          ) =>
            item.id ===
            answerId
        );

      if (
        answer?.storagePath &&
        supabase
      ) {
        const signed =
          await supabase.storage
            .from(
              ANSWERS_BUCKET
            )
            .createSignedUrl(
              answer.storagePath,
              3600
            );

        if (
          signed.error
        ) {
          console.error(
            signed.error
          );

          setAnswerImageUrl(
            ""
          );
        } else {
          setAnswerImageUrl(
            signed.data
              .signedUrl
          );
        }
      }
    } catch (err) {
      console.error(
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setDetailLoading(
        false
      );
    }
  }

  /*
   * ========================================================
   * 点数変更
   * ========================================================
   */

  function changeScore(
    questionId: string,
    value: string,
    max: number
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

    const score =
      Math.max(
        0,
        Math.min(
          max,
          parsed
        )
      );

    setEditedScores(
      (
        current
      ) => ({
        ...current,

        [questionId]:
          score,
      })
    );
  }

  /*
   * ========================================================
   * 合計
   * ========================================================
   */

  const editedTotal =
    useMemo(() => {
      if (
        !gradingResult
      ) {
        return 0;
      }

      return gradingResult.results.reduce(
        (
          total,
          item
        ) =>
          total +
          (
            editedScores[
              item.questionId
            ] ??
            item.score
          ),
        0
      );
    }, [
      gradingResult,
      editedScores,
    ]);

  /*
   * ========================================================
   * 最終確定
   * ========================================================
   */

  async function finalizeAnswer() {
    if (
      saving
    ) {
      return;
    }

    if (
      !currentUser
    ) {
      return;
    }

    if (
      !selectedAnswerId ||
      !gradingResult
    ) {
      setError(
        "確定する答案を選択してください。"
      );

      return;
    }

    const answer =
      answers.find(
        (
          item
        ) =>
          item.id ===
          selectedAnswerId
      );

    if (
      !answer
    ) {
      setError(
        "答案情報を確認できません。"
      );

      return;
    }

    /*
     * 自分自身が一次確認者の場合、
     * 二次確認を兼任させない。
     *
     * firstReviewedByがある場合は
     *そのUIDを取得する。
     */

    try {
      setSaving(true);

      setError("");
      setMessage("");

      /*
       * 採点結果を更新
       */

      await updateDoc(
        doc(
          db,
          "gradingResults",
          selectedAnswerId
        ),
        {
          totalScore:
            editedTotal,

          percentage:
            gradingResult.maxScore >
            0
              ? (
                  editedTotal /
                  gradingResult.maxScore
                ) *
                100
              : 0,

          results:
            gradingResult.results.map(
              (
                item
              ) => ({
                ...item,

                score:
                  editedScores[
                    item.questionId
                  ] ??
                  item.score,
              })
            ),

          reviewStatus:
            "確定",

          finalizedBy:
            currentUser.uid,

          finalizedByName:
            currentUser.name,

          finalizedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * 答案を確定
       */

      await updateDoc(
        doc(
          db,
          "answers",
          selectedAnswerId
        ),
        {
          status:
            "確定",

          gradingStatus:
            "確定",

          secondReviewStatus:
            "確認済み",

          finalized:
            true,

          finalizedBy:
            currentUser.uid,

          finalizedByName:
            currentUser.name,

          finalizedAt:
            serverTimestamp(),

          secondReviewComment:
            reviewComment.trim() ||
            null,

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * 履歴
       */

      await addReviewLog(
        selectedAnswerId,
        currentUser.uid,
        currentUser.name,
        reviewComment
      );

      setMessage(
        "答案を確定しました。"
      );

      setReviewComment("");

      setSelectedAnswerId("");

      setGradingResult(
        null
      );

      setAnswerImageUrl(
        ""
      );

      if (
        currentUser.organizationId
      ) {
        await loadAnswers(
          currentUser.organizationId
        );
      }
    } catch (err) {
      console.error(
        "Finalization error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================================
   * 権限
   * ========================================================
   */

  if (
    currentUser &&
    currentUser.role !==
      "本部管理者" &&
    currentUser.role !==
      "校舎管理者" &&
    currentUser.role !==
      "講師"
  ) {
    return (
      <main
        style={
          pageStyle
        }
      >
        <section
          style={
            cardStyle
          }
        >
          <h1>
            二次確認
          </h1>

          <p>
            この機能を利用する権限がありません。
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      style={
        pageStyle
      }
    >
      <div
        style={{
          maxWidth:
            1500,

          margin:
            "0 auto",
        }}
      >
        <header
          style={{
            marginBottom:
              24,
          }}
        >
          <h1
            style={{
              margin:
                "0 0 8px",
            }}
          >
            採点二次確認
          </h1>

          <p
            style={{
              margin: 0,

              color:
                "#666",

              lineHeight:
                1.7,
            }}
          >
            一次確認済みの答案を最終確認し、確定します。
          </p>
        </header>

        {error && (
          <Message
            type="error"
            message={error}
          />
        )}

        {message && (
          <Message
            type="success"
            message={message}
          />
        )}

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
          {/* ==================================================
              一覧
              ================================================== */}

          <section
            style={
              cardStyle
            }
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
              <h2
                style={{
                  margin:
                    0,

                  fontSize:
                    18,
                }}
              >
                二次確認待ち
              </h2>

              <span
                style={{
                  color:
                    "#777",

                  fontSize:
                    12,
                }}
              >
                {
                  filteredAnswers.length
                }
                件
              </span>
            </div>

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
              placeholder="テストID・生徒番号・氏名"
              style={
                inputStyle
              }
            />

            <div
              style={{
                marginTop:
                  16,

                display:
                  "flex",

                flexDirection:
                  "column",

                gap:
                  8,

                maxHeight:
                  "calc(100vh - 280px)",

                overflowY:
                  "auto",
              }}
            >
              {loading ? (
                <p>
                  読み込み中...
                </p>
              ) : filteredAnswers.length ===
                0 ? (
                <div
                  style={{
                    padding:
                      30,

                    textAlign:
                      "center",

                    color:
                      "#777",

                    fontSize:
                      13,
                  }}
                >
                  二次確認待ちの答案はありません。
                </div>
              ) : (
                filteredAnswers.map(
                  (
                    answer
                  ) => {
                    const student =
                      students.find(
                        (
                          item
                        ) =>
                          item.id ===
                          answer.studentId
                      );

                    const selected =
                      answer.id ===
                      selectedAnswerId;

                    return (
                      <button
                        type="button"
                        key={
                          answer.id
                        }
                        onClick={() =>
                          setSelectedAnswerId(
                            answer.id
                          )
                        }
                        style={{
                          textAlign:
                            "left",

                          padding:
                            14,

                          border:
                            selected
                              ? "2px solid #111"
                              : "1px solid #ddd",

                          borderRadius:
                            9,

                          background:
                            selected
                              ? "#f7f7f7"
                              : "#fff",

                          cursor:
                            "pointer",
                        }}
                      >
                        <strong>
                          {
                            answer.testCode
                          }
                        </strong>

                        <div
                          style={{
                            marginTop:
                              5,

                            fontSize:
                              13,
                          }}
                        >
                          {student?.name ??
                            "生徒未特定"}
                        </div>

                        <div
                          style={{
                            marginTop:
                              3,

                            color:
                              "#777",

                            fontSize:
                              11,
                          }}
                        >
                          生徒番号：
                          {
                            answer.studentNumber ??
                            "—"
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              8,

                            color:
                              "#777",

                            fontSize:
                              11,
                          }}
                        >
                          一次確認済み
                        </div>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </section>

          {/* ==================================================
              詳細
              ================================================== */}

          <section
            style={
              cardStyle
            }
          >
            {!selectedAnswerId ? (
              <div
                style={{
                  padding:
                    70,

                  textAlign:
                    "center",

                  color:
                    "#777",
                }}
              >
                左側から答案を選択してください。
              </div>
            ) : detailLoading ? (
              <div
                style={{
                  padding:
                    70,

                  textAlign:
                    "center",
                }}
              >
                答案を読み込んでいます...
              </div>
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
                      最終確認
                    </h2>

                    {gradingResult && (
                      <p
                        style={{
                          margin:
                            "7px 0 0",

                          color:
                            "#666",
                        }}
                      >
                        合計：
                        <strong>
                          {
                            editedTotal
                          }
                        </strong>
                        {" / "}
                        {
                          gradingResult.maxScore
                        }
                        点
                      </p>
                    )}
                  </div>

                  <span
                    style={{
                      padding:
                        "7px 12px",

                      borderRadius:
                        999,

                      background:
                        "#f3f3f3",

                      fontSize:
                        12,

                      fontWeight:
                        600,
                    }}
                  >
                    二次確認
                  </span>
                </div>

                {/* ==========================================
                    答案画像
                    ========================================== */}

                {answerImageUrl && (
                  <section
                    style={{
                      marginBottom:
                        24,
                    }}
                  >
                    <h3>
                      答案画像
                    </h3>

                    <div
                      style={{
                        maxHeight:
                          700,

                        overflow:
                          "auto",

                        padding:
                          10,

                        border:
                          "1px solid #ddd",

                        borderRadius:
                          10,

                        background:
                          "#f7f7f7",
                      }}
                    >
                      <img
                        src={
                          answerImageUrl
                        }
                        alt="答案"
                        style={{
                          display:
                            "block",

                          maxWidth:
                            "100%",

                          margin:
                            "0 auto",
                        }}
                      />
                    </div>
                  </section>
                )}

                {/* ==========================================
                    採点
                    ========================================== */}

                {gradingResult && (
                  <section
                    style={{
                      marginBottom:
                        24,
                    }}
                  >
                    <h3>
                      採点結果
                    </h3>

                    <div
                      style={{
                        overflowX:
                          "auto",
                      }}
                    >
                      <table
                        style={
                          tableStyle
                        }
                      >
                        <thead>
                          <tr>
                            <th
                              style={
                                thStyle
                              }
                            >
                              問題
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              回答
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              判定
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              得点
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              確信度
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {gradingResult.results.map(
                            (
                              item
                            ) => (
                              <tr
                                key={
                                  item.questionId
                                }
                              >
                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  {
                                    item.questionNumber
                                  }
                                </td>

                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  {
                                    item.answer ??
                                    "—"
                                  }
                                </td>

                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  {
                                    item.result
                                  }
                                </td>

                                <td
                                  style={
                                    tdStyle
                                  }
                                >
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
                                        item.points
                                      }
                                      step="0.1"
                                      value={
                                        editedScores[
                                          item.questionId
                                        ] ??
                                        item.score
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        changeScore(
                                          item.questionId,
                                          event
                                            .target
                                            .value,
                                          item.points
                                        )
                                      }
                                      style={
                                        scoreInputStyle
                                      }
                                    />

                                    <span>
                                      /
                                      {
                                        item.points
                                      }
                                    </span>
                                  </div>
                                </td>

                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  {item.confidence ===
                                  null
                                    ? "—"
                                    : `${Math.round(
                                        item.confidence *
                                          100
                                      )}%`}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* ==========================================
                    コメント
                    ========================================== */}

                <label
                  style={{
                    display:
                      "block",

                    marginBottom:
                      20,

                    fontWeight:
                      600,
                  }}
                >
                  二次確認コメント

                  <textarea
                    value={
                      reviewComment
                    }
                    onChange={(
                      event
                    ) =>
                      setReviewComment(
                        event.target
                          .value
                      )
                    }
                    rows={
                      4
                    }
                    placeholder="確認内容や修正理由を記録できます。"
                    style={
                      textareaStyle
                    }
                  />
                </label>

                {/* ==========================================
                    確定
                    ========================================== */}

                <div
                  style={{
                    padding:
                      16,

                    marginBottom:
                      16,

                    background:
                      "#f7f7f7",

                    borderRadius:
                      8,

                    fontSize:
                      13,

                    lineHeight:
                      1.7,
                  }}
                >
                  <strong>
                    最終確定
                  </strong>

                  <p
                    style={{
                      margin:
                        "6px 0 0",

                      color:
                        "#666",
                    }}
                  >
                    この操作を行うと答案は「確定」になり、
                    通常の採点フローから変更できない状態になります。
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    saving ||
                    !gradingResult
                  }
                  onClick={
                    finalizeAnswer
                  }
                  style={{
                    ...primaryButton,

                    opacity:
                      saving ||
                      !gradingResult
                        ? 0.5
                        : 1,
                  }}
                >
                  {saving
                    ? "確定中..."
                    : "採点を最終確定する"}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* =========================================================
   Review log
   ========================================================= */

async function addReviewLog(
  answerId: string,
  uid: string,
  userName: string,
  comment: string
) {
  try {
    const { addDoc } =
      await import(
        "firebase/firestore"
      );

    await addDoc(
      collection(
        db,
        "systemLogs"
      ),
      {
        type:
          "grading_second_review",

        answerId,

        userId:
          uid,

        userName,

        comment:
          comment.trim() ||
          null,

        createdAt:
          serverTimestamp(),
      }
    );
  } catch (error) {
    /*
     * 履歴保存に失敗しても
     * コンソールには記録する。
     *
     * ただし画面にはFirebase生エラーを
     * 表示しない。
     */
    console.error(
      "Review log error:",
      error
    );

    throw new Error(
      "確認履歴を保存できませんでした。"
    );
  }
}

/* =========================================================
   Helpers
   ========================================================= */

function isUserRole(
  value: unknown
): value is UserRole {
  return (
    value ===
      "本部管理者" ||
    value ===
      "校舎管理者" ||
    value ===
      "講師" ||
    value ===
      "生徒"
  );
}

function isGradingResult(
  value: unknown
): value is GradingQuestion["result"] {
  return (
    value ===
      "正解" ||
    value ===
      "不正解" ||
    value ===
      "部分点" ||
    value ===
      "判定不能" ||
    value ===
      "手動採点"
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

function nullableString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : null;
}

function numberValue(
  value: unknown
) {
  return typeof value ===
    "number"
    ? value
    : 0;
}

function getSafeErrorMessage(
  error: unknown
) {
  const value =
    error as {
      code?: string;
    };

  switch (
    value?.code
  ) {
    case "permission-denied":
      return "この操作を行う権限がありません。";

    case "unauthenticated":
      return "ログイン状態を確認できません。";

    case "not-found":
      return "指定された答案が見つかりません。";

    case "failed-precondition":
      return "現在この操作を実行できません。";

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからお試しください。";

    case "storage/unauthorized":
      return "答案画像を表示する権限がありません。";

    default:
      return error instanceof Error
        ? error.message
        : "二次確認処理に失敗しました。";
  }
}

/* =========================================================
   Styles
   ========================================================= */

const pageStyle:
  React.CSSProperties = {
    minHeight:
      "100vh",

    padding:
      32,

    background:
      "#f5f6f8",
  };

const cardStyle:
  React.CSSProperties = {
    padding:
      24,

    background:
      "#fff",

    border:
      "1px solid #e1e4e8",

    borderRadius:
      12,
  };

const inputStyle:
  React.CSSProperties = {
    display:
      "block",

    width:
      "100%",

    marginTop:
      10,

    padding:
      "10px 12px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",
  };

const textareaStyle:
  React.CSSProperties = {
    display:
      "block",

    width:
      "100%",

    marginTop:
      8,

    padding:
      12,

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    resize:
      "vertical",

    fontFamily:
      "inherit",
  };

const primaryButton:
  React.CSSProperties = {
    width:
      "100%",

    padding:
      "13px 20px",

    border:
      "none",

    borderRadius:
      8,

    background:
      "#111",

    color:
      "#fff",

    fontWeight:
      600,

    cursor:
      "pointer",
  };

const scoreInputStyle:
  React.CSSProperties = {
    width:
      75,

    padding:
      "7px 8px",

    border:
      "1px solid #ccc",

    borderRadius:
      6,

    textAlign:
      "right",
  };

const tableStyle:
  React.CSSProperties = {
    width:
      "100%",

    borderCollapse:
      "collapse",
  };

const thStyle:
  React.CSSProperties = {
    padding:
      "11px 10px",

    textAlign:
      "left",

    borderBottom:
      "2px solid #ddd",

    whiteSpace:
      "nowrap",

    fontSize:
      12,
  };

const tdStyle:
  React.CSSProperties = {
    padding:
      "11px 10px",

    borderBottom:
      "1px solid #eee",

    fontSize:
      13,

    verticalAlign:
      "top",
  };

const errorStyle:
  React.CSSProperties = {
    marginBottom:
      16,

    padding:
      14,

    border:
      "1px solid #efb5b5",

    borderRadius:
      8,

    background:
      "#fff4f4",

    color:
      "#9b1c1c",

    lineHeight:
      1.6,
  };

const successStyle:
  React.CSSProperties = {
    marginBottom:
      16,

    padding:
      14,

    border:
      "1px solid #b8d9c0",

    borderRadius:
      8,

    background:
      "#f2faf4",

    color:
      "#25633a",

    lineHeight:
      1.6,
  };

function Message({
  type,
  message,
}: {
  type:
    | "error"
    | "success";

  message: string;
}) {
  return (
    <div
      style={
        type ===
        "error"
          ? errorStyle
          : successStyle
      }
    >
      {message}
    </div>
  );
}
