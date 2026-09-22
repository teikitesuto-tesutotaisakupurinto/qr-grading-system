"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

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
  createAnswer,
  getAnswerWithUrl,
  type CreateAnswerInput,
} from "@/lib/answers";

import {
  getScopedDocs,
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Answer,
  AnswerStatus,
  Student,
  Test,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type SubjectOption = {
  id: string;

  name: string;

  maxScore: number;
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

export default function AnswersPage() {
  const [
    userRole,
    setUserRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    organizationId,
    setOrganizationId,
  ] =
    useState<string | null>(
      null
    );

  const [
    schoolIds,
    setSchoolIds,
  ] =
    useState<string[]>(
      []
    );

  const [
    answers,
    setAnswers,
  ] =
    useState<AnswerListItem[]>(
      []
    );

  const [
    students,
    setStudents,
  ] =
    useState<Student[]>(
      []
    );

  const [
    tests,
    setTests,
  ] =
    useState<Test[]>(
      []
    );

  const [
    subjects,
    setSubjects,
  ] =
    useState<
      SubjectOption[]
    >(
      []
    );

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState("");

  const [
    selectedSubjectId,
    setSelectedSubjectId,
  ] =
    useState("");

  const [
    selectedStudentId,
    setSelectedStudentId,
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
      | AnswerStatus
    >(
      "all"
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
    selectedImageUrl,
    setSelectedImageUrl,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    imageLoading,
    setImageLoading,
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

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  /* =======================================================
     Initial load
     ======================================================= */

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
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
          "答案管理は職員のみ利用できます。"
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

      setOrganizationId(
        user.organizationId
      );

      setSchoolIds(
        user.schoolIds
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

      /*
       * テストと生徒を取得。
       *
       * 答案はscopeに従って取得する。
       */
      const [
        testDocuments,
        studentDocuments,
        answerDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            testsQueries(
              scopeUser
            )
          ),

          getScopedDocs(
            studentsQueries(
              scopeUser
            )
          ),

          getAnswerDocuments(
            scopeUser
          ),
        ]);

      const loadedTests =
        testDocuments
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
          );

      const loadedStudents =
        studentDocuments.map(
          (
            item
          ) =>
            normalizeStudent(
              item.id,
              item.data
            )
        );

      const loadedAnswers =
        answerDocuments.map(
          (
            item
          ) =>
            normalizeAnswerListItem(
              item.id,
              item.data,
              loadedStudents,
              loadedTests
            )
        );

      setTests(
        loadedTests
      );

      setStudents(
        loadedStudents
      );

      setAnswers(
        loadedAnswers
      );

      /*
       * テストは自動選択しない。
       *
       * ユーザーが明示的に選択する。
       * 初期状態で誤ったテストを
       * 操作しないため。
       */
      setSelectedTestId("");

      setSelectedSubjectId("");

      setSelectedStudentId("");
    } catch (
      error
    ) {
      console.error(
        "Answers page load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "答案データを取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Subject options
     ======================================================= */

  useEffect(() => {
    if (
      !selectedTestId
    ) {
      setSubjects([]);
      setSelectedSubjectId("");
      return;
    }

    void loadSubjects(
      selectedTestId
    );
  }, [
    selectedTestId,
  ]);

  async function loadSubjects(
    testId: string
  ) {
    try {
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "testSubjects"
            ),

            where(
              "testId",
              "==",
              testId
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

                name:
                  stringValue(
                    data.subjectName
                  ) ||
                  stringValue(
                    data.name
                  ),

                maxScore:
                  safeNumber(
                    data.maxScore
                  ),
              };
            }
          )
          .filter(
            (
              subject
            ) =>
              subject.name
          );

      setSubjects(
        loaded
      );

      /*
       * 教科は自動選択しない。
       */
      setSelectedSubjectId(
        ""
      );
    } catch (
      error
    ) {
      console.error(
        "Subject load error:",
        error
      );

      setSubjects([]);

      setSelectedSubjectId("");

      setError(
        "教科情報を取得できませんでした。"
      );
    }
  }

  /* =======================================================
     File selection
     ======================================================= */

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ??
      null;

    setSelectedFile(
      file
    );

    setMessage("");

    setError("");
  }

  /* =======================================================
     Upload
     ======================================================= */

  async function handleUpload() {
    if (
      uploading
    ) {
      return;
    }

    try {
      setUploading(true);

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
          "答案をアップロードする権限がありません。"
        );
      }

      if (
        !organizationId
      ) {
        throw new Error(
          "所属組織がありません。"
        );
      }

      if (
        !selectedTestId
      ) {
        throw new Error(
          "テストを選択してください。"
        );
      }

      if (
        !selectedSubjectId
      ) {
        throw new Error(
          "教科を選択してください。"
        );
      }

      if (
        !selectedFile
      ) {
        throw new Error(
          "答案ファイルを選択してください。"
        );
      }

      /*
       * テストから校舎IDを取得。
       */
      const test =
        tests.find(
          (
            item
          ) =>
            item.id ===
            selectedTestId
        );

      if (
        !test
      ) {
        throw new Error(
          "選択したテストが見つかりません。"
        );
      }

      if (
        !test.schoolId
      ) {
        throw new Error(
          "テストの校舎情報がありません。"
        );
      }

      /*
       * 校舎権限チェック。
       */
      if (
        user.role !==
        "本部管理者" &&
        !user.schoolIds.includes(
          test.schoolId
        )
      ) {
        throw new Error(
          "このテストの答案を登録する権限がありません。"
        );
      }

      /*
       * 生徒を指定する場合。
       */
      const selectedStudent =
        selectedStudentId
          ? students.find(
              (
                student
              ) =>
                student.id ===
                selectedStudentId
            )
          : null;

      const input:
        CreateAnswerInput =
        {
          organizationId:
            organizationId,

          schoolId:
            test.schoolId,

          testId:
            selectedTestId,

          subjectId:
            selectedSubjectId,

          studentId:
            selectedStudent?.id ??
            null,

          studentNumber:
            selectedStudent
              ?.studentNumber ??
            null,

          file:
            selectedFile,
        };

      await createAnswer(
        input
      );

      setMessage(
        "答案を登録しました。"
      );

      /*
       * ファイル選択をリセット。
       */
      setSelectedFile(
        null
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }

      /*
       * 実データを再取得。
       */
      await loadData();
    } catch (
      error
    ) {
      console.error(
        "Answer upload error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "答案を登録できませんでした。"
      );
    } finally {
      setUploading(false);
    }
  }

  /* =======================================================
     Filtered answers
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
          const matchesTest =
            !selectedTestId ||
            answer.testId ===
              selectedTestId;

          const matchesSubject =
            !selectedSubjectId ||
            answer.subjectId ===
              selectedSubjectId;

          const matchesStatus =
            statusFilter ===
            "all" ||
            answer.status ===
              statusFilter;

          const matchesKeyword =
            !keyword ||
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
              );

          return (
            matchesTest &&
            matchesSubject &&
            matchesStatus &&
            matchesKeyword
          );
        }
      );
    }, [
      answers,
      selectedTestId,
      selectedSubjectId,
      statusFilter,
      search,
    ]);

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
     Image preview
     ======================================================= */

  useEffect(() => {
    if (
      !selectedAnswer
    ) {
      setSelectedImageUrl(
        null
      );

      return;
    }

    void loadAnswerImage(
      selectedAnswer.id
    );
  }, [
    selectedAnswerId,
  ]);

  async function loadAnswerImage(
    answerId: string
  ) {
    try {
      setImageLoading(
        true
      );

      setSelectedImageUrl(
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
       * クライアント側でも追加チェック。
       */
      if (
        !canViewAnswer(
          answer,
          scopeUser
        )
      ) {
        throw new Error(
          "この答案を閲覧する権限がありません。"
        );
      }

      setSelectedImageUrl(
        answer.signedUrl
      );
    } catch (
      error
    ) {
      console.error(
        "Answer image load error:",
        error
      );

      setSelectedImageUrl(
        null
      );

      setError(
        error instanceof Error
          ? error.message
          : "答案画像を表示できませんでした。"
      );
    } finally {
      setImageLoading(
        false
      );
    }
  }

  /* =======================================================
     Summary
     ======================================================= */

  const total =
    filteredAnswers.length;

  const uploaded =
    filteredAnswers.filter(
      (
        answer
      ) =>
        answer.status ===
        "uploaded"
    ).length;

  const processing =
    filteredAnswers.filter(
      (
        answer
      ) =>
        answer.status ===
        "processing"
    ).length;

  const review =
    filteredAnswers.filter(
      (
        answer
      ) =>
        answer.status ===
          "first_review" ||
        answer.status ===
          "second_review"
    ).length;

  const confirmed =
    filteredAnswers.filter(
      (
        answer
      ) =>
        answer.status ===
          "confirmed" ||
        answer.status ===
          "published"
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
            答案管理
          </h1>

          <p>
            答案データを読み込んでいます...
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
              答案管理
            </h1>

            <p className="muted">
              答案ファイルを登録し、QR・OCR・採点処理へ進めます。
            </p>
          </div>

          <Link
            href="/grading"
            className="button"
          >
            採点管理
          </Link>
        </header>

        {/* ==================================================
            Message
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
            Upload
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                20,

              marginBottom:
                16,
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                答案登録
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                画像またはPDFを登録します。実ファイルはSupabase Storageに保存されます。
              </p>
            </div>
          </div>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",

              gap:
                12,
            }}
          >
            {/* Test */}

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
                テスト
              </span>

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

                      {test.subject &&
                        ` / ${test.subject}`}

                      {test.examDate &&
                        ` / ${test.examDate}`}
                    </option>
                  )
                )}
              </select>
            </label>

            {/* Subject */}

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
                教科
              </span>

              <select
                value={
                  selectedSubjectId
                }
                onChange={(
                  event
                ) =>
                  setSelectedSubjectId(
                    event.target
                      .value
                  )
                }
                disabled={
                  !selectedTestId
                }
              >
                <option value="">
                  教科を選択
                </option>

                {subjects.map(
                  (
                    subject
                  ) => (
                    <option
                      key={
                        subject.id
                      }
                      value={
                        subject.id
                      }
                    >
                      {
                        subject.name
                      }

                      {subject.maxScore >
                        0 &&
                        ` / ${subject.maxScore}点`}
                    </option>
                  )
                )}
              </select>
            </label>

            {/* Student */}

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
                生徒
              </span>

              <select
                value={
                  selectedStudentId
                }
                onChange={(
                  event
                ) =>
                  setSelectedStudentId(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  後から紐付け
                </option>

                {students.map(
                  (
                    student
                  ) => (
                    <option
                      key={
                        student.id
                      }
                      value={
                        student.id
                      }
                    >
                      {
                        student.studentNumber
                      }
                      {" / "}
                      {
                        student.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          {/* File */}

          <div
            style={{
              marginTop:
                16,
            }}
          >
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
                答案ファイル
              </span>

              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={
                  handleFileChange
                }
              />
            </label>

            {selectedFile && (
              <div
                style={{
                  marginTop:
                    8,

                  fontSize:
                    13,

                  color:
                    "#555",
                }}
              >
                {
                  selectedFile.name
                }

                {" / "}

                {
                  formatFileSize(
                    selectedFile.size
                  )
                }
              </div>
            )}
          </div>

          <div
            style={{
              display:
                "flex",

              justifyContent:
                "flex-end",

              marginTop:
                18,
            }}
          >
            <button
              type="button"
              className="button primary"
              disabled={
                uploading ||
                !selectedTestId ||
                !selectedSubjectId ||
                !selectedFile
              }
              onClick={
                handleUpload
              }
            >
              {uploading
                ? "登録中..."
                : "答案を登録"}
            </button>
          </div>
        </section>

        {/* ==================================================
            Summary
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(5, minmax(0, 1fr))",

            gap:
              10,

            marginTop:
              18,

            marginBottom:
              18,
          }}
        >
          <Summary
            label="表示答案"
            value={
              total
            }
          />

          <Summary
            label="受付済み"
            value={
              uploaded
            }
          />

          <Summary
            label="処理中"
            value={
              processing
            }
          />

          <Summary
            label="確認"
            value={
              review
            }
          />

          <Summary
            label="確定"
            value={
              confirmed
            }
          />
        </div>

        {/* ==================================================
            Filters
            ================================================== */}

        <section
          className="card"
          style={{
            marginBottom:
              16,
          }}
        >
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 220px 220px",

              gap:
                10,
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
              placeholder="生徒番号・氏名・テスト・教科"
            />

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
            >
              <option value="">
                全テスト
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
                    | AnswerStatus
                )
              }
            >
              <option value="all">
                全ステータス
              </option>

              <option value="uploaded">
                受付済み
              </option>

              <option value="processing">
                処理中
              </option>

              <option value="graded">
                採点済み
              </option>

              <option value="first_review">
                一次確認
              </option>

              <option value="second_review">
                二次確認
              </option>

              <option value="confirmed">
                確定
              </option>

              <option value="published">
                公開済み
              </option>

              <option value="error">
                エラー
              </option>
            </select>
          </div>
        </section>

        {/* ==================================================
            Main
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "minmax(0, 1.2fr) minmax(360px, 0.8fr)",

            gap:
              18,

            alignItems:
              "start",
          }}
        >

          {/* ================================================
              List
              ================================================ */}

          <section className="card">
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
                答案一覧
              </h2>

              <span className="muted">
                {
                  filteredAnswers.length
                }
                件
              </span>
            </div>

            {filteredAnswers.length ===
              0 && (
              <EmptyState />
            )}

            {filteredAnswers.length >
              0 && (
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
                        生徒
                      </th>

                      <th>
                        テスト
                      </th>

                      <th>
                        教科
                      </th>

                      <th>
                        状態
                      </th>

                      <th>
                        得点
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAnswers.map(
                      (
                        answer
                      ) => (
                        <tr
                          key={
                            answer.id
                          }
                          onClick={() =>
                            setSelectedAnswerId(
                              answer.id
                            )
                          }
                          style={{
                            cursor:
                              "pointer",

                            background:
                              selectedAnswerId ===
                              answer.id
                                ? "#f5f5f5"
                                : undefined,
                          }}
                        >
                          <td>
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
                              }}
                            >
                              {
                                answer.studentNumber ||
                                "生徒番号未設定"
                              }
                            </div>
                          </td>

                          <td>
                            {
                              answer.testName
                            }
                          </td>

                          <td>
                            {
                              answer.subjectName ||
                              "—"
                            }
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                answer.status
                              }
                            />
                          </td>

                          <td>
                            {
                              answer.totalScore
                            }
                            {" / "}
                            {
                              answer.totalMaxScore
                            }
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ================================================
              Preview
              ================================================ */}

          <section className="card">
            {!selectedAnswer ? (
              <EmptyPreview />
            ) : (
              <>
                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "flex-start",

                    gap:
                      10,

                    marginBottom:
                      14,
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin:
                          0,
                      }}
                    >
                      答案
                    </h2>

                    <p
                      className="muted"
                      style={{
                        margin:
                          "5px 0 0",
                      }}
                    >
                      {
                        selectedAnswer.studentName ||
                        "未紐付け"
                      }
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      selectedAnswer.status
                    }
                  />
                </div>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "1fr 1fr",

                    gap:
                      10,

                    marginBottom:
                      16,
                  }}
                >
                  <Info
                    label="生徒番号"
                    value={
                      selectedAnswer.studentNumber ||
                      "未設定"
                    }
                  />

                  <Info
                    label="テスト"
                    value={
                      selectedAnswer.testName
                    }
                  />

                  <Info
                    label="教科"
                    value={
                      selectedAnswer.subjectName ||
                      "—"
                    }
                  />

                  <Info
                    label="ファイル"
                    value={
                      selectedAnswer.fileName
                    }
                  />
                </div>

                {/* Image */}

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
                  ) : selectedImageUrl ? (
                    selectedAnswer.contentType ===
                    "application/pdf" ? (
                      <iframe
                        src={
                          selectedImageUrl
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
                          selectedImageUrl
                        }
                        alt="答案"
                        style={{
                          display:
                            "block",

                          maxWidth:
                            "100%",

                          maxHeight:
                            600,

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

                {/* Processing */}

                <div
                  style={{
                    marginTop:
                      16,
                  }}
                >
                  <h3>
                    処理状態
                  </h3>

                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(4, 1fr)",

                      gap:
                        8,
                    }}
                  >
                    <ProcessState
                      label="QR"
                      done={
                        Boolean(
                          selectedAnswer.qrText
                        )
                      }
                    />

                    <ProcessState
                      label="OCR"
                      done={
                        selectedAnswer.ocrConfidence >
                        0
                      }
                    />

                    <ProcessState
                      label="採点"
                      done={
                        selectedAnswer.status ===
                          "graded" ||
                        selectedAnswer.status ===
                          "first_review" ||
                        selectedAnswer.status ===
                          "second_review" ||
                        selectedAnswer.status ===
                          "confirmed" ||
                        selectedAnswer.status ===
                          "published"
                      }
                    />

                    <ProcessState
                      label="確定"
                      done={
                        selectedAnswer.status ===
                          "confirmed" ||
                        selectedAnswer.status ===
                          "published"
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "flex-end",

                    gap:
                      8,

                    marginTop:
                      18,
                  }}
                >
                  <Link
                    href="/grading"
                    className="button"
                  >
                    採点管理
                  </Link>

                  {(selectedAnswer.status ===
                    "first_review" ||
                    selectedAnswer.reviewRequired) && (
                    <Link
                      href="/grading/review"
                      className="button primary"
                    >
                      一次確認
                    </Link>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   Firestore answer query
   ========================================================= */

async function getAnswerDocuments(
  user: FirestoreUser
) {
  /*
   * answersQueries()をここで利用。
   *
   * これにより、
   *
   * 本部 → 組織全体
   * 校舎 → 所属校舎
   * 講師 → 所属校舎
   * 生徒 → 自分
   *
   * の範囲になる。
   */
  const {
    answersQueries,
  } =
    await import(
      "@/lib/firestore-scope"
    );

  return getScopedDocs(
    answersQueries(
      user
    )
  );
}

/* =========================================================
   Normalize Test
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
   Normalize Student
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
   Normalize Answer
   ========================================================= */

function normalizeAnswerListItem(
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
   Access
   ========================================================= */

function canViewAnswer(
  answer: Answer,
  user: FirestoreUser
) {
  if (
    !user.role
  ) {
    return false;
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return (
      answer.organizationId ===
      user.organizationId
    );
  }

  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    return (
      answer.organizationId ===
        user.organizationId &&
      user.schoolIds.includes(
        answer.schoolId
      )
    );
  }

  if (
    user.role ===
    "生徒"
  ) {
    return (
      answer.organizationId ===
        user.organizationId &&
      answer.studentId ===
        user.studentId
    );
  }

  return false;
}

/* =========================================================
   Status
   ========================================================= */

function normalizeStatus(
  value: unknown
): AnswerStatus {
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
   Status badge
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: AnswerStatus;
}) {
  return (
    <span
      style={{
        display:
          "inline-block",

        padding:
          "3px 8px",

        borderRadius:
          999,

        background:
          getStatusBackground(
            status
          ),

        fontSize:
          11,
      }}
    >
      {
        getStatusLabel(
          status
        )
      }
    </span>
  );
}

function getStatusLabel(
  status: AnswerStatus
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

function getStatusBackground(
  status: AnswerStatus
) {
  switch (
    status
  ) {
    case "error":
      return "#ffe5e5";

    case "confirmed":
    case "published":
      return "#e8f5e9";

    case "first_review":
    case "second_review":
      return "#fff4d6";

    case "processing":
      return "#e8eef8";

    default:
      return "#f1f1f1";
  }
}

/* =========================================================
   Summary
   ========================================================= */

function Summary({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <div className="card">
      <div
        className="muted"
        style={{
          fontSize:
            11,
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
            4,

          fontSize:
            23,
        }}
      >
        {
          value
        }
      </strong>
    </div>
  );
}

/* =========================================================
   Info
   ========================================================= */

function Info({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div
      style={{
        padding:
          10,

        background:
          "#f7f7f7",

        borderRadius:
          6,
      }}
    >
      <div
        className="muted"
        style={{
          fontSize:
            10,
        }}
      >
        {
          label
        }
      </div>

      <div
        style={{
          marginTop:
            3,

          fontSize:
            13,
        }}
      >
        {
          value
        }
      </div>
    </div>
  );
}

/* =========================================================
   Process
   ========================================================= */

function ProcessState({
  label,
  done,
}: {
  label: string;

  done: boolean;
}) {
  return (
    <div
      style={{
        padding:
          10,

        border:
          "1px solid #ddd",

        borderRadius:
          7,

        textAlign:
          "center",

        background:
          done
            ? "#f1f8f2"
            : "#fff",
      }}
    >
      <div
        style={{
          fontSize:
            11,

          color:
            "#777",
        }}
      >
        {
          label
        }
      </div>

      <strong>
        {done
          ? "完了"
          : "未処理"}
      </strong>
    </div>
  );
}

/* =========================================================
   Empty
   ========================================================= */

function EmptyState() {
  return (
    <div
      style={{
        padding:
          50,

        textAlign:
          "center",
      }}
    >
      <strong>
        答案がありません
      </strong>

      <p className="muted">
        まだ答案が登録されていません。
        <br />
        答案を登録すると、ここに表示されます。
      </p>
    </div>
  );
}

function EmptyPreview() {
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
          左側の答案一覧から答案を選択すると、
          <br />
          答案画像と処理状況を確認できます。
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   File size
   ========================================================= */

function formatFileSize(
  size: number
) {
  if (
    size <
    1024
  ) {
    return `${size} B`;
  }

  if (
    size <
    1024 *
      1024
  ) {
    return `${(
      size /
      1024
    ).toFixed(
      1
    )} KB`;
  }

  return `${(
    size /
    (1024 *
      1024)
  ).toFixed(
    1
  )} MB`;
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
