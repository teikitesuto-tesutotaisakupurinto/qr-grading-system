"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import type {
  Test,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type GradingMethod =
  | "automatic"
  | "manual";

type Question = {
  id: string;

  questionNumber: string;

  title: string;

  maxScore: number;

  gradingMethod:
    GradingMethod;

  correctAnswer: string;

  rubric: string;

  requiresReview: boolean;

  order: number;
};

type TestRow =
  Test & {
    questionCount: number;

    automaticCount: number;

    manualCount: number;
  };

/* =========================================================
   Page
   ========================================================= */

export default function TestsPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    organizationId,
    setOrganizationId,
  ] =
    useState("");

  const [
    tests,
    setTests,
  ] =
    useState<TestRow[]>(
      []
    );

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState<
      string | null
    >(null);

  const [
    questions,
    setQuestions,
  ] =
    useState<Question[]>(
      []
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
    search,
    setSearch,
  ] =
    useState("");

  /* =======================================================
     Create form
     ======================================================= */

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(false);

  const [
    testIdInput,
    setTestIdInput,
  ] =
    useState("");

  const [
    testName,
    setTestName,
  ] =
    useState("");

  const [
    grade,
    setGrade,
  ] =
    useState("");

  const [
    className,
    setClassName,
  ] =
    useState("");

  const [
    subject,
    setSubject,
  ] =
    useState("");

  const [
    examDate,
    setExamDate,
  ] =
    useState("");

  /* =======================================================
     Initial load
     ======================================================= */

  useEffect(() => {
    void loadTests();
  }, []);

  async function loadTests() {
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
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者" &&
        user.role !==
          "講師"
      ) {
        throw new Error(
          "テスト管理を利用する権限がありません。"
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

      setOrganizationId(
        user.organizationId
      );

      /*
       * テストは校舎単位ではなく、
       * 組織単位で取得する。
       */
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
            )
          )
        );

      const normalTests =
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

      const rows =
        await Promise.all(
          normalTests.map(
            async (
              test
            ) => {
              let loadedQuestions:
                Question[] =
                [];

              try {
                loadedQuestions =
                  await getQuestions(
                    test.id
                  );
              } catch (
                questionError
              ) {
                console.error(
                  "Question count load error:",
                  questionError
                );
              }

              return {
                ...test,

                questionCount:
                  loadedQuestions.length,

                automaticCount:
                  loadedQuestions.filter(
                    (
                      question
                    ) =>
                      question.gradingMethod ===
                      "automatic"
                  ).length,

                manualCount:
                  loadedQuestions.filter(
                    (
                      question
                    ) =>
                      question.gradingMethod ===
                      "manual"
                  ).length,
              };
            }
          )
        );

      rows.sort(
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

      setTests(
        rows
      );

      setSelectedTestId(
        (
          current: string | null
        ) => {
          if (
            current &&
            rows.some(
              (
                test
              ) =>
                test.id ===
                current
            )
          ) {
            return current;
          }

          return null;
        }
      );
    } catch (
      error
    ) {
      console.error(
        "Tests load error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "テストを取得できませんでした。"
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /* =======================================================
     Selected test questions
     ======================================================= */

  useEffect(() => {
    if (
      !selectedTestId
    ) {
      setQuestions([]);
      return;
    }

    void loadQuestions(
      selectedTestId
    );
  }, [
    selectedTestId,
  ]);

  async function loadQuestions(
    testId: string
  ) {
    try {
      setDetailLoading(
        true
      );

      setError("");

      const loaded =
        await getQuestions(
          testId
        );

      setQuestions(
        loaded
      );
    } catch (
      error
    ) {
      console.error(
        "Question load error:",
        error
      );

      setQuestions([]);

      setError(
        toUserMessage(
          error,
          "問題設定を取得できませんでした。"
        )
      );
    } finally {
      setDetailLoading(
        false
      );
    }
  }

  /* =======================================================
     Filter
     ======================================================= */

  const filteredTests =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (
        !keyword
      ) {
        return tests;
      }

      return tests.filter(
        (
          test
        ) =>
          test.name
            .toLowerCase()
            .includes(
              keyword
            ) ||
          test.testId
            .toLowerCase()
            .includes(
              keyword
            ) ||
          test.subject
            .toLowerCase()
            .includes(
              keyword
            ) ||
          test.grade
            .toLowerCase()
            .includes(
              keyword
            ) ||
          test.className
            .toLowerCase()
            .includes(
              keyword
            )
      );
    }, [
      tests,
      search,
    ]);

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
     Create test
     ======================================================= */

  async function createTest() {
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

      /*
       * 講師もテスト作成可能。
       */
      if (
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者" &&
        user.role !==
          "講師"
      ) {
        throw new Error(
          "テストを作成する権限がありません。"
        );
      }

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織が設定されていません。"
        );
      }

      const normalizedTestId =
        testIdInput
          .trim();

      const normalizedName =
        testName
          .trim();

      const normalizedSubject =
        subject
          .trim();

      const normalizedGrade =
        grade
          .trim();

      const normalizedClassName =
        className
          .trim();

      if (
        !normalizedTestId
      ) {
        throw new Error(
          "テストIDを入力してください。"
        );
      }

      if (
        !normalizedName
      ) {
        throw new Error(
          "テスト名を入力してください。"
        );
      }

      if (
        !normalizedSubject
      ) {
        throw new Error(
          "教科を入力してください。"
        );
      }

      if (
        !normalizedGrade
      ) {
        throw new Error(
          "学年を入力してください。"
        );
      }

      /*
       * 担当者が入力したテストIDを
       * そのまま使用する。
       *
       * 同じ組織内で重複させない。
       */
      const duplicateSnapshot =
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
              "testId",
              "==",
              normalizedTestId
            )
          )
        );

      if (
        !duplicateSnapshot.empty
      ) {
        throw new Error(
          "このテストIDはすでに登録されています。別のテストIDを入力してください。"
        );
      }

      /*
       * Firestore document IDは
       * システム側で生成。
       *
       * testIdフィールドは
       * 担当者入力値。
       */
      const testRef =
        doc(
          collection(
            db,
            "tests"
          )
        );

      await setDoc(
        testRef,
        {
          organizationId:
            user.organizationId,

          /*
           * テストは組織共通。
           * schoolIdは設定しない。
           */
          testId:
            normalizedTestId,

          name:
            normalizedName,

          subject:
            normalizedSubject,

          grade:
            normalizedGrade,

          className:
            normalizedClassName,

          examDate:
            examDate,

          totalScore:
            0,

          active:
            true,

          isRetest:
            false,

          originalTestId:
            null,

          /*
           * テスト全体の採点方式ではなく、
           * 問題ごとに管理する。
           */
          automaticGrading:
            false,

          createdBy:
            user.uid,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * フォームをリセット。
       */
      setTestIdInput("");
      setTestName("");
      setSubject("");
      setGrade("");
      setClassName("");
      setExamDate("");

      setShowCreate(
        false
      );

      setMessage(
        "テストを作成しました。"
      );

      await loadTests();

      setSelectedTestId(
        testRef.id
      );
    } catch (
      error
    ) {
      console.error(
        "Create test error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "テストを作成できませんでした。"
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Add question
     ======================================================= */

  async function addQuestion() {
    if (
      !selectedTest
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
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者" &&
        user.role !==
          "講師"
      ) {
        throw new Error(
          "問題を編集する権限がありません。"
        );
      }

      const questionRef =
        doc(
          collection(
            db,
            "testQuestions"
          )
        );

      const nextNumber =
        String(
          questions.length +
            1
        );

      await setDoc(
        questionRef,
        {
          testId:
            selectedTest.id,

          organizationId:
            selectedTest.organizationId,

          questionNumber:
            nextNumber,

          title:
            `問${nextNumber}`,

          maxScore:
            1,

          /*
           * 初期値は自動採点。
           */
          gradingMethod:
            "automatic",

          correctAnswer:
            "",

          rubric:
            "",

          requiresReview:
            false,

          order:
            questions.length,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      await loadQuestions(
        selectedTest.id
      );

      await loadTests();

      setMessage(
        `問${nextNumber}を追加しました。`
      );
    } catch (
      error
    ) {
      console.error(
        "Add question error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "問題を追加できませんでした。"
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Update question
     ======================================================= */

  async function updateQuestion(
    question: Question
  ) {
    if (
      !selectedTest
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
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者" &&
        user.role !==
          "講師"
      ) {
        throw new Error(
          "問題を編集する権限がありません。"
        );
      }

      await updateDoc(
        doc(
          db,
          "testQuestions",
          question.id
        ),
        {
          questionNumber:
            question.questionNumber,

          title:
            question.title,

          maxScore:
            Math.max(
              0,
              question.maxScore
            ),

          gradingMethod:
            question.gradingMethod,

          correctAnswer:
            question.correctAnswer,

          rubric:
            question.rubric,

          requiresReview:
            question.gradingMethod ===
            "manual"
              ? true
              : question.requiresReview,

          order:
            question.order,

          updatedAt:
            serverTimestamp(),
        }
      );

      await loadQuestions(
        selectedTest.id
      );

      await loadTests();

      setMessage(
        `問${question.questionNumber}を保存しました。`
      );
    } catch (
      error
    ) {
      console.error(
        "Update question error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "問題設定を保存できませんでした。"
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Bulk grading method
     ======================================================= */

  async function updateAllGradingMethods(
    gradingMethod: GradingMethod
  ) {
    if (
      !selectedTest ||
      questions.length ===
        0
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
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者" &&
        user.role !==
          "講師"
      ) {
        throw new Error(
          "問題を編集する権限がありません。"
        );
      }

      await Promise.all(
        questions.map(
          (
            question
          ) =>
            updateDoc(
              doc(
                db,
                "testQuestions",
                question.id
              ),
              {
                gradingMethod,

                requiresReview:
                  gradingMethod ===
                  "manual"
                    ? true
                    : false,

                updatedAt:
                  serverTimestamp(),
              }
            )
        )
      );

      await loadQuestions(
        selectedTest.id
      );

      await loadTests();

      setMessage(
        gradingMethod ===
          "automatic"
          ? "全問題を自動採点に設定しました。"
          : "全問題を手動採点に設定しました。"
      );
    } catch (
      error
    ) {
      console.error(
        "Bulk grading method error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "採点方式を一括変更できませんでした。"
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Delete question
     ======================================================= */

  async function deleteQuestion(
    question: Question
  ) {
    if (
      !selectedTest
    ) {
      return;
    }

    if (
      !window.confirm(
        `問${question.questionNumber}を削除しますか？`
      )
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
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者"
      ) {
        throw new Error(
          "問題を削除する権限がありません。"
        );
      }

      await deleteDoc(
        doc(
          db,
          "testQuestions",
          question.id
        )
      );

      await loadQuestions(
        selectedTest.id
      );

      await loadTests();

      setMessage(
        "問題を削除しました。"
      );
    } catch (
      error
    ) {
      console.error(
        "Delete question error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "問題を削除できませんでした。"
        )
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
            テスト管理
          </h1>

          <p>
            テストを読み込んでいます...
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
      <section
        className="content"
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
          className="pageHeader"
        >
          <div>
            <h1>
              テスト管理
            </h1>

            <p className="muted">
              組織共通のテストと問題ごとの採点方式を管理します。
            </p>
          </div>

          <button
            type="button"
            className="button primary"
            onClick={() =>
              setShowCreate(
                (
                  current: boolean
                ) =>
                  !current
              )
            }
          >
            {showCreate
              ? "作成画面を閉じる"
              : "テストを作成"}
          </button>
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
            Create
            ================================================== */}

        {showCreate && (
          <section
            className="card"
            style={{
              marginBottom:
                16,
            }}
          >
            <h2>
              テスト作成
            </h2>

            <p
              className="muted"
              style={{
                fontSize:
                  12,

                lineHeight:
                  1.7,
              }}
            >
              テストは組織共通です。校舎を選択する必要はありません。テストIDは担当者が入力した値をそのまま使用します。
            </p>

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",

                gap:
                  12,

                marginTop:
                  14,
              }}
            >
              <Field
                label="テストID"
                value={
                  testIdInput
                }
                onChange={
                  setTestIdInput
                }
                placeholder="例：TEST-2026-001"
              />

              <Field
                label="テスト名"
                value={
                  testName
                }
                onChange={
                  setTestName
                }
                placeholder="例：第1回数学テスト"
              />

              <Field
                label="教科"
                value={
                  subject
                }
                onChange={
                  setSubject
                }
                placeholder="数学"
              />

              <Field
                label="学年"
                value={
                  grade
                }
                onChange={
                  setGrade
                }
                placeholder="中学2年"
              />

              <Field
                label="クラス"
                value={
                  className
                }
                onChange={
                  setClassName
                }
                placeholder="TZ"
              />

              <label>
                <span
                  style={{
                    display:
                      "block",

                    marginBottom:
                      6,

                    fontWeight:
                      600,
                  }}
                >
                  実施日
                </span>

                <input
                  type="date"
                  value={
                    examDate
                  }
                  onChange={(
                    event
                  ) =>
                    setExamDate(
                      event.target
                        .value
                    )
                  }
                  style={{
                    width:
                      "100%",
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
                  14,
              }}
            >
              <button
                type="button"
                className="button primary"
                disabled={
                  saving
                }
                onClick={
                  createTest
                }
              >
                {saving
                  ? "作成中..."
                  : "テストを作成"}
              </button>
            </div>
          </section>
        )}

        {/* ==================================================
            Search
            ================================================== */}

        <section
          className="card"
          style={{
            marginBottom:
              16,
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
            placeholder="テストID・テスト名・教科・学年・クラスを検索"
            style={{
              width:
                "100%",
            }}
          />
        </section>

        {/* ==================================================
            Main
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "minmax(320px, .8fr) minmax(0, 1.5fr)",

            gap:
              16,

            alignItems:
              "start",
          }}
        >
          {/* ==================================================
              Test list
              ================================================== */}

          <section
            className="card"
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
                  12,
              }}
            >
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                テスト一覧
              </h2>

              <span className="muted">
                {
                  filteredTests.length
                }
                件
              </span>
            </div>

            {filteredTests.length ===
              0 ? (
              <EmptyTests />
            ) : (
              filteredTests.map(
                (
                  test
                ) => (
                  <button
                    key={
                      test.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedTestId(
                        test.id
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
                        selectedTestId ===
                        test.id
                          ? "2px solid #111"
                          : "1px solid #ddd",

                      borderRadius:
                        8,

                      background:
                        selectedTestId ===
                        test.id
                          ? "#f7f7f7"
                          : "#fff",

                      cursor:
                        "pointer",
                    }}
                  >
                    <strong>
                      {
                        test.name
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          5,

                        fontSize:
                          11,

                        color:
                          "#555",

                        wordBreak:
                          "break-all",
                      }}
                    >
                      ID：
                      {
                        test.testId
                      }
                    </div>

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
                        test.subject
                      }
                      {" / "}
                      {
                        test.grade
                      }

                      {test.className &&
                        ` / ${test.className}`}
                    </div>

                    <div
                      style={{
                        display:
                          "flex",

                        gap:
                          6,

                        marginTop:
                          10,

                        flexWrap:
                          "wrap",
                      }}
                    >
                      <Badge
                        label="問題"
                        value={
                          test.questionCount
                        }
                      />

                      <Badge
                        label="自動"
                        value={
                          test.automaticCount
                        }
                      />

                      <Badge
                        label="手動"
                        value={
                          test.manualCount
                        }
                      />
                    </div>
                  </button>
                )
              )
            )}
          </section>

          {/* ==================================================
              Detail
              ================================================== */}

          <section
            className="card"
          >
            {!selectedTest ? (
              <EmptyDetail />
            ) : detailLoading ? (
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
                問題設定を読み込んでいます...
              </div>
            ) : (
              <>
                {/* ==========================================
                    Test information
                    ========================================== */}

                <header
                  style={{
                    paddingBottom:
                      16,

                    borderBottom:
                      "1px solid #eee",
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
                          selectedTest.name
                        }
                      </h2>

                      <div
                        style={{
                          marginTop:
                            6,

                          fontSize:
                            12,
                        }}
                      >
                        テストID：
                        <strong>
                          {
                            selectedTest.testId
                          }
                        </strong>
                      </div>

                      <p
                        className="muted"
                        style={{
                          margin:
                            "5px 0 0",
                        }}
                      >
                        {
                          selectedTest.subject
                        }
                        {" / "}
                        {
                          selectedTest.grade
                        }

                        {selectedTest.className &&
                          ` / ${selectedTest.className}`}

                        {selectedTest.examDate &&
                          ` / ${selectedTest.examDate}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="button"
                      disabled={
                        saving
                      }
                      onClick={
                        addQuestion
                      }
                    >
                      問題を追加
                    </button>
                  </div>
                </header>

                {/* ==========================================
                    Notice
                    ========================================== */}

                <div
                  style={{
                    marginTop:
                      14,

                    padding:
                      12,

                    background:
                      "#f7f7f7",

                    borderRadius:
                      8,

                    fontSize:
                      12,

                    lineHeight:
                      1.7,
                  }}
                >
                  <strong>
                    採点方式
                  </strong>

                  <div
                    className="muted"
                    style={{
                      marginTop:
                        4,
                    }}
                  >
                    テスト全体ではなく、問題ごとに自動採点・手動採点を設定します。
                  </div>
                </div>

                {/* ==========================================
                    Questions header
                    ========================================== */}

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

                    flexWrap:
                      "wrap",

                    marginTop:
                      18,

                    marginBottom:
                      10,
                  }}
                >
                  <h3
                    style={{
                      margin:
                        0,
                    }}
                  >
                    問題設定
                  </h3>

                  {questions.length >
                    0 && (
                    <div
                      style={{
                        display:
                          "flex",

                        gap:
                          8,

                        flexWrap:
                          "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          void updateAllGradingMethods(
                            "automatic"
                          )
                        }
                      >
                        全問題を自動採点
                      </button>

                      <button
                        type="button"
                        className="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          void updateAllGradingMethods(
                            "manual"
                          )
                        }
                      >
                        全問題を手動採点
                      </button>
                    </div>
                  )}
                </div>

                {/* ==========================================
                    Questions
                    ========================================== */}

                {questions.length ===
                0 ? (
                  <div
                    style={{
                      padding:
                        50,

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
                    <strong>
                      問題がありません。
                    </strong>

                    <p
                      style={{
                        fontSize:
                          12,
                      }}
                    >
                      「問題を追加」から登録してください。
                    </p>
                  </div>
                ) : (
                  questions.map(
                    (
                      question
                    ) => (
                      <QuestionEditor
                        key={
                          question.id
                        }
                        question={
                          question
                        }
                        saving={
                          saving
                        }
                        canDelete={
                          role ===
                            "本部管理者" ||
                          role ===
                            "校舎管理者"
                        }
                        onSave={
                          updateQuestion
                        }
                        onDelete={
                          deleteQuestion
                        }
                      />
                    )
                  )
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
   Question editor
   ========================================================= */

function QuestionEditor({
  question,
  saving,
  canDelete,
  onSave,
  onDelete,
}: {
  question: Question;

  saving: boolean;

  canDelete: boolean;

  onSave: (
    question: Question
  ) => Promise<void>;

  onDelete: (
    question: Question
  ) => Promise<void>;
}) {
  const [
    local,
    setLocal,
  ] =
    useState<Question>(
      question
    );

  useEffect(() => {
    setLocal(
      question
    );
  }, [
    question,
  ]);

  return (
    <div
      style={{
        padding:
          16,

        marginBottom:
          12,

        border:
          "1px solid #ddd",

        borderRadius:
          8,
      }}
    >
      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "100px 1fr 120px",

          gap:
            10,
        }}
      >
        <label>
          <span
            style={{
              display:
                "block",

              marginBottom:
                5,

              fontSize:
                11,
            }}
          >
            問題番号
          </span>

          <input
            value={
              local.questionNumber
            }
            onChange={(
              event
            ) =>
              setLocal({
                ...local,

                questionNumber:
                  event.target
                    .value,
              })
            }
          />
        </label>

        <label>
          <span
            style={{
              display:
                "block",

              marginBottom:
                5,

              fontSize:
                11,
            }}
          >
            問題名
          </span>

          <input
            value={
              local.title
            }
            onChange={(
              event
            ) =>
              setLocal({
                ...local,

                title:
                  event.target
                    .value,
              })
            }
          />
        </label>

        <label>
          <span
            style={{
              display:
                "block",

              marginBottom:
                5,

              fontSize:
                11,
            }}
          >
            配点
          </span>

          <input
            type="number"
            min={
              0
            }
            value={
              local.maxScore
            }
            onChange={(
              event
            ) =>
              setLocal({
                ...local,

                maxScore:
                  Number(
                    event.target
                      .value
                  ),
              })
            }
          />
        </label>
      </div>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "1fr 1fr",

          gap:
            10,

          marginTop:
            12,
        }}
      >
        <label>
          <span
            style={{
              display:
                "block",

              marginBottom:
                5,

              fontSize:
                11,
            }}
          >
            採点方式
          </span>

          <select
            value={
              local.gradingMethod
            }
            onChange={(
              event
            ) => {
              const method =
                event.target
                  .value as GradingMethod;

              setLocal({
                ...local,

                gradingMethod:
                  method,

                requiresReview:
                  method ===
                  "manual"
                    ? true
                    : local.requiresReview,
              });
            }}
          >
            <option value="automatic">
              自動採点
            </option>

            <option value="manual">
              手動採点
            </option>
          </select>
        </label>

        <label>
          <span
            style={{
              display:
                "block",

              marginBottom:
                5,

              fontSize:
                11,
            }}
          >
            正答
          </span>

          <input
            value={
              local.correctAnswer
            }
            onChange={(
              event
            ) =>
              setLocal({
                ...local,

                correctAnswer:
                  event.target
                    .value,
              })
            }
            placeholder="例：A / 12 / 東京"
          />
        </label>
      </div>

      <label
        style={{
          display:
            "block",

          marginTop:
            12,
        }}
      >
        <span
          style={{
            display:
              "block",

            marginBottom:
              5,

            fontSize:
              11,
          }}
        >
          採点基準・ルーブリック
        </span>

        <textarea
          value={
            local.rubric
          }
          onChange={(
            event
          ) =>
            setLocal({
              ...local,

              rubric:
                event.target
                  .value,
            })
          }
          rows={
            3
          }
          placeholder="記述問題などの採点基準"
          style={{
            width:
              "100%",
          }}
        />
      </label>

      {local.gradingMethod ===
        "automatic" && (
        <label
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              8,

            marginTop:
              10,

            fontSize:
              12,
          }}
        >
          <input
            type="checkbox"
            checked={
              local.requiresReview
            }
            onChange={(
              event
            ) =>
              setLocal({
                ...local,

                requiresReview:
                  event.target
                    .checked,
              })
            }
          />

          自動採点後も確認する
        </label>
      )}

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "flex-end",

          gap:
            8,

          marginTop:
            14,
        }}
      >
        {canDelete && (
          <button
            type="button"
            className="button"
            disabled={
              saving
            }
            onClick={() =>
              onDelete(
                local
              )
            }
          >
            削除
          </button>
        )}

        <button
          type="button"
          className="button primary"
          disabled={
            saving
          }
          onClick={() =>
            onSave(
              local
            )
          }
        >
          保存
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Firestore questions
   ========================================================= */

async function getQuestions(
  testId: string
): Promise<Question[]> {
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
          testId
        )
      )
    );

  return snapshot.docs
    .map(
      (
        item
      ) =>
        normalizeQuestion(
          item.id,
          item.data()
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

    /*
     * テストは組織共通。
     * 古いデータにschoolIdが残っていても
     * 読み込みは可能にする。
     */
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
   Normalize question
   ========================================================= */

function normalizeQuestion(
  id: string,
  data: Record<
    string,
    unknown
  >
): Question {
  const method =
    data.gradingMethod ===
    "manual"
      ? "manual"
      : "automatic";

  return {
    id,

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
  };
}

/* =========================================================
   Question order
   ========================================================= */

function questionOrder(
  question: Question
) {
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
   Field
   ========================================================= */

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;

  value: string;

  onChange: (
    value: string
  ) => void;

  placeholder?: string;
}) {
  return (
    <label>
      <span
        style={{
          display:
            "block",

          marginBottom:
            6,

          fontWeight:
            600,
        }}
      >
        {
          label
        }
      </span>

      <input
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
        placeholder={
          placeholder
        }
        style={{
          width:
            "100%",
        }}
      />
    </label>
  );
}

/* =========================================================
   Badge
   ========================================================= */

function Badge({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <span
      style={{
        padding:
          "3px 7px",

        borderRadius:
          999,

        background:
          "#f1f1f1",

        fontSize:
          10,
      }}
    >
      {
        label
      }
      {" "}
      {
        value
      }
    </span>
  );
}

/* =========================================================
   Empty
   ========================================================= */

function EmptyTests() {
  return (
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
        テストがありません。
      </strong>

      <p
        style={{
          fontSize:
            12,
        }}
      >
        「テストを作成」から登録してください。
      </p>
    </div>
  );
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

        color:
          "#777",
      }}
    >
      <div>
        <strong>
          テストを選択してください
        </strong>

        <p
          style={{
            fontSize:
              12,
          }}
        >
          左側から問題設定を行うテストを選択してください。
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   User-friendly error
   ========================================================= */

function toUserMessage(
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
