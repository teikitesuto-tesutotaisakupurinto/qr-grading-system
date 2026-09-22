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

import {
  getScopedDocs,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

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
  gradingMethod: GradingMethod;
  correctAnswer: string;
  rubric: string;
  requiresReview: boolean;
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
    schoolId,
    setSchoolId,
  ] =
    useState("");

  const [
    examDate,
    setExamDate,
  ] =
    useState("");

  /* =======================================================
     Load
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

      if (!user) {
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

      const documents =
        await getScopedDocs(
          testsQueries(
            scopeUser
          )
        );

      const loaded =
        await Promise.all(
          documents
            .map(
              (
                item
              ) =>
                normalizeTest(
                  item.id,
                  item.data
                )
            )
            .filter(
              (
                test
              ) =>
                !test.isRetest
            )
            .map(
              async (
                test
              ) => {
                const loadedQuestions =
                  await getQuestions(
                    test.id
                  );

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

      setTests(
        loaded
      );

      setSelectedTestId(
        (
          current
        ) => {
          if (
            current &&
            loaded.some(
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
        error instanceof Error
          ? error.message
          : "テストを取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Load questions
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
        "問題設定を取得できませんでした。"
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
     Create
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
        await getAppUser();

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
          "テストを作成する権限がありません。"
        );
      }

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織がありません。"
        );
      }

      if (
        !testName.trim()
      ) {
        throw new Error(
          "テスト名を入力してください。"
        );
      }

      if (
        !grade.trim()
      ) {
        throw new Error(
          "学年を入力してください。"
        );
      }

      if (
        !subject.trim()
      ) {
        throw new Error(
          "教科を入力してください。"
        );
      }

      if (
        !schoolId.trim()
      ) {
        throw new Error(
          "校舎IDを入力してください。"
        );
      }

      if (
        user.role ===
          "校舎管理者" &&
        !user.schoolIds.includes(
          schoolId
        )
      ) {
        throw new Error(
          "所属していない校舎にはテストを作成できません。"
        );
      }

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

          schoolId,

          testId:
            testRef.id,

          name:
            testName.trim(),

          subject:
            subject.trim(),

          grade:
            grade.trim(),

          className:
            className.trim(),

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
           * テスト全体の自動採点フラグではなく、
           * 実際の採点方式は問題単位で管理する。
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

      setMessage(
        "テストを作成しました。"
      );

      setShowCreate(
        false
      );

      setTestName("");
      setGrade("");
      setClassName("");
      setSubject("");
      setSchoolId("");
      setExamDate("");

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
        error instanceof Error
          ? error.message
          : "テストを作成できませんでした。"
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
        error instanceof Error
          ? error.message
          : "問題を追加できませんでした。"
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

          /*
           * 自動採点問題でも、
           * 確認を必要とする設定を
           * 明示的に保持。
           */
          requiresReview:
            question.gradingMethod ===
              "manual"
              ? true
              : question.requiresReview,

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
        error instanceof Error
          ? error.message
          : "問題設定を保存できませんでした。"
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
      questions.length === 0
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const user =
        await getAppUser();

      if (!user) {
        throw new Error(
          "ログインしてください。"
        );
      }

      if (
        user.role !== "本部管理者" &&
        user.role !== "校舎管理者" &&
        user.role !== "講師"
      ) {
        throw new Error(
          "問題を編集する権限がありません。"
        );
      }

      const updates = questions.map(
        (question) =>
          updateDoc(
            doc(
              db,
              "testQuestions",
              question.id
            ),
            {
              gradingMethod,
              requiresReview:
                false,
              updatedAt:
                serverTimestamp(),
            }
          )
      );

      await Promise.all(updates);

      await loadQuestions(
        selectedTest.id
      );

      await loadTests();

      setMessage(
        gradingMethod === "automatic"
          ? "全問題を自動採点に設定しました。"
          : "全問題を手動採点に設定しました。"
      );
    } catch (error) {
      console.error(
        "Bulk grading method error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "採点方式を一括変更できませんでした。"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     Bulk automatic default
     ======================================================= */

  async function setAllAutomatic() {
    await updateAllGradingMethods(
      "automatic"
    );
  }

  async function setAllManual() {
    await updateAllGradingMethods(
      "manual"
    );
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

      const user =
        await getAppUser();

      if (
        !user
      ) {
        throw new Error(
          "ログインしてください。"
        );
      }

      /*
       * 問題削除は管理者のみ。
       */
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
        error instanceof Error
          ? error.message
          : "問題を削除できませんでした。"
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
      <section className="content">

        {/* ==================================================
            Header
            ================================================== */}

        <header className="pageHeader">
          <div>
            <h1>
              テスト管理
            </h1>

            <p className="muted">
              テスト・教科・問題ごとの採点方式を管理します。
            </p>
          </div>

          {(role ===
            "本部管理者" ||
            role ===
              "校舎管理者") && (
            <button
              type="button"
              className="button primary"
              onClick={() =>
                setShowCreate(
                  (
                    current
                  ) =>
                    !current
                )
              }
            >
              {showCreate
                ? "作成画面を閉じる"
                : "テストを作成"}
            </button>
          )}
        </header>

        {error && (
          <div
            className="errorMessage"
            role="alert"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            className="successMessage"
            role="status"
          >
            {message}
          </div>
        )}

        {/* ==================================================
            Create
            ================================================== */}

        {showCreate && (
          <section className="card">
            <h2>
              テスト作成
            </h2>

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
                label="テスト名"
                value={
                  testName
                }
                onChange={
                  setTestName
                }
              />

              <Field
                label="教科"
                value={
                  subject
                }
                onChange={
                  setSubject
                }
              />

              <Field
                label="学年"
                value={
                  grade
                }
                onChange={
                  setGrade
                }
              />

              <Field
                label="クラス"
                value={
                  className
                }
                onChange={
                  setClassName
                }
              />

              <Field
                label="校舎ID"
                value={
                  schoolId
                }
                onChange={
                  setSchoolId
                }
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

            <p
              className="muted"
              style={{
                marginTop:
                  12,

                fontSize:
                  12,
              }}
            >
              採点方式はテスト全体ではなく、登録した問題ごとに設定します。
            </p>

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
            placeholder="テスト名・教科・学年・クラス"
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
              "minmax(360px, .9fr) minmax(0, 1.4fr)",

            gap:
              18,

            marginTop:
              16,

            alignItems:
              "start",
          }}
        >

          {/* ================================================
              Test list
              ================================================ */}

          <section className="card">
            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

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
              0 && (
              <EmptyTests />
            )}

            {filteredTests.map(
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
                    className="muted"
                    style={{
                      marginTop:
                        4,

                      fontSize:
                        12,
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
            )}
          </section>

          {/* ================================================
              Detail
              ================================================ */}

          <section className="card">
            {!selectedTest ? (
              <EmptyDetail />
            ) : detailLoading ? (
              <div
                style={{
                  padding:
                    50,

                  textAlign:
                    "center",
                }}
              >
                問題設定を読み込んでいます...
              </div>
            ) : (
              <>
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
                        selectedTest.name
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
                        selectedTest.subject
                      }

                      {" / "}

                      {
                        selectedTest.grade
                      }

                      {selectedTest.examDate &&
                        ` / ${selectedTest.examDate}`}
                    </p>
                  </div>

                  {(role ===
                    "本部管理者" ||
                    role ===
                      "校舎管理者" ||
                    role ===
                      "講師") && (
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
                  )}
                </header>

                {/* ==========================================
                    Grading method notice
                    ========================================== */}

                <div
                  style={{
                    marginTop:
                      16,

                    padding:
                      14,

                    background:
                      "#f7f7f7",

                    borderRadius:
                      8,
                  }}
                >
                  <strong>
                    採点方式
                  </strong>

                  <p
                    className="muted"
                    style={{
                      margin:
                        "5px 0 0",

                      fontSize:
                        12,
                    }}
                  >
                    通常は全問題を自動採点として登録します。記述問題など、必要な問題だけ手動採点に変更できます。上のボタンから全問題を一括変更することもできます。
                  </p>
                </div>

                {/* ==========================================
                    Questions
                    ========================================== */}

                <section
                  style={{
                    marginTop:
                      20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                      }}
                    >
                      問題設定
                    </h3>

                    {questions.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="button"
                          disabled={saving}
                          onClick={setAllAutomatic}
                        >
                          全問題を自動採点
                        </button>

                        <button
                          type="button"
                          className="button"
                          disabled={saving}
                          onClick={setAllManual}
                        >
                          全問題を手動採点
                        </button>
                      </div>
                    )}
                  </div>

                  {questions.length ===
                    0 && (
                    <div
                      style={{
                        padding:
                          40,

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
                        「問題を追加」から問題を登録してください。
                      </p>
                    </div>
                  )}

                  {questions.map(
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
                  )}
                </section>
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

      {/* Grading method */}

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
            ) =>
              setLocal({
                ...local,

                gradingMethod:
                  event.target
                    .value as GradingMethod,

                /*
                 * 手動採点なら必ず確認対象。
                 */
                requiresReview:
                  event.target
                    .value ===
                  "manual"
                    ? true
                    : local.requiresReview,
              })
            }
          >
            <option value="manual">
              手動採点
            </option>

            <option value="automatic">
              自動採点
            </option>
          </select>
        </label>

        {local.gradingMethod ===
          "automatic" && (
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
        )}
      </div>

      {/* Rubric */}

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

      {/* Auto review */}

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

          自動採点後も一次確認を必須にする
        </label>
      )}

      {/* Actions */}

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
   Firestore
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
  const gradingMethod =
    data.gradingMethod ===
    "automatic"
      ? "automatic"
      : "manual";

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

    gradingMethod,

    correctAnswer:
      stringValue(
        data.correctAnswer
      ),

    rubric:
      stringValue(
        data.rubric
      ),

    requiresReview:
      gradingMethod ===
        "manual"
        ? true
        : data.requiresReview ===
          true,
  };
}

/* =========================================================
   Ordering
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
   Fields
   ========================================================= */

function Field({
  label,
  value,
  onChange,
}: {
  label: string;

  value: string;

  onChange: (
    value: string
  ) => void;
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
        登録された通常テストがここに表示されます。
      </p>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div
      style={{
        minHeight:
          450,

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
          左側から問題設定を編集するテストを選択してください。
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
