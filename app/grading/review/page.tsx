"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

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
  qrStatus: string;
  ocrStatus: string;
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

type OCRBlock = {
  blockIndex: number;
  text: string;
  confidence: number | null;
};

type OCRResult = {
  answerId: string;
  fullText: string;
  blocks: OCRBlock[];
};

export default function GradingReviewPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(
    null
  );

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
    ocrResult,
    setOcrResult,
  ] = useState<OCRResult | null>(
    null
  );

  const [
    answerImageUrl,
    setAnswerImageUrl,
  ] = useState("");

  const [
    editedScores,
    setEditedScores,
  ] = useState<Record<
    string,
    number
  >>({});

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
    search,
    setSearch,
  ] = useState("");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState(
    "一次確認待ち"
  );

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
                    "__name__",
                    "==",
                    firebaseUser.uid
                  )
                )
              );

            if (
              snapshot.empty
            ) {
              setLoading(false);

              setError(
                "システムのユーザー情報が登録されていません。"
              );

              return;
            }

            const data =
              snapshot.docs[0].data();

            const role =
              isUserRole(
                data.role
              )
                ? data.role
                : null;

            setCurrentUser({
              uid:
                firebaseUser.uid,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : firebaseUser.displayName ??
                    "",

              organizationId:
                typeof data.organizationId ===
                "string"
                  ? data.organizationId
                  : null,

              role,

              schoolIds:
                Array.isArray(
                  data.schoolIds
                )
                  ? data.schoolIds.filter(
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
              "Review authentication error:",
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
    selectedStatus,
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
              selectedStatus
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
                typeof data.testId ===
                "string"
                  ? data.testId
                  : "",

              testCode:
                typeof data.testCode ===
                "string"
                  ? data.testCode
                  : "",

              studentId:
                typeof data.studentId ===
                "string"
                  ? data.studentId
                  : null,

              studentNumber:
                typeof data.studentNumber ===
                "string"
                  ? data.studentNumber
                  : null,

              schoolId:
                typeof data.schoolId ===
                "string"
                  ? data.schoolId
                  : "",

              storagePath:
                typeof data.storagePath ===
                "string"
                  ? data.storagePath
                  : "",

              status:
                typeof data.status ===
                "string"
                  ? data.status
                  : "",

              qrStatus:
                typeof data.qrStatus ===
                "string"
                  ? data.qrStatus
                  : "",

              ocrStatus:
                typeof data.ocrStatus ===
                "string"
                  ? data.ocrStatus
                  : "",

              gradingStatus:
                typeof data.gradingStatus ===
                "string"
                  ? data.gradingStatus
                  : "",

              firstReviewStatus:
                typeof data.firstReviewStatus ===
                "string"
                  ? data.firstReviewStatus
                  : "",

              secondReviewStatus:
                typeof data.secondReviewStatus ===
                "string"
                  ? data.secondReviewStatus
                  : "",

              finalized:
                data.finalized ===
                true,
            };
          }
        );

      setAnswers(
        loaded
      );
    } catch (err) {
      console.error(
        "Answer loading error:",
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
   * 生徒情報
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

      const loaded =
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
                typeof data.name ===
                "string"
                  ? data.name
                  : "",

              studentNumber:
                typeof data.studentNumber ===
                "string"
                  ? data.studentNumber
                  : "",

              schoolId:
                typeof data.schoolId ===
                "string"
                  ? data.schoolId
                  : "",
            };
          }
        );

      setStudents(
        loaded
      );
    } catch (err) {
      console.error(
        "Student loading error:",
        err
      );
    }
  }

  /*
   * ========================================================
   * 絞り込み
   * ========================================================
   */

  const filteredAnswers =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      let result =
        answers;

      if (
        currentUser?.role !==
        "本部管理者"
      ) {
        result =
          result.filter(
            (
              answer
            ) =>
              currentUser?.schoolIds.includes(
                answer.schoolId
              )
          );
      }

      if (
        keyword
      ) {
        result =
          result.filter(
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
      }

      return result;
    }, [
      answers,
      students,
      currentUser,
      search,
    ]);

  /*
   * ========================================================
   * 答案詳細取得
   * ========================================================
   */

  useEffect(() => {
    if (
      !selectedAnswerId
    ) {
      return;
    }

    void loadAnswerDetail(
      selectedAnswerId
    );
  }, [
    selectedAnswerId,
  ]);

  async function loadAnswerDetail(
    answerId: string
  ) {
    try {
      setDetailLoading(
        true
      );

      setError("");

      setMessage("");

      /*
       * 採点結果
       */

      const gradingSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "gradingResults"
            ),
            where(
              "__name__",
              "==",
              answerId
            )
          )
        );

      if (
        !gradingSnapshot.empty
      ) {
        const data =
          gradingSnapshot.docs[0].data();

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
                typeof item.questionId ===
                "string"
                  ? item.questionId
                  : "",

              questionNumber:
                typeof item.questionNumber ===
                "number"
                  ? item.questionNumber
                  : 0,

              answer:
                typeof item.answer ===
                "string"
                  ? item.answer
                  : null,

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
                typeof item.points ===
                "number"
                  ? item.points
                  : 0,

              score:
                typeof item.score ===
                "number"
                  ? item.score
                  : 0,

              method:
                typeof item.method ===
                "string"
                  ? item.method
                  : "",

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
                typeof item.reason ===
                "string"
                  ? item.reason
                  : undefined,
            })
          );

        const loadedResult: GradingResult =
          {
            answerId,

            testId:
              typeof data.testId ===
              "string"
                ? data.testId
                : "",

            studentId:
              typeof data.studentId ===
              "string"
                ? data.studentId
                : null,

            studentNumber:
              typeof data.studentNumber ===
              "string"
                ? data.studentNumber
                : null,

            totalScore:
              typeof data.totalScore ===
              "number"
                ? data.totalScore
                : 0,

            maxScore:
              typeof data.maxScore ===
              "number"
                ? data.maxScore
                : 0,

            percentage:
              typeof data.percentage ===
              "number"
                ? data.percentage
                : 0,

            reviewStatus:
              typeof data.reviewStatus ===
              "string"
                ? data.reviewStatus
                : "",

            results,
          };

        setGradingResult(
          loadedResult
        );

        const initialScores: Record<
          string,
          number
        > = {};

        for (
          const result of
            results
        ) {
          initialScores[
            result.questionId
          ] =
            result.score;
        }

        setEditedScores(
          initialScores
        );
      } else {
        setGradingResult(
          null
        );

        setEditedScores(
          {}
        );
      }

      /*
       * OCR結果
       */

      const ocrSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "answerOcrResults"
            ),
            where(
              "__name__",
              "==",
              answerId
            )
          )
        );

      if (
        !ocrSnapshot.empty
      ) {
        const data =
          ocrSnapshot.docs[0].data();

        setOcrResult({
          answerId,

          fullText:
            typeof data.fullText ===
            "string"
              ? data.fullText
              : "",

          blocks:
            Array.isArray(
              data.blocks
            )
              ? data.blocks
              : [],
        });
      } else {
        setOcrResult(
          null
        );
      }

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
              60 * 60
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
      } else {
        setAnswerImageUrl(
          ""
        );
      }
    } catch (err) {
      console.error(
        "Review detail error:",
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
    const number =
      Number(
        value
      );

    if (
      !Number.isFinite(
        number
      )
    ) {
      return;
    }

    const safe =
      Math.max(
        0,
        Math.min(
          max,
          number
        )
      );

    setEditedScores(
      (
        current
      ) => ({
        ...current,

        [questionId]:
          safe,
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
          result
        ) =>
          total +
          (
            editedScores[
              result.questionId
            ] ??
            result.score
          ),
        0
      );
    }, [
      gradingResult,
      editedScores,
    ]);

  /*
   * ========================================================
   * 一次確認完了
   * ========================================================
   */

  async function completeFirstReview() {
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
        "確認する答案を選択してください。"
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

    try {
      setSaving(true);

      setError("");

      setMessage("");

      /*
       * 変更された問題を取得。
       */

      const changes =
        gradingResult.results
          .map(
            (
              result
            ) => {
              const oldScore =
                result.score;

              const newScore =
                editedScores[
                  result.questionId
                ] ??
                oldScore;

              if (
                oldScore ===
                newScore
              ) {
                return null;
              }

              return {
                questionId:
                  result.questionId,

                questionNumber:
                  result.questionNumber,

                before:
                  oldScore,

                after:
                  newScore,

                reason:
                  reviewComment.trim() ||
                  "一次確認による採点修正",
              };
            }
          )
          .filter(
            Boolean
          );

      /*
       * gradingResults更新
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
                result
              ) => ({
                ...result,

                score:
                  editedScores[
                    result.questionId
                  ] ??
                  result.score,
              })
            ),

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * 変更履歴
       */

      if (
        changes.length >
        0
      ) {
        await addReviewLog(
          selectedAnswerId,
          currentUser.uid,
          currentUser.name,
          changes
        );
      }

      /*
       * Answers状態
       *
       * 二次確認必須なら
       * 二次確認待ち。
       *
       * それ以外なら
       * 確定可能。
       */

      await updateDoc(
        doc(
          db,
          "answers",
          selectedAnswerId
        ),
        {
          status:
            answer.secondReviewStatus !==
            "不要"
              ? "二次確認待ち"
              : "採点結果確認待ち",

          gradingStatus:
            "一次確認済み",

          firstReviewStatus:
            "確認済み",

          secondReviewStatus:
            answer.secondReviewStatus !==
            "不要"
              ? "未確認"
              : "不要",

          firstReviewedBy:
            currentUser.uid,

          firstReviewedByName:
            currentUser.name,

          firstReviewedAt:
            serverTimestamp(),

          firstReviewComment:
            reviewComment.trim() ||
            null,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        answer.secondReviewStatus !==
          "不要"
          ? "一次確認を完了しました。二次確認待ちへ移動しました。"
          : "一次確認を完了しました。"
      );

      setReviewComment("");

      if (
        currentUser.organizationId
      ) {
        await loadAnswers(
          currentUser.organizationId
        );
      }
    } catch (err) {
      console.error(
        "First review error:",
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
            一次確認
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
        {/* ==================================================
            Header
            ================================================== */}

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
            採点一次確認
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
            自動採点された答案を確認し、必要に応じて得点を修正します。
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
              Answer list
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

                gap:
                  10,
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
                確認待ち答案
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

            <select
              value={
                selectedStatus
              }
              onChange={(
                event
              ) =>
                setSelectedStatus(
                  event.target
                    .value
                )
              }
              style={{
                ...inputStyle,

                marginTop:
                  14,
              }}
            >
              <option value="一次確認待ち">
                一次確認待ち
              </option>

              <option value="確認中">
                確認中
              </option>
            </select>

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
              style={{
                ...inputStyle,

                marginTop:
                  10,
              }}
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
                  "calc(100vh - 330px)",

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
                  確認待ちの答案はありません。
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

                            fontSize:
                              11,

                            color:
                              "#777",
                          }}
                        >
                          {
                            answer.status
                          }
                        </div>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </section>

          {/* ==================================================
              Detail
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
                左側から確認する答案を選択してください。
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
                答案情報を読み込んでいます...
              </div>
            ) : (
              <>
                {/* ==========================================
                    Detail header
                    ========================================== */}

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "flex-start",

                    gap:
                      16,

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
                      採点結果
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
                        合計
                        {" "}
                        <strong>
                          {
                            editedTotal
                          }
                        </strong>
                        {" / "}
                        {
                          gradingResult.maxScore
                        }
                        {"点"}
                      </p>
                    )}
                  </div>

                  {gradingResult && (
                    <div
                      style={{
                        padding:
                          "8px 14px",

                        borderRadius:
                          999,

                        background:
                          "#f3f3f3",

                        fontWeight:
                          600,
                      }}
                    >
                      {
                        gradingResult.reviewStatus
                      }
                    </div>
                  )}
                </div>

                {/* ==========================================
                    Answer image
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

                        border:
                          "1px solid #ddd",

                        borderRadius:
                          10,

                        background:
                          "#f7f7f7",

                        padding:
                          10,
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
                    Grading
                    ========================================== */}

                {gradingResult ? (
                  <section
                    style={{
                      marginBottom:
                        24,
                    }}
                  >
                    <h3>
                      問題別採点
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
                              OCR回答
                            </th>

                            <th
                              style={
                                thStyle
                              }
                            >
                              正答
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
                              result
                            ) => (
                              <tr
                                key={
                                  result.questionId
                                }
                              >
                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  {
                                    result.questionNumber
                                  }
                                </td>

                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  {result.answer ||
                                    "—"}
                                </td>

                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  {result.correctAnswers.length >
                                  0
                                    ? result.correctAnswers.join(
                                        " / "
                                      )
                                    : "—"}
                                </td>

                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  <span
                                    style={{
                                      fontWeight:
                                        600,

                                      color:
                                        getResultColor(
                                          result.result
                                        ),
                                    }}
                                  >
                                    {
                                      result.result
                                    }
                                  </span>

                                  {result.reason && (
                                    <div
                                      style={{
                                        marginTop:
                                          4,

                                        fontSize:
                                          11,

                                        color:
                                          "#777",
                                      }}
                                    >
                                      {
                                        result.reason
                                      }
                                    </div>
                                  )}
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
                                        result.points
                                      }
                                      step="0.1"
                                      value={
                                        editedScores[
                                          result.questionId
                                        ] ??
                                        result.score
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        changeScore(
                                          result.questionId,
                                          event
                                            .target
                                            .value,
                                          result.points
                                        )
                                      }
                                      style={{
                                        ...scoreInputStyle,

                                        background:
                                          result.score !==
                                          (
                                            editedScores[
                                              result.questionId
                                            ] ??
                                            result.score
                                          )
                                            ? "#fff8e6"
                                            : "#fff",
                                      }}
                                    />

                                    <span>
                                      /
                                      {
                                        result.points
                                      }
                                    </span>
                                  </div>
                                </td>

                                <td
                                  style={
                                    tdStyle
                                  }
                                >
                                  {result.confidence ===
                                  null
                                    ? "—"
                                    : `${Math.round(
                                        result.confidence *
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
                ) : (
                  <div
                    style={{
                      padding:
                        30,

                      background:
                        "#fff8e6",

                      borderRadius:
                        8,

                      color:
                        "#765d00",
                    }}
                  >
                    採点結果がまだ登録されていません。
                  </div>
                )}

                {/* ==========================================
                    OCR
                    ========================================== */}

                {ocrResult && (
                  <section
                    style={{
                      marginBottom:
                        24,
                    }}
                  >
                    <details>
                      <summary
                        style={{
                          cursor:
                            "pointer",

                          fontWeight:
                            600,
                        }}
                      >
                        OCR結果を表示
                      </summary>

                      <div
                        style={{
                          marginTop:
                            12,

                          padding:
                            16,

                          background:
                            "#f7f7f7",

                          borderRadius:
                            8,

                          whiteSpace:
                            "pre-wrap",

                          fontSize:
                            13,

                          lineHeight:
                            1.8,
                        }}
                      >
                        {
                          ocrResult.fullText
                        }
                      </div>
                    </details>
                  </section>
                )}

                {/* ==========================================
                    Comment
                    ========================================== */}

                <section
                  style={{
                    marginBottom:
                      20,
                  }}
                >
                  <label
                    style={{
                      display:
                        "block",

                      fontWeight:
                        600,
                    }}
                  >
                    確認コメント

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
                      placeholder="採点を修正した場合などに記録します。"
                      rows={
                        4
                      }
                      style={
                        textareaStyle
                      }
                    />
                  </label>
                </section>

                {/* ==========================================
                    Complete
                    ========================================== */}

                <section>
                  <button
                    type="button"
                    disabled={
                      saving ||
                      !gradingResult
                    }
                    onClick={
                      completeFirstReview
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
                      ? "保存中..."
                      : "一次確認を完了する"}
                  </button>

                  <p
                    style={{
                      margin:
                        "10px 0 0",

                      color:
                        "#777",

                      fontSize:
                        12,

                      lineHeight:
                        1.7,
                    }}
                  >
                    一次確認では最終確定しません。
                    必要な場合は二次確認へ送られます。
                  </p>
                </section>
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
  changes: Array<{
    questionId: string;
    questionNumber: number;
    before: number;
    after: number;
    reason: string;
  }>
) {
  await import(
    "firebase/firestore"
  ).then(
    async ({
      addDoc,
      collection,
    }) => {
      await addDoc(
        collection(
          db,
          "systemLogs"
        ),
        {
          type:
            "grading_score_correction",

          answerId,

          userId:
            uid,

          userName,

          changes,

          createdAt:
            serverTimestamp(),
        }
      );
    }
  );
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

function getResultColor(
  result: GradingQuestion["result"]
) {
  switch (
    result
  ) {
    case "正解":
      return "#28733f";

    case "不正解":
      return "#a00000";

    case "部分点":
      return "#8a6500";

    case "判定不能":
      return "#8a6500";

    case "手動採点":
      return "#555";

    default:
      return "#555";
  }
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
      return "答案の確認処理に失敗しました。";
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
      7,

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
