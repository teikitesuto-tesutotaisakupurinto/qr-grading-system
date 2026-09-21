"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
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

/* =========================================================
   Types
   ========================================================= */

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type CurrentUser = {
  uid: string;

  organizationId:
    | string
    | null;

  role:
    | UserRole
    | null;

  schoolIds: string[];
};

type Test = {
  id: string;

  organizationId: string;

  schoolId: string;

  testId: string;

  name: string;

  subject: string;

  grade: string;

  className: string;

  examDate: string;

  totalScore: number;

  active: boolean;
};

type UploadItem = {
  id: string;

  file: File;

  previewUrl: string;

  status:
    | "待機"
    | "アップロード中"
    | "QR解析待ち"
    | "完了"
    | "エラー";

  message?: string;

  storagePath?: string;

  answerId?: string;
};

/* =========================================================
   Page
   ========================================================= */

export default function AnswersPage() {
  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<CurrentUser | null>(
      null
    );

  const [
    tests,
    setTests,
  ] =
    useState<Test[]>([]);

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState("");

  const [
    files,
    setFiles,
  ] =
    useState<UploadItem[]>([]);

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
     Authentication
     ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          /*
           * ログアウト状態でも
           * /loginへ勝手に戻さない。
           */
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

            const schoolIds =
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
                : [];

            setCurrentUser({
              uid:
                firebaseUser.uid,

              organizationId:
                typeof data.organizationId ===
                "string"
                  ? data.organizationId
                  : null,

              role,

              schoolIds,
            });
          } catch (
            err
          ) {
            console.error(
              "Answer authentication error:",
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

  /* =======================================================
     Load tests
     ======================================================= */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadTests(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadTests(
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
              "tests"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            ),
            where(
              "active",
              "==",
              true
            )
          )
        );

      const loadedTests =
        snapshot.docs.map(
          (
            item
          ): Test => {
            const data =
              item.data();

            return {
              id:
                item.id,

              organizationId,

              schoolId:
                typeof data.schoolId ===
                "string"
                  ? data.schoolId
                  : "",

              testId:
                typeof data.testId ===
                "string"
                  ? data.testId
                  : "",

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : "",

              subject:
                typeof data.subject ===
                "string"
                  ? data.subject
                  : "",

              grade:
                typeof data.grade ===
                "string"
                  ? data.grade
                  : "",

              className:
                typeof data.className ===
                "string"
                  ? data.className
                  : "",

              examDate:
                typeof data.examDate ===
                "string"
                  ? data.examDate
                  : "",

              totalScore:
                typeof data.totalScore ===
                "number"
                  ? data.totalScore
                  : 0,

              active:
                data.active !==
                false,
            };
          }
        );

      /*
       * 本部管理者以外は、
       * 所属校舎のテストだけ。
       */

      const availableTests =
        currentUser?.role ===
        "本部管理者"
          ? loadedTests
          : loadedTests.filter(
              (
                test
              ) =>
                currentUser?.schoolIds.includes(
                  test.schoolId
                )
            );

      setTests(
        availableTests
      );
    } catch (
      err
    ) {
      console.error(
        "Test loading error:",
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
    );

  /* =======================================================
     File selection
     ======================================================= */

  function handleFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles =
      Array.from(
        event.target.files ??
          []
      );

    if (
      selectedFiles.length ===
      0
    ) {
      return;
    }

    setError("");
    setMessage("");

    const invalidFiles =
      selectedFiles.filter(
        (
          file
        ) =>
          !isSupportedImage(
            file
          )
      );

    if (
      invalidFiles.length >
      0
    ) {
      setError(
        "対応していない画像形式が含まれています。JPG・PNG・WebPの答案画像を選択してください。"
      );

      return;
    }

    const newItems: UploadItem[] =
      selectedFiles.map(
        (
          file,
          index
        ) => ({
          id:
            `${Date.now()}-${index}-${file.name}`,

          file,

          previewUrl:
            URL.createObjectURL(
              file
            ),

          status:
            "待機",
        })
      );

    setFiles(
      (
        current
      ) => [
        ...current,
        ...newItems,
      ]
    );

    /*
     * inputをリセット。
     * 同じファイルを再度選択できるようにする。
     */
    event.target.value =
      "";
  }

  /* =======================================================
     Remove one file
     ======================================================= */

  function removeFile(
    id: string
  ) {
    setFiles(
      (
        current
      ) => {
        const item =
          current.find(
            (
              file
            ) =>
              file.id ===
              id
          );

        if (item) {
          URL.revokeObjectURL(
            item.previewUrl
          );
        }

        return current.filter(
          (
            file
          ) =>
            file.id !==
            id
        );
      }
    );
  }

  /* =======================================================
     Clear all
     ======================================================= */

  function clearFiles() {
    files.forEach(
      (
        item
      ) => {
        URL.revokeObjectURL(
          item.previewUrl
        );
      }
    );

    setFiles([]);
  }

  /* =======================================================
     Upload all
     ======================================================= */

  async function uploadAllAnswers() {
    if (
      uploading
    ) {
      return;
    }

    setError("");
    setMessage("");

    if (
      !currentUser?.organizationId
    ) {
      setError(
        "組織情報を確認できません。"
      );

      return;
    }

    if (
      !selectedTest
    ) {
      setError(
        "テストを選択してください。"
      );

      return;
    }

    if (
      files.length ===
      0
    ) {
      setError(
        "答案画像を選択してください。"
      );

      return;
    }

    /*
     * テストの校舎権限。
     */

    if (
      currentUser.role !==
      "本部管理者"
    ) {
      if (
        !currentUser.schoolIds.includes(
          selectedTest.schoolId
        )
      ) {
        setError(
          "このテストの答案を登録する権限がありません。"
        );

        return;
      }
    }

    try {
      setUploading(true);

      let successCount =
        0;

      let errorCount =
        0;

      /*
       * すべての画像を順番にStorageへ
       * アップロード。
       *
       * 将来的にはEdge Functionの
       * 非同期キューへ接続する。
       */

      for (
        const item of files
      ) {
        if (
          item.status ===
          "完了"
        ) {
          successCount++;
          continue;
        }

        updateFileStatus(
          item.id,
          "アップロード中"
        );

        try {
          const storagePath =
            createStoragePath(
              currentUser.organizationId,
              selectedTest,
              item.file
            );

          if (
            !supabase
          ) {
            throw new Error(
              "Storageに接続できません。"
            );
          }

          /*
           * Supabase Storage
           */

          const upload =
            await supabase.storage
              .from(
                ANSWERS_BUCKET
              )
              .upload(
                storagePath,
                item.file,
                {
                  contentType:
                    item.file.type,

                  upsert:
                    false,

                  cacheControl:
                    "3600",
                }
              );

          if (
            upload.error
          ) {
            console.error(
              "Storage upload error:",
              upload.error
            );

            throw new Error(
              "答案画像を保存できませんでした。"
            );
          }

          /*
           * Firestore answers
           *
           * この段階ではまだ
           * studentIdを確定しない。
           *
           * Edge Functionが画像内の
           * テストID QR / 生徒QRを解析して
           * 後から確定する。
           */

          const answerRef =
            await addDoc(
              collection(
                db,
                "answers"
              ),
              {
                organizationId:
                  currentUser.organizationId,

                /*
                 * アップロード時点で
                 * 選択したテスト。
                 */
                testId:
                  selectedTest.id,

                testCode:
                  selectedTest.testId,

                schoolId:
                  selectedTest.schoolId,

                /*
                 * 画像から自動認識するため
                 * 初期値はnull。
                 */
                studentId:
                  null,

                studentNumber:
                  null,

                storagePath,

                originalFileName:
                  item.file.name,

                contentType:
                  item.file.type,

                fileSize:
                  item.file.size,

                /*
                 * 受付状態
                 */
                status:
                  "QR解析待ち",

                /*
                 * QR解析
                 */
                qrStatus:
                  "未処理",

                qrError:
                  null,

                /*
                 * OCR
                 */
                ocrStatus:
                  "未処理",

                /*
                 * 採点
                 */
                gradingStatus:
                  "未採点",

                /*
                 * 確認
                 */
                firstReviewStatus:
                  "未確認",

                secondReviewStatus:
                  "未確認",

                /*
                 * 確定
                 */
                finalized:
                  false,

                uploadedBy:
                  currentUser.uid,

                createdAt:
                  serverTimestamp(),

                updatedAt:
                  serverTimestamp(),
              }
            );

          /*
           * ここでEdge Functionの
           * 非同期解析対象になる。
           *
           * 現時点では
           * 「QR解析待ち」。
           */

          updateFileStatus(
            item.id,
            "QR解析待ち",
            undefined,
            storagePath,
            answerRef.id
          );

          successCount++;
        } catch (
          itemError
        ) {
          console.error(
            "Answer upload item error:",
            itemError
          );

          updateFileStatus(
            item.id,
            "エラー",
            getSafeErrorMessage(
              itemError
            )
          );

          errorCount++;
        }
      }

      if (
        errorCount ===
        0
      ) {
        setMessage(
          `${successCount}枚の答案を受付しました。システム内部でQR解析を開始します。`
        );
      } else {
        setMessage(
          `${successCount}枚を受付しました。${errorCount}枚は受付できませんでした。`
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Bulk answer upload error:",
        error
      );

      setError(
        getSafeErrorMessage(
          error
        )
      );
    } finally {
      setUploading(false);
    }
  }

  /* =======================================================
     Update item
     ======================================================= */

  function updateFileStatus(
    id: string,
    status: UploadItem["status"],
    message?: string,
    storagePath?: string,
    answerId?: string
  ) {
    setFiles(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            id
              ? {
                  ...item,

                  status,

                  message,

                  storagePath,

                  answerId,
                }
              : item
        )
    );
  }

  /* =======================================================
     Progress
     ======================================================= */

  const progress =
    useMemo(() => {
      const total =
        files.length;

      if (
        total ===
        0
      ) {
        return {
          total: 0,
          completed: 0,
          waiting: 0,
          errors: 0,
          percent: 0,
        };
      }

      const completed =
        files.filter(
          (
            item
          ) =>
            item.status ===
            "完了"
        ).length;

      const waiting =
        files.filter(
          (
            item
          ) =>
            item.status ===
              "QR解析待ち" ||
            item.status ===
              "アップロード中"
        ).length;

      const errors =
        files.filter(
          (
            item
          ) =>
            item.status ===
            "エラー"
        ).length;

      return {
        total,

        completed,

        waiting,

        errors,

        percent: Math.round(
          (completed /
            total) *
            100
        ),
      };
    }, [
      files,
    ]);

  /* =======================================================
     Permission
     ======================================================= */

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
            答案受付
          </h1>

          <p>
            この機能を利用する権限がありません。
          </p>
        </section>
      </main>
    );
  }

  /* =======================================================
     UI
     ======================================================= */

  return (
    <main
      style={
        pageStyle
      }
    >
      <div
        style={{
          maxWidth:
            1400,

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
              28,
          }}
        >
          <h1
            style={{
              margin:
                "0 0 8px",
            }}
          >
            答案受付
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
            答案画像をまとめてアップロードしてください。
            テストID QRと生徒QRはシステムが画像から自動認識します。
          </p>
        </header>

        {/* ==================================================
            Error
            ================================================== */}

        {error && (
          <div
            style={
              errorStyle
            }
          >
            {error}
          </div>
        )}

        {/* ==================================================
            Message
            ================================================== */}

        {message && (
          <div
            style={
              successStyle
            }
          >
            {message}
          </div>
        )}

        {/* ==================================================
            Test
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            対象テスト
          </h2>

          <label
            style={{
              display:
                "block",

              marginTop:
                16,

              fontWeight:
                600,
            }}
          >
            テスト

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
              style={
                inputStyle
              }
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
                      test.testId
                    }
                    {" — "}
                    {
                      test.name
                    }
                    {" / "}
                    {
                      test.subject
                    }
                  </option>
                )
              )}
            </select>
          </label>

          {selectedTest && (
            <div
              style={{
                marginTop:
                  18,

                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",

                gap:
                  10,
              }}
            >
              <InfoBox
                label="テストID"
                value={
                  selectedTest.testId
                }
              />

              <InfoBox
                label="テスト名"
                value={
                  selectedTest.name
                }
              />

              <InfoBox
                label="教科"
                value={
                  selectedTest.subject
                }
              />

              <InfoBox
                label="学年"
                value={
                  selectedTest.grade
                }
              />

              <InfoBox
                label="満点"
                value={`${selectedTest.totalScore}点`}
              />
            </div>
          )}
        </section>

        {/* ==================================================
            Bulk upload
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            答案を一括アップロード
          </h2>

          <p
            style={{
              marginTop:
                8,

              color:
                "#666",

              fontSize:
                13,

              lineHeight:
                1.8,
            }}
          >
            複数の答案画像を一度に選択できます。
            各答案のテストID QRと生徒QRは、アップロード後にシステム内部で自動解析します。
          </p>

          <label
            style={{
              display:
                "inline-flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              marginTop:
                16,

              padding:
                "13px 22px",

              border:
                "1px solid #ccc",

              borderRadius:
                8,

              background:
                "#fff",

              cursor:
                "pointer",

              fontWeight:
                600,
            }}
          >
            答案画像をまとめて選択

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={
                handleFiles
              }
              style={{
                display:
                  "none",
              }}
            />
          </label>

          <div
            style={{
              marginTop:
                18,

              padding:
                16,

              background:
                "#f7f7f7",

              borderRadius:
                8,
            }}
          >
            <strong>
              選択枚数：
              {
                files.length
              }
              枚
            </strong>

            {files.length >
              0 && (
              <div
                style={{
                  marginTop:
                    12,

                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(4, 1fr)",

                  gap:
                    8,
                }}
              >
                <ProgressBox
                  label="全体"
                  value={
                    progress.total
                  }
                />

                <ProgressBox
                  label="受付済み"
                  value={
                    progress.completed
                  }
                />

                <ProgressBox
                  label="解析待ち"
                  value={
                    progress.waiting
                  }
                />

                <ProgressBox
                  label="エラー"
                  value={
                    progress.errors
                  }
                />
              </div>
            )}
          </div>

          {files.length >
            0 && (
            <div
              style={{
                marginTop:
                  18,
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  fontSize:
                    12,

                  color:
                    "#666",
                }}
              >
                <span>
                  受付進捗
                </span>

                <span>
                  {
                    progress.percent
                  }
                  %
                </span>
              </div>

              <div
                style={{
                  height:
                    8,

                  marginTop:
                    6,

                  overflow:
                    "hidden",

                  borderRadius:
                    999,

                  background:
                    "#e5e5e5",
                }}
              >
                <div
                  style={{
                    width:
                      `${progress.percent}%`,

                    height:
                      "100%",

                    background:
                      "#111",

                    transition:
                      "width .2s ease",
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            File list
            ================================================== */}

        {files.length >
          0 && (
          <section
            style={{
              ...cardStyle,

              marginBottom:
                20,
            }}
          >
            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "space-between",

                gap:
                  16,
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

              {!uploading && (
                <button
                  type="button"
                  onClick={
                    clearFiles
                  }
                  style={
                    secondaryButton
                  }
                >
                  すべて削除
                </button>
              )}
            </div>

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fill, minmax(220px, 1fr))",

                gap:
                  16,

                marginTop:
                  20,
              }}
            >
              {files.map(
                (
                  item
                ) => (
                  <article
                    key={
                      item.id
                    }
                    style={{
                      border:
                        "1px solid #e1e4e8",

                      borderRadius:
                        10,

                      padding:
                        12,

                      background:
                        "#fff",
                    }}
                  >
                    <img
                      src={
                        item.previewUrl
                      }
                      alt=""
                      style={{
                        width:
                          "100%",

                        height:
                          180,

                        objectFit:
                          "contain",

                        background:
                          "#f7f7f7",

                        borderRadius:
                          7,
                      }}
                    />

                    <div
                      style={{
                        marginTop:
                          10,

                        fontSize:
                          12,

                        fontWeight:
                          600,

                        wordBreak:
                          "break-all",
                      }}
                    >
                      {
                        item.file.name
                      }
                    </div>

                    <div
                      style={{
                        marginTop:
                          8,

                        fontSize:
                          12,

                        fontWeight:
                          600,

                        color:
                          getStatusColor(
                            item.status
                          ),
                      }}
                    >
                      {
                        item.status
                      }
                    </div>

                    {item.answerId && (
                      <div
                        style={{
                          marginTop:
                            5,

                          color:
                            "#777",

                          fontSize:
                            11,

                          wordBreak:
                            "break-all",
                        }}
                      >
                        受付ID：
                        {
                          item.answerId
                        }
                      </div>
                    )}

                    {item.message && (
                      <div
                        style={{
                          marginTop:
                            7,

                          color:
                            "#a00000",

                          fontSize:
                            12,

                          lineHeight:
                            1.5,
                        }}
                      >
                        {
                          item.message
                        }
                      </div>
                    )}

                    {item.status ===
                      "待機" &&
                      !uploading && (
                        <button
                          type="button"
                          onClick={() =>
                            removeFile(
                              item.id
                            )
                          }
                          style={{
                            marginTop:
                              10,

                            padding:
                              "6px 10px",

                            border:
                              "1px solid #ccc",

                            borderRadius:
                              6,

                            background:
                              "#fff",

                            cursor:
                              "pointer",
                          }}
                        >
                          削除
                        </button>
                      )}
                  </article>
                )
              )}
            </div>
          </section>
        )}

        {/* ==================================================
            Submit
            ================================================== */}

        <section
          style={
            cardStyle
          }
        >
          <button
            type="button"
            disabled={
              uploading ||
              !selectedTest ||
              files.length ===
                0
            }
            onClick={
              uploadAllAnswers
            }
            style={{
              ...primaryButton,

              opacity:
                uploading ||
                !selectedTest ||
                files.length ===
                  0
                  ? 0.5
                  : 1,
            }}
          >
            {uploading
              ? "答案を一括受付しています..."
              : `${files.length}枚の答案を一括受付`}
          </button>

          <p
            style={{
              margin:
                "12px 0 0",

              color:
                "#777",

              fontSize:
                12,

              lineHeight:
                1.7,

              textAlign:
                "center",
            }}
          >
            受付後、答案画像のQRはシステム内部で解析されます。
            テストID・生徒番号の手入力は不要です。
          </p>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   InfoBox
   ========================================================= */

function InfoBox({
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
          12,

        background:
          "#f7f7f7",

        borderRadius:
          7,
      }}
    >
      <div
        style={{
          color:
            "#777",

          fontSize:
            11,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display:
            "block",

          marginTop:
            4,

          fontSize:
            13,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

/* =========================================================
   ProgressBox
   ========================================================= */

function ProgressBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding:
          10,

        background:
          "#fff",

        border:
          "1px solid #e5e5e5",

        borderRadius:
          7,

        textAlign:
          "center",
      }}
    >
      <div
        style={{
          color:
            "#777",

          fontSize:
            11,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display:
            "block",

          marginTop:
            3,

          fontSize:
            18,
        }}
      >
        {value}
      </strong>
    </div>
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

function isSupportedImage(
  file: File
) {
  return (
    file.type ===
      "image/jpeg" ||
    file.type ===
      "image/png" ||
    file.type ===
      "image/webp"
  );
}

function sanitizeFileName(
  name: string
) {
  return name
    .replace(
      /[^\w.\-ぁ-んァ-ヶ一-龠]/g,
      "_"
    )
    .slice(
      0,
      150
    );
}

function createStoragePath(
  organizationId: string,
  test: Test,
  file: File
) {
  const timestamp =
    Date.now();

  const random =
    Math.random()
      .toString(36)
      .slice(
        2,
        10
      );

  const safeName =
    sanitizeFileName(
      file.name
    );

  return (
    `${organizationId}/` +
    `${test.id}/` +
    `${timestamp}-${random}-${safeName}`
  );
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

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからお試しください。";

    case "failed-precondition":
      return "現在この操作を実行できません。設定を確認してください。";

    case "storage/unauthorized":
      return "答案画像を保存する権限がありません。";

    case "storage/object-not-found":
      return "答案画像が見つかりません。";

    case "storage/canceled":
      return "答案画像のアップロードがキャンセルされました。";

    default:
      return "答案を処理できませんでした。";
  }
}

function getStatusColor(
  status: UploadItem["status"]
) {
  switch (
    status
  ) {
    case "完了":
      return "#28733f";

    case "QR解析待ち":
      return "#555";

    case "エラー":
      return "#a00000";

    case "アップロード中":
      return "#555";

    default:
      return "#777";
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
      "11px 12px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",
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

const secondaryButton:
  React.CSSProperties = {
    padding:
      "9px 14px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",

    cursor:
      "pointer",
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
