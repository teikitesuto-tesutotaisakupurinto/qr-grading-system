"use client";

import {
  useEffect,
  useMemo,
  useRef,
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
  getAnswers,
  uploadAnswers,
  deleteAnswer,
  type Answer,
} from "@/lib/answers";

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

type TestRow =
  Test & {
    displayName: string;
  };

type AnswerRow =
  Answer & {
    studentName: string;
    testName: string;
    subjectName: string;
  };

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  status:
    | "waiting"
    | "uploading"
    | "completed"
    | "error";
  error: string;
};

type UploadState =
  | "idle"
  | "uploading"
  | "completed"
  | "error";

/* =========================================================
   Page
   ========================================================= */

export default function AnswersPage() {
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
    useState("");

  const [
    answers,
    setAnswers,
  ] =
    useState<AnswerRow[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    testsLoading,
    setTestsLoading,
  ] =
    useState(true);

  const [
    detailLoading,
    setDetailLoading,
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

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      "all" | Answer["status"]
    >(
      "all"
    );

  const [
    selectedAnswerId,
    setSelectedAnswerId,
  ] =
    useState<
      string | null
    >(null);

  const [
    imageUrl,
    setImageUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    uploadItems,
    setUploadItems,
  ] =
    useState<UploadItem[]>(
      []
    );

  const [
    uploadState,
    setUploadState,
  ] =
    useState<UploadState>(
      "idle"
    );

  const [
    uploadProgress,
    setUploadProgress,
  ] =
    useState(0);

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  /* =======================================================
     Current user / initial load
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

      /*
       * テストは組織内の共通テストとして扱う。
       *
       * 校舎選択は行わない。
       */
      const testDocuments =
        await getScopedDocs(
          testsQueries(
            scopeUser
          )
        );

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
          )
          .map(
            (
              test
            ) => ({
              ...test,

              displayName:
                buildTestDisplayName(
                  test
                ),
            })
          )
          .sort(
            (
              a,
              b
            ) =>
              a.name.localeCompare(
                b.name,
                "ja"
              )
          );

      setTests(
        loadedTests
      );

      /*
       * 最初から1件目を選択。
       */
      if (
        loadedTests.length >
        0
      ) {
        setSelectedTestId(
          loadedTests[0].id
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Answers initialize error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "答案画面を読み込めませんでした。"
        )
      );
    } finally {
      setTestsLoading(
        false
      );

      setLoading(
        false
      );
    }
  }

  /* =======================================================
     Load answers for selected test
     ======================================================= */

  useEffect(() => {
    if (
      !selectedTestId
    ) {
      setAnswers([]);

      setSelectedAnswerId(
        null
      );

      return;
    }

    void loadAnswersForTest(
      selectedTestId
    );
  }, [
    selectedTestId,
  ]);

  async function loadAnswersForTest(
    testId: string
  ) {
    try {
      setDetailLoading(
        true
      );

      setError("");

      const loaded =
        await getAnswers(
          testId
        );

      const normalized =
        loaded
          .map(
            (
              answer
            ) =>
              normalizeAnswerRow(
                answer,
                tests
              )
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
        normalized
      );

      setSelectedAnswerId(
        (
          current: string | null
        ) => {
          if (
            current &&
            normalized.some(
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
            normalized[0]?.id ??
            null
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        "Answers load error:",
        error
      );

      setAnswers([]);

      setSelectedAnswerId(
        null
      );

      setError(
        toUserMessage(
          error,
          "答案を取得できませんでした。"
        )
      );
    } finally {
      setDetailLoading(
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
     File selection
     ======================================================= */

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files ??
          []
      );

    /*
     * 同じファイルをもう一度選択できるようにする。
     */
    event.target.value =
      "";

    if (
      files.length ===
      0
    ) {
      return;
    }

    setError("");
    setMessage("");

    const newItems =
      files
        .map(
          (
            file
          ) =>
            createUploadItem(
              file
            )
        );

    setUploadItems(
      (
        current: UploadItem[]
      ) =>
        [
          ...current,
          ...newItems,
        ]
    );

    setUploadState(
      "idle"
    );
  }

  function createUploadItem(
    file: File
  ): UploadItem {
    return {
      id:
        createClientId(),

      file,

      previewUrl:
        file.type.startsWith(
          "image/"
        )
          ? URL.createObjectURL(
              file
            )
          : "",

      status:
        "waiting",

      error:
        "",
    };
  }

  /* =======================================================
     Remove upload item
     ======================================================= */

  function removeUploadItem(
    id: string
  ) {
    setUploadItems(
      (
        current: UploadItem[]
      ) => {
        const item =
          current.find(
            (
              currentItem
            ) =>
              currentItem.id ===
              id
          );

        if (
          item?.previewUrl
        ) {
          URL.revokeObjectURL(
            item.previewUrl
          );
        }

        return current.filter(
          (
            currentItem
          ) =>
            currentItem.id !==
            id
        );
      }
    );
  }

  function clearUploadItems() {
    uploadItems.forEach(
      (
        item
      ) => {
        if (
          item.previewUrl
        ) {
          URL.revokeObjectURL(
            item.previewUrl
          );
        }
      }
    );

    setUploadItems(
      []
    );

    setUploadState(
      "idle"
    );

    setUploadProgress(
      0
    );
  }

  /* =======================================================
     Upload
     ======================================================= */

  async function handleUpload() {
    if (
      uploadState ===
      "uploading"
    ) {
      return;
    }

    if (
      !selectedTest
    ) {
      setError(
        "先にテストを選択してください。"
      );

      return;
    }

    if (
      uploadItems.length ===
      0
    ) {
      setError(
        "アップロードする答案を選択してください。"
      );

      return;
    }

    const invalid =
      uploadItems.filter(
        (
          item
        ) =>
          !isSupportedFile(
            item.file
          )
      );

    if (
      invalid.length >
      0
    ) {
      setError(
        "対応していないファイルがあります。PDF・JPG・JPEG・PNGを使用してください。"
      );

      return;
    }

    try {
      setUploadState(
        "uploading"
      );

      setUploadProgress(
        0
      );

      setError("");
      setMessage("");

      setUploadItems(
        (
          current: UploadItem[]
        ) =>
          current.map(
            (
              item
            ) => ({
              ...item,

              status:
                "waiting",

              error:
                "",
            })
          )
      );

      /*
       * subjectIdは答案登録APIの既存仕様上必要。
       *
       * テストのsubject文字列を使用する。
       * 校舎や生徒は指定しない。
       */
      const inputs =
        uploadItems.map(
          (
            item
          ) => ({
            testId:
              selectedTest.testId ||
              selectedTest.id,

            subjectId:
              selectedTest.subject ||
              selectedTest.id,

            file:
              item.file,
          })
        );

      /*
       * 既存uploadAnswersを使用。
       *
       * 生徒番号は渡さない。
       * 答案上の生徒QRから後段で特定する。
       */
      const uploaded =
        await uploadAnswers(
          inputs,
          (
            completed,
            total
          ) => {
            setUploadProgress(
              Math.round(
                completed /
                  total *
                  100
              )
            );

            setUploadItems(
              (
                current: UploadItem[]
              ) =>
                current.map(
                  (
                    item,
                    index
                  ) =>
                    index <
                    completed
                      ? {
                          ...item,

                          status:
                            "completed",
                        }
                      : item
                )
            );
          }
        );

      /*
       * アップロードされた答案を
       * 完了状態へ。
       */
      setUploadItems(
        (
          current: UploadItem[]
        ) =>
          current.map(
            (
              item
            ) => ({
              ...item,

              status:
                "completed",

              error:
                "",
            })
          )
      );

      setUploadProgress(
        100
      );

      setUploadState(
        "completed"
      );

      setMessage(
        `${uploaded.length}件の答案を受け付けました。QR読み取り・答案処理後、採点対象になります。`
      );

      await loadAnswersForTest(
        selectedTest.id
      );
    } catch (
      error
    ) {
      console.error(
        "Answer upload error:",
        error
      );

      setUploadState(
        "error"
      );

      setUploadItems(
        (
          current: UploadItem[]
        ) =>
          current.map(
            (
              item
            ) => ({
              ...item,

              status:
                "error",

              error:
                toUserMessage(
                  error,
                  "アップロードに失敗しました。"
                ),
            })
          )
      );

      setError(
        toUserMessage(
          error,
          "答案をアップロードできませんでした。"
        )
      );
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
     Load selected image
     ======================================================= */

  useEffect(() => {
    if (
      !selectedAnswer
    ) {
      setImageUrl(
        null
      );

      return;
    }

    void loadSelectedImage(
      selectedAnswer.id
    );
  }, [
    selectedAnswerId,
  ]);

  async function loadSelectedImage(
    answerId: string
  ) {
    try {
      setDetailLoading(
        true
      );

      setImageUrl(
        null
      );

      const result =
        await getAnswerWithUrl(
          answerId
        );

      if (
        result
      ) {
        setImageUrl(
          result.signedUrl
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Answer image load error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "答案画像を取得できませんでした。"
        )
      );
    } finally {
      setDetailLoading(
        false
      );
    }
  }

  /* =======================================================
     Delete
     ======================================================= */

  async function handleDelete() {
    if (
      !selectedAnswer
    ) {
      return;
    }

    if (
      role !==
        "本部管理者" &&
      role !==
        "校舎管理者"
    ) {
      setError(
        "答案を削除する権限がありません。"
      );

      return;
    }

    if (
      selectedAnswer.status ===
        "confirmed" ||
      selectedAnswer.status ===
        "published"
    ) {
      setError(
        "確定済みの答案は削除できません。"
      );

      return;
    }

    if (
      !window.confirm(
        "この答案を削除しますか？\n答案画像も削除されます。"
      )
    ) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await deleteAnswer(
        selectedAnswer.id
      );

      setMessage(
        "答案を削除しました。"
      );

      setSelectedAnswerId(
        null
      );

      setImageUrl(
        null
      );

      if (
        selectedTestId
      ) {
        await loadAnswersForTest(
          selectedTestId
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Answer delete error:",
        error
      );

      setError(
        toUserMessage(
          error,
          "答案を削除できませんでした。"
        )
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

      return answers.filter(
        (
          answer
        ) => {
          const statusMatch =
            statusFilter ===
              "all" ||
            answer.status ===
              statusFilter;

          const searchMatch =
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
              ) ||
            answer.fileName
              .toLowerCase()
              .includes(
                keyword
              );

          return (
            statusMatch &&
            searchMatch
          );
        }
      );
    }, [
      answers,
      search,
      statusFilter,
    ]);

  /* =======================================================
     Statistics
     ======================================================= */

  const uploadedCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "uploaded"
    ).length;

  const processingCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "processing"
    ).length;

  const gradedCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "graded"
    ).length;

  const firstReviewCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "first_review"
    ).length;

  const secondReviewCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "second_review"
    ).length;

  const confirmedCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
          "confirmed" ||
        answer.status ===
          "published"
    ).length;

  const errorCount =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "error"
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
            答案
          </h1>

          <p>
            答案管理を読み込んでいます...
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
              答案
            </h1>

            <p className="muted">
              テストを選択してから答案をアップロードします。
            </p>
          </div>

          <Link
            href="/grading"
            className="button"
          >
            採点へ
          </Link>
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
            Test selection
            ================================================== */}

        <section className="card">
          <h2>
            1. テストを選択
          </h2>

          <p
            className="muted"
            style={{
              margin:
                "5px 0 12px",

              fontSize:
                12,
            }}
          >
            校舎や生徒を指定する必要はありません。テストを選択した後、答案をアップロードします。
          </p>

          {testsLoading ? (
            <p>
              テストを読み込んでいます...
            </p>
          ) : tests.length ===
            0 ? (
            <div
              style={{
                padding:
                  24,

                border:
                  "1px solid #eee",

                borderRadius:
                  8,

                color:
                  "#777",
              }}
            >
              <strong>
                利用できるテストがありません。
              </strong>

              <p
                style={{
                  margin:
                    "6px 0 0",

                  fontSize:
                    12,
                }}
              >
                管理者が作成したテストが登録されると、ここから選択できます。
              </p>
            </div>
          ) : (
            <select
              value={
                selectedTestId
              }
              onChange={(
                event
              ) => {
                setSelectedTestId(
                  event.target
                    .value
                );

                /*
                 * テスト変更時に
                 * アップロード候補をクリア。
                 */
                clearUploadItems();

                setError("");
                setMessage("");
              }}
              style={{
                width:
                  "100%",

                maxWidth:
                  700,
              }}
            >
              <option value="">
                テストを選択してください
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
                      test.displayName
                    }
                  </option>
                )
              )}
            </select>
          )}

          {selectedTest && (
            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",

                gap:
                  10,

                marginTop:
                  14,
              }}
            >
              <Info
                label="テストID"
                value={
                  selectedTest.testId ||
                  selectedTest.id
                }
              />

              <Info
                label="教科"
                value={
                  selectedTest.subject ||
                  "—"
                }
              />

              <Info
                label="実施日"
                value={
                  selectedTest.examDate ||
                  "—"
                }
              />
            </div>
          )}
        </section>

        {/* ==================================================
            Upload
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >
          <h2>
            2. 答案をアップロード
          </h2>

          <p
            className="muted"
            style={{
              margin:
                "5px 0 12px",

              fontSize:
                12,
            }}
          >
            テストを選択してから答案画像を選択してください。生徒番号・校舎の入力は不要です。
          </p>

          <input
            ref={
              fileInputRef
            }
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
            multiple
            onChange={
              handleFileChange
            }
            disabled={
              !selectedTest ||
              uploadState ===
                "uploading"
            }
            style={{
              display:
                "none",
            }}
          />

          <button
            type="button"
            className="button"
            disabled={
              !selectedTest ||
              uploadState ===
                "uploading"
            }
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            答案ファイルを選択
          </button>

          {selectedTest && (
            <span
              className="muted"
              style={{
                marginLeft:
                  10,

                fontSize:
                  11,
              }}
            >
              PDF / JPG / JPEG / PNG
            </span>
          )}

          {/* Upload preview */}

          {uploadItems.length >
            0 && (
            <div
              style={{
                marginTop:
                  16,
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

                  marginBottom:
                    10,
                }}
              >
                <strong>
                  選択した答案
                </strong>

                <button
                  type="button"
                  className="button"
                  disabled={
                    uploadState ===
                    "uploading"
                  }
                  onClick={
                    clearUploadItems
                  }
                >
                  すべて解除
                </button>
              </div>

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(180px, 1fr))",

                  gap:
                    10,
                }}
              >
                {uploadItems.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      style={{
                        padding:
                          10,

                        border:
                          "1px solid #ddd",

                        borderRadius:
                          8,

                        background:
                          "#fff",
                      }}
                    >
                      {item.previewUrl ? (
                        <img
                          src={
                            item.previewUrl
                          }
                          alt={
                            item.file.name
                          }
                          style={{
                            display:
                              "block",

                            width:
                              "100%",

                            height:
                              140,

                            objectFit:
                              "contain",

                            background:
                              "#f7f7f7",

                            borderRadius:
                              5,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            height:
                              140,

                            display:
                              "flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "center",

                            background:
                              "#f7f7f7",

                            borderRadius:
                              5,

                            color:
                              "#777",

                            fontSize:
                              12,
                          }}
                        >
                          PDF
                        </div>
                      )}

                      <div
                        style={{
                          marginTop:
                            8,

                          fontSize:
                            11,

                          overflow:
                            "hidden",

                          textOverflow:
                            "ellipsis",

                          whiteSpace:
                            "nowrap",
                        }}
                        title={
                          item.file.name
                        }
                      >
                        {
                          item.file.name
                        }
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop:
                            3,

                          fontSize:
                            10,
                        }}
                      >
                        {
                          formatFileSize(
                            item.file.size
                          )
                        }
                      </div>

                      <div
                        style={{
                          marginTop:
                            8,

                          fontSize:
                            10,
                        }}
                      >
                        {item.status ===
                          "completed" &&
                          "アップロード済み"}

                        {item.status ===
                          "uploading" &&
                          "アップロード中..."}

                        {item.status ===
                          "waiting" &&
                          "待機中"}

                        {item.status ===
                          "error" &&
                          "エラー"}
                      </div>

                      {item.error && (
                        <div
                          style={{
                            marginTop:
                              5,

                            color:
                              "#a00000",

                            fontSize:
                              10,
                          }}
                        >
                          {
                            item.error
                          }
                        </div>
                      )}

                      <button
                        type="button"
                        className="button"
                        disabled={
                          uploadState ===
                          "uploading"
                        }
                        onClick={() =>
                          removeUploadItem(
                            item.id
                          )
                        }
                        style={{
                          marginTop:
                            8,

                          width:
                            "100%",
                        }}
                      >
                        解除
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* Progress */}

              {uploadState ===
                "uploading" && (
                <div
                  style={{
                    marginTop:
                      16,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      fontSize:
                        11,

                      marginBottom:
                        5,
                    }}
                  >
                    <span>
                      アップロード中
                    </span>

                    <span>
                      {
                        uploadProgress
                      }
                      %
                    </span>
                  </div>

                  <div
                    style={{
                      height:
                        8,

                      background:
                        "#eee",

                      borderRadius:
                        999,

                      overflow:
                        "hidden",
                    }}
                  >
                    <div
                      style={{
                        width:
                          `${uploadProgress}%`,

                        height:
                          "100%",

                        background:
                          "#222",

                        transition:
                          "width .2s ease",
                      }}
                    />
                  </div>
                </div>
              )}

              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "flex-end",

                  marginTop:
                    16,
                }}
              >
                <button
                  type="button"
                  className="button primary"
                  disabled={
                    !selectedTest ||
                    uploadItems.length ===
                      0 ||
                    uploadState ===
                      "uploading"
                  }
                  onClick={
                    handleUpload
                  }
                >
                  {uploadState ===
                  "uploading"
                    ? "アップロード中..."
                    : `${uploadItems.length}件をアップロード`}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            Statistics
            ================================================== */}

        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(7, minmax(0, 1fr))",

            gap:
              8,

            marginTop:
              16,
          }}
        >
          <StatCard
            label="受付済み"
            value={
              uploadedCount
            }
          />

          <StatCard
            label="処理中"
            value={
              processingCount
            }
          />

          <StatCard
            label="採点済み"
            value={
              gradedCount
            }
          />

          <StatCard
            label="一次確認"
            value={
              firstReviewCount
            }
          />

          <StatCard
            label="二次確認"
            value={
              secondReviewCount
            }
          />

          <StatCard
            label="確定"
            value={
              confirmedCount
            }
          />

          <StatCard
            label="エラー"
            value={
              errorCount
            }
          />
        </section>

        {/* ==================================================
            Answer list
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 180px",

              gap:
                10,

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
              placeholder="生徒番号・氏名・ファイル名を検索"
            />

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value as
                    | "all"
                    | Answer["status"]
                )
              }
            >
              <option value="all">
                すべての状態
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

          {detailLoading ? (
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
              答案を読み込んでいます...
            </div>
          ) : filtered.length ===
            0 ? (
            <EmptyList
              hasSelectedTest={
                Boolean(
                  selectedTest
                )
              }
            />
          ) : (
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
                      生徒番号
                    </th>

                    <th>
                      氏名
                    </th>

                    <th>
                      ファイル
                    </th>

                    <th>
                      状態
                    </th>

                    <th>
                      得点
                    </th>

                    <th>
                      QR
                    </th>

                    <th>
                      OCR
                    </th>

                    <th>
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (
                      answer
                    ) => (
                      <tr
                        key={
                          answer.id
                        }
                        style={{
                          cursor:
                            "pointer",

                          background:
                            answer.id ===
                            selectedAnswerId
                              ? "#f7f7f7"
                              : undefined,
                        }}
                        onClick={() =>
                          setSelectedAnswerId(
                            answer.id
                          )
                        }
                      >
                        <td>
                          {
                            answer.studentNumber ??
                            "未特定"
                          }
                        </td>

                        <td>
                          {
                            answer.studentName ||
                            "未特定"
                          }
                        </td>

                        <td>
                          {
                            answer.fileName
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

                        <td>
                          {
                            formatConfidence(
                              answer.qrConfidence
                            )
                          }
                        </td>

                        <td>
                          {
                            formatConfidence(
                              answer.ocrConfidence
                            )
                          }
                        </td>

                        <td>
                          <button
                            type="button"
                            className="button"
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation();

                              setSelectedAnswerId(
                                answer.id
                              );
                            }}
                          >
                            開く
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ==================================================
            Detail
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >
          {!selectedAnswer ? (
            <EmptyDetail />
          ) : (
            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "minmax(0, 1fr) 360px",

                gap:
                  20,
              }}
            >
              {/* Image */}

              <div>
                <h2>
                  答案画像
                </h2>

                {detailLoading ? (
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

                      color:
                        "#777",
                    }}
                  >
                    画像を読み込んでいます...
                  </div>
                ) : imageUrl ? (
                  <div
                    style={{
                      padding:
                        10,

                      background:
                        "#f7f7f7",

                      borderRadius:
                        8,

                      overflow:
                        "auto",
                    }}
                  >
                    <img
                      src={
                        imageUrl
                      }
                      alt="答案画像"
                      style={{
                        display:
                          "block",

                        maxWidth:
                          "100%",

                        height:
                          "auto",

                        margin:
                          "0 auto",
                      }}
                    />
                  </div>
                ) : (
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

                      border:
                        "1px solid #eee",

                      borderRadius:
                        8,

                      color:
                        "#777",
                    }}
                  >
                    答案画像を表示できません。
                  </div>
                )}
              </div>

              {/* Information */}

              <div>
                <h2>
                  答案情報
                </h2>

                <div
                  style={{
                    display:
                      "grid",

                    gap:
                      8,
                  }}
                >
                  <Info
                    label="テスト"
                    value={
                      selectedAnswer.testName
                    }
                  />

                  <Info
                    label="生徒番号"
                    value={
                      selectedAnswer.studentNumber ??
                      "未特定"
                    }
                  />

                  <Info
                    label="氏名"
                    value={
                      selectedAnswer.studentName ||
                      "未特定"
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
                    label="状態"
                    value={
                      getStatusLabel(
                        selectedAnswer.status
                      )
                    }
                  />

                  <Info
                    label="得点"
                    value={`${selectedAnswer.totalScore} / ${selectedAnswer.totalMaxScore}`}
                  />

                  <Info
                    label="QR認識"
                    value={
                      formatConfidence(
                        selectedAnswer.qrConfidence
                      )
                    }
                  />

                  <Info
                    label="OCR認識"
                    value={
                      formatConfidence(
                        selectedAnswer.ocrConfidence
                      )
                    }
                  />

                  <Info
                    label="ファイル"
                    value={
                      selectedAnswer.fileName
                    }
                  />
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    flexWrap:
                      "wrap",

                    gap:
                      8,

                    marginTop:
                      16,
                  }}
                >
                  <Link
                    href={`/grading?answerId=${encodeURIComponent(
                      selectedAnswer.id
                    )}`}
                    className="button primary"
                  >
                    この答案を採点
                  </Link>

                  {(role ===
                    "本部管理者" ||
                    role ===
                      "校舎管理者") &&
                    selectedAnswer.status !==
                      "confirmed" &&
                    selectedAnswer.status !==
                      "published" && (
                      <button
                        type="button"
                        className="button"
                        onClick={
                          handleDelete
                        }
                      >
                        答案を削除
                      </button>
                    )}
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Test display
   ========================================================= */

function buildTestDisplayName(
  test: Test
) {
  const parts =
    [
      test.name,
      test.subject,
      test.grade,
      test.className,
    ].filter(
      (
        value
      ) =>
        Boolean(
          value
        )
    );

  return parts.join(
    " / "
  );
}

/* =========================================================
   Normalize answer
   ========================================================= */

function normalizeAnswerRow(
  answer: Answer,
  tests: TestRow[]
): AnswerRow {
  const test =
    tests.find(
      (
        item
      ) =>
        item.id ===
          answer.testId ||
        item.testId ===
          answer.testId
    );

  return {
    ...answer,

    studentName:
      "",

    testName:
      test?.name ??
      "テスト未設定",

    subjectName:
      test?.subject ??
      "",
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
   Status
   ========================================================= */

function getStatusLabel(
  status: Answer["status"]
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

/* =========================================================
   Status badge
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: Answer["status"];
}) {
  const background =
    status ===
      "confirmed" ||
    status ===
      "published"
      ? "#e8f5e9"
      : status ===
          "error"
        ? "#fff1f1"
        : status ===
            "first_review" ||
          status ===
            "second_review"
          ? "#fff4d6"
          : "#f1f1f1";

  return (
    <span
      style={{
        display:
          "inline-block",

        padding:
          "4px 8px",

        borderRadius:
          999,

        background,

        fontSize:
          10,

        whiteSpace:
          "nowrap",
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

/* =========================================================
   Stat card
   ========================================================= */

function StatCard({
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
            10,
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
            19,
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
          7,
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
            4,

          fontSize:
            12,

          wordBreak:
            "break-word",
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
   Empty
   ========================================================= */

function EmptyList({
  hasSelectedTest,
}: {
  hasSelectedTest: boolean;
}) {
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
        {hasSelectedTest
          ? "このテストの答案はありません。"
          : "テストを選択してください。"}
      </strong>

      {hasSelectedTest && (
        <p
          style={{
            fontSize:
              12,
          }}
        >
          上の「答案ファイルを選択」から答案をアップロードしてください。
        </p>
      )}
    </div>
  );
}

function EmptyDetail() {
  return (
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

        textAlign:
          "center",

        color:
          "#777",
      }}
    >
      答案を選択すると詳細を表示します。
    </div>
  );
}

/* =========================================================
   File validation
   ========================================================= */

function isSupportedFile(
  file: File
) {
  const name =
    file.name.toLowerCase();

  return (
    file.type ===
      "application/pdf" ||
    file.type ===
      "image/jpeg" ||
    file.type ===
      "image/png" ||
    name.endsWith(
      ".pdf"
    ) ||
    name.endsWith(
      ".jpg"
    ) ||
    name.endsWith(
      ".jpeg"
    ) ||
    name.endsWith(
      ".png"
    )
  );
}

/* =========================================================
   File size
   ========================================================= */

function formatFileSize(
  bytes: number
) {
  if (
    bytes <=
    0
  ) {
    return "—";
  }

  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 *
      1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(1)} MB`;
}

/* =========================================================
   Confidence
   ========================================================= */

function formatConfidence(
  value: number
) {
  if (
    !Number.isFinite(
      value
    ) ||
    value <=
      0
  ) {
    return "—";
  }

  const percentage =
    value <=
    1
      ? value *
        100
      : value;

  return `${percentage.toFixed(
    0
  )}%`;
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
    return "この操作を実行する権限がありません。ログイン状態と所属情報を確認してください。";
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
    message.includes(
      "not-found"
    ) ||
    message.includes(
      "NOT_FOUND"
    )
  ) {
    return "対象のデータが見つかりません。";
  }

  return (
    message ||
    fallback
  );
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

  const time =
    new Date(
      String(
        value ??
          ""
      )
    ).getTime();

  return Number.isFinite(
    time
  )
    ? time
    : 0;
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

/* =========================================================
   Client ID
   ========================================================= */

function createClientId() {
  if (
    typeof crypto !==
      "undefined" &&
    "randomUUID" in
      crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}
