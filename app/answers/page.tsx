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

type Student = {
  id: string;

  organizationId: string;

  schoolId: string;

  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  active: boolean;
};

type UploadItem = {
  id: string;

  file: File;

  previewUrl: string;

  status:
    | "待機"
    | "アップロード中"
    | "完了"
    | "エラー";

  message?: string;

  storagePath?: string;
};

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
    students,
    setStudents,
  ] =
    useState<Student[]>([]);

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState("");

  const [
    selectedStudentId,
    setSelectedStudentId,
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

  const [
    searchStudent,
    setSearchStudent,
  ] =
    useState("");

  /*
   * ========================================================
   * Authentication
   * ========================================================
   */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
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
          } catch (
            err
          ) {
            console.error(
              "Answer auth error:",
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
   * Load tests / students
   * ========================================================
   */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadData(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadData(
    organizationId: string
  ) {
    try {
      setLoading(true);

      setError("");

      const [
        testSnapshot,
        studentSnapshot,
      ] =
        await Promise.all([
          getDocs(
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
          ),

          getDocs(
            query(
              collection(
                db,
                "students"
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
          ),
        ]);

      const loadedTests =
        testSnapshot.docs.map(
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

      const loadedStudents =
        studentSnapshot.docs.map(
          (
            item
          ): Student => {
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

              studentNumber:
                typeof data.studentNumber ===
                "string"
                  ? data.studentNumber
                  : "",

              name:
                typeof data.name ===
                "string"
                  ? data.name
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

              active:
                data.active !==
                false,
            };
          }
        );

      setTests(
        loadedTests
      );

      setStudents(
        loadedStudents
      );
    } catch (
      err
    ) {
      console.error(
        "Answer data error:",
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
   * Selected data
   * ========================================================
   */

  const selectedTest =
    tests.find(
      (
        test
      ) =>
        test.id ===
        selectedTestId
    );

  const availableStudents =
    useMemo(() => {
      const keyword =
        searchStudent
          .trim()
          .toLowerCase();

      let result =
        students;

      if (
        selectedTest
      ) {
        result =
          result.filter(
            (
              student
            ) =>
              student.schoolId ===
              selectedTest.schoolId
          );
      }

      if (
        currentUser?.role !==
        "本部管理者"
      ) {
        result =
          result.filter(
            (
              student
            ) =>
              currentUser?.schoolIds.includes(
                student.schoolId
              )
          );
      }

      if (
        keyword
      ) {
        result =
          result.filter(
            (
              student
            ) =>
              student.name
                .toLowerCase()
                .includes(
                  keyword
                ) ||
              student.studentNumber.includes(
                keyword
              ) ||
              student.className
                .toLowerCase()
                .includes(
                  keyword
                )
          );
      }

      return result;
    }, [
      students,
      selectedTest,
      currentUser,
      searchStudent,
    ]);

  /*
   * ========================================================
   * File selection
   * ========================================================
   */

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

    const items: UploadItem[] =
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
        ...items,
      ]
    );

    event.target.value =
      "";
  }

  /*
   * ========================================================
   * Remove file
   * ========================================================
   */

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

  /*
   * ========================================================
   * Upload
   * ========================================================
   */

  async function uploadAnswers() {
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
      !selectedStudentId
    ) {
      setError(
        "生徒を選択してください。"
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

    const student =
      students.find(
        (
          item
        ) =>
          item.id ===
          selectedStudentId
      );

    if (
      !student
    ) {
      setError(
        "生徒情報を確認できません。"
      );

      return;
    }

    /*
     * 校舎権限
     */

    if (
      currentUser.role !==
        "本部管理者" &&
      !currentUser.schoolIds.includes(
        student.schoolId
      )
    ) {
      setError(
        "この生徒の答案を登録する権限がありません。"
      );

      return;
    }

    try {
      setUploading(true);

      /*
       * 1枚ずつ処理。
       */

      for (
        const item of files
      ) {
        if (
          item.status ===
          "完了"
        ) {
          continue;
        }

        updateFileStatus(
          item.id,
          "アップロード中"
        );

        try {
          const safeName =
            sanitizeFileName(
              item.file.name
            );

          const timestamp =
            Date.now();

          const storagePath =
            `${currentUser.organizationId}/` +
            `${selectedTest.id}/` +
            `${student.studentNumber}/` +
            `${timestamp}-${safeName}`;

          if (
            !supabase
          ) {
            throw new Error(
              "Storageに接続できません。"
            );
          }

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
                    item.file.type ||
                    "image/jpeg",

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
           * 答案情報。
           *
           * 答案画像はStorage、
           * メタデータはFirestore。
           */

          await addDoc(
            collection(
              db,
              "answers"
            ),
            {
              organizationId:
                currentUser.organizationId,

              testId:
                selectedTest.id,

              testCode:
                selectedTest.testId,

              studentId:
                student.id,

              studentNumber:
                student.studentNumber,

              schoolId:
                student.schoolId,

              storagePath,

              originalFileName:
                item.file.name,

              contentType:
                item.file.type,

              fileSize:
                item.file.size,

              status:
                "採点待ち",

              gradingStatus:
                "未採点",

              ocrStatus:
                "未処理",

              firstReviewStatus:
                "未確認",

              secondReviewStatus:
                "未確認",

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

          updateFileStatus(
            item.id,
            "完了",
            undefined,
            storagePath
          );
        } catch (
          error
        ) {
          console.error(
            "Answer upload item error:",
            error
          );

          updateFileStatus(
            item.id,
            "エラー",
            getSafeErrorMessage(
              error
            )
          );
        }
      }

      const failed =
        files.filter(
          (
            item
          ) =>
            item.status ===
            "エラー"
        ).length;

      if (
        failed ===
        0
      ) {
        setMessage(
          "答案を受付しました。採点待ちとして登録されています。"
        );
      } else {
        setMessage(
          "一部の答案を受付できませんでした。エラー内容を確認してください。"
        );
      }
    } finally {
      setUploading(false);
    }
  }

  /*
   * ========================================================
   * File status
   * ========================================================
   */

  function updateFileStatus(
    id: string,
    status: UploadItem["status"],
    message?: string,
    storagePath?: string
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
                }
              : item
        )
    );
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
            答案受付
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
            1300,

          margin:
            "0 auto",
        }}
      >
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
            既存答案を登録し、採点待ちとして受付します。
          </p>
        </header>

        {error && (
          <div
            style={
              errorStyle
            }
          >
            {error}
          </div>
        )}

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
            テスト・生徒
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            答案情報
          </h2>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",

              gap:
                16,

              marginTop:
                18,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              テスト

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

                  setSelectedStudentId(
                    ""
                  );
                }}
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

            <label
              style={
                labelStyle
              }
            >
              生徒検索

              <input
                value={
                  searchStudent
                }
                onChange={(
                  event
                ) =>
                  setSearchStudent(
                    event.target
                      .value
                  )
                }
                placeholder="氏名・生徒番号・クラス"
                style={
                  inputStyle
                }
              />
            </label>

            <label
              style={
                labelStyle
              }
            >
              生徒

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
                style={
                  inputStyle
                }
              >
                <option value="">
                  生徒を選択してください
                </option>

                {availableStudents.map(
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
                      {" — "}
                      {
                        student.name
                      }
                      {student.className
                        ? ` / ${student.className}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          {selectedTest && (
            <div
              style={{
                marginTop:
                  18,

                padding:
                  14,

                background:
                  "#f7f7f7",

                borderRadius:
                  8,

                fontSize:
                  13,
              }}
            >
              <strong>
                選択テスト：
              </strong>

              {" "}

              {
                selectedTest.testId
              }

              {" — "}

              {
                selectedTest.name
              }

              {" / "}

              {
                selectedTest.subject
              }
            </div>
          )}
        </section>

        {/* ==================================================
            QR受付
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            QR受付
          </h2>

          <p
            style={{
              color:
                "#666",

              lineHeight:
                1.7,

              fontSize:
                13,
            }}
          >
            正式版では、ここで答案用紙のテストID QRと生徒QRを読み取り、テストと生徒を自動特定します。
          </p>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",

              gap:
                16,

              marginTop:
                16,
            }}
          >
            <button
              type="button"
              disabled={
                uploading
              }
              style={
                qrButtonStyle
              }
              onClick={() =>
                setError(
                  "QR読み取り機能を開始するにはカメラ読み取りモジュールを接続します。現在はテスト・生徒を選択して答案を受付できます。"
                )
              }
            >
              テストID QRを読み取る
            </button>

            <button
              type="button"
              disabled={
                uploading
              }
              style={
                qrButtonStyle
              }
              onClick={() =>
                setError(
                  "QR読み取り機能を開始するにはカメラ読み取りモジュールを接続します。現在はテスト・生徒を選択して答案を受付できます。"
                )
              }
            >
              生徒QRを読み取る
            </button>
          </div>
        </section>

        {/* ==================================================
            ファイル
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            答案画像
          </h2>

          <label
            style={{
              display:
                "inline-flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              padding:
                "11px 20px",

              border:
                "1px solid #ccc",

              borderRadius:
                7,

              background:
                "#fff",

              cursor:
                "pointer",

              fontWeight:
                600,
            }}
          >
            答案画像を選択

            <input
              type="file"
              accept="image/*"
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

          <p
            style={{
              marginTop:
                10,

              color:
                "#777",

              fontSize:
                12,
            }}
          >
            JPG・PNG・WebPなどの画像を選択できます。
          </p>

          {files.length >
            0 && (
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
                          6,

                        fontWeight:
                          600,

                        fontSize:
                          12,

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

                    {item.message && (
                      <div
                        style={{
                          marginTop:
                            6,

                          fontSize:
                            12,

                          color:
                            "#a00000",
                        }}
                      >
                        {
                          item.message
                        }
                      </div>
                    )}

                    {item.status ===
                      "待機" && (
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
          )}
        </section>

        {/* ==================================================
            受付
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
              !selectedStudentId ||
              files.length ===
                0
            }
            onClick={
              uploadAnswers
            }
            style={{
              ...primaryButton,

              opacity:
                uploading ||
                !selectedTest ||
                !selectedStudentId ||
                files.length ===
                  0
                  ? 0.5
                  : 1,
            }}
          >
            {uploading
              ? "答案を受付中..."
              : "答案を受付して採点待ちにする"}
          </button>
        </section>
      </div>
    </main>
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

    case "storage/object-not-found":
      return "答案画像が見つかりません。";

    case "storage/unauthorized":
      return "答案画像を保存する権限がありません。";

    case "storage/canceled":
      return "画像のアップロードがキャンセルされました。";

    case "storage/unknown":
      return "答案画像の保存中に問題が発生しました。";

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからお試しください。";

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

const labelStyle:
  React.CSSProperties = {
    display:
      "block",

    fontWeight:
      600,
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

const qrButtonStyle:
  React.CSSProperties = {
    padding:
      "16px",

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
