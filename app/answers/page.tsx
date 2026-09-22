"use client";

import {
  useEffect,
  useMemo,
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
  deleteAnswer,
} from "@/lib/answers";

import {
  getScopedDocs,
  answersQueries,
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Answer,
  Student,
  Test,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type AnswerRow =
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
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

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
    detailLoading,
    setDetailLoading,
  ] =
    useState(false);

  const [
    deleting,
    setDeleting,
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
    selectedId,
    setSelectedId,
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

  /* =======================================================
     Load
     ======================================================= */

  useEffect(() => {
    void loadAnswers();
  }, []);

  async function loadAnswers() {
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

      const students =
        studentDocuments.map(
          (
            item
          ) =>
            normalizeStudent(
              item.id,
              item.data
            )
        );

      const tests =
        testDocuments.map(
          (
            item
          ) =>
            normalizeTest(
              item.id,
              item.data
            )
        );

      const loaded =
        answerDocuments
          .map(
            (
              item
            ) =>
              normalizeAnswer(
                item.id,
                item.data,
                students,
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
        loaded
      );

      setSelectedId(
        (
          current
        ) => {
          if (
            current &&
            loaded.some(
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
            loaded[0]?.id ??
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

      setError(
        error instanceof Error
          ? error.message
          : "答案を取得できませんでした。"
      );
    } finally {
      setLoading(false);
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

  const selected =
    answers.find(
      (
        answer
      ) =>
        answer.id ===
        selectedId
    ) ??
    null;

  /* =======================================================
     Load image
     ======================================================= */

  useEffect(() => {
    if (
      !selected
    ) {
      setImageUrl(
        null
      );

      return;
    }

    void loadSelectedImage(
      selected.id
    );
  }, [
    selectedId,
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
        error instanceof Error
          ? error.message
          : "答案画像を取得できませんでした。"
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
      !selected
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
      selected.status ===
        "confirmed" ||
      selected.status ===
        "published"
    ) {
      setError(
        "確定済みの答案は削除できません。"
      );

      return;
    }

    const confirmed =
      window.confirm(
        "この答案を削除しますか？\n答案画像もSupabase Storageから削除されます。"
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeleting(
        true
      );

      setError("");

      setMessage("");

      await deleteAnswer(
        selected.id
      );

      setMessage(
        "答案を削除しました。"
      );

      setSelectedId(
        null
      );

      setImageUrl(
        null
      );

      await loadAnswers();
    } catch (
      error
    ) {
      console.error(
        "Answer delete error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "答案を削除できませんでした。"
      );
    } finally {
      setDeleting(
        false
      );
    }
  }

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
            答案管理
          </h1>

          <p>
            答案を読み込んでいます...
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
              登録された答案と処理状況を確認します。
            </p>
          </div>

          <div
            style={{
              display:
                "flex",

              gap:
                8,
            }}
          >
            <Link
              href="/grading"
              className="button"
            >
              採点管理
            </Link>

            <Link
              href="/grading/review"
              className="button"
            >
              一次確認
            </Link>
          </div>
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
            Statistics
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(6, minmax(0, 1fr))",

            gap:
              10,

            marginBottom:
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
        </div>

        {/* ==================================================
            Filters
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 220px",

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
              placeholder="生徒番号・氏名・テスト名・ファイル名"
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
                すべて
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
              "minmax(0, 1.05fr) minmax(420px, .95fr)",

            gap:
              18,

            marginTop:
              16,

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

              <span
                className="muted"
                style={{
                  fontSize:
                    12,
                }}
              >
                {
                  filtered.length
                }
                件
              </span>
            </div>

            {filtered.length ===
            0 ? (
              <EmptyList />
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
                        生徒
                      </th>

                      <th>
                        テスト
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
                    {filtered.map(
                      (
                        answer
                      ) => (
                        <tr
                          key={
                            answer.id
                          }
                          onClick={() =>
                            setSelectedId(
                              answer.id
                            )
                          }
                          style={{
                            cursor:
                              "pointer",

                            background:
                              selectedId ===
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
                                "生徒番号なし"
                              }
                            </div>
                          </td>

                          <td>
                            {
                              answer.testName
                            }

                            <div
                              className="muted"
                              style={{
                                fontSize:
                                  11,
                              }}
                            >
                              {
                                answer.subjectName ||
                                "—"
                              }
                            </div>
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                answer.status
                              }
                            />
                          </td>

                          <td>
                            {answer.totalMaxScore >
                            0
                              ? `${answer.totalScore} / ${answer.totalMaxScore}`
                              : "—"}
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
              Detail
              ================================================ */}

          <section className="card">
            {!selected ? (
              <EmptyDetail />
            ) : detailLoading ? (
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
                }}
              >
                答案画像を読み込んでいます...
              </div>
            ) : (
              <>
                {/* Header */}

                <header
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "flex-start",

                    gap:
                      16,

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
                        selected.studentName ||
                        "生徒未紐付け"
                      }
                    </h2>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          5,

                        fontSize:
                          12,
                      }}
                    >
                      {
                        selected.studentNumber ||
                        "生徒番号なし"
                      }
                    </div>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          3,

                        fontSize:
                          12,
                      }}
                    >
                      {
                        selected.testName
                      }

                      {" / "}

                      {
                        selected.subjectName ||
                        "—"
                      }
                    </div>
                  </div>

                  <StatusBadge
                    status={
                      selected.status
                    }
                  />
                </header>

                {/* Image */}

                <section
                  style={{
                    marginTop:
                      18,
                  }}
                >
                  <h3>
                    答案画像
                  </h3>

                  <div
                    style={{
                      minHeight:
                        350,

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
                    {imageUrl ? (
                      selected.contentType ===
                      "application/pdf" ? (
                        <iframe
                          src={
                            imageUrl
                          }
                          title="答案"
                          style={{
                            width:
                              "100%",

                            height:
                              600,

                            border:
                              0,
                          }}
                        />
                      ) : (
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

                            maxHeight:
                              650,

                            objectFit:
                              "contain",
                          }}
                        />
                      )
                    ) : (
                      <div
                        style={{
                          textAlign:
                            "center",

                          color:
                            "#777",

                          padding:
                            30,
                        }}
                      >
                        答案画像を表示できません。
                      </div>
                    )}
                  </div>
                </section>

                {/* Metadata */}

                <section
                  style={{
                    marginTop:
                      18,
                  }}
                >
                  <h3>
                    ファイル情報
                  </h3>

                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "1fr 1fr",

                      gap:
                        10,
                    }}
                  >
                    <Info
                      label="ファイル名"
                      value={
                        selected.fileName
                      }
                    />

                    <Info
                      label="形式"
                      value={
                        selected.contentType
                      }
                    />

                    <Info
                      label="サイズ"
                      value={
                        formatFileSize(
                          selected.size
                        )
                      }
                    />

                    <Info
                      label="保存先"
                      value={
                        "Supabase Storage"
                      }
                    />

                    <Info
                      label="QR"
                      value={
                        selected.qrText ||
                        "未解析"
                      }
                    />

                    <Info
                      label="OCR確信度"
                      value={
                        formatConfidence(
                          selected.ocrConfidence
                        )
                      }
                    />
                  </div>
                </section>

                {/* Score */}

                <section
                  style={{
                    marginTop:
                      18,
                  }}
                >
                  <h3>
                    採点情報
                  </h3>

                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "1fr 1fr",

                      gap:
                        10,
                    }}
                  >
                    <Info
                      label="得点"
                      value={
                        selected.totalMaxScore >
                        0
                          ? `${selected.totalScore} / ${selected.totalMaxScore}`
                          : "未採点"
                      }
                    />

                    <Info
                      label="状態"
                      value={
                        getStatusLabel(
                          selected.status
                        )
                      }
                    />
                  </div>
                </section>

                {/* Error */}

                {selected.processingError && (
                  <div
                    style={{
                      marginTop:
                        18,

                      padding:
                        12,

                      borderRadius:
                        8,

                      background:
                        "#fff1f1",

                      color:
                        "#8a2222",

                      fontSize:
                        12,
                    }}
                  >
                    <strong>
                      処理エラー
                    </strong>

                    <div
                      style={{
                        marginTop:
                          5,
                      }}
                    >
                      {
                        selected.processingError
                      }
                    </div>
                  </div>
                )}

                {/* Actions */}

                <footer
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "center",

                    gap:
                      10,

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
                      display:
                        "flex",

                      gap:
                        8,
                    }}
                  >
                    <Link
                      href={`/grading/review?answerId=${encodeURIComponent(
                        selected.id
                      )}`}
                      className="button"
                    >
                      一次確認
                    </Link>

                    <Link
                      href={`/grading/second-review?answerId=${encodeURIComponent(
                        selected.id
                      )}`}
                      className="button"
                    >
                      二次確認
                    </Link>
                  </div>

                  {(role ===
                    "本部管理者" ||
                    role ===
                      "校舎管理者") &&
                    selected.status !==
                      "confirmed" &&
                    selected.status !==
                      "published" && (
                      <button
                        type="button"
                        className="button"
                        disabled={
                          deleting
                        }
                        onClick={
                          handleDelete
                        }
                      >
                        {deleting
                          ? "削除中..."
                          : "答案を削除"}
                      </button>
                    )}
                </footer>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   Normalize
   ========================================================= */

function normalizeAnswer(
  id: string,
  data: Record<
    string,
    unknown
  >,
  students: Student[],
  tests: Test[]
): AnswerRow {
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
   Student
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
   Test
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

function normalizeStatus(
  value: unknown
): Answer["status"] {
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
   Status label
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
          11,

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
   Stat
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
            21,
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

function EmptyList() {
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
        答案はありません。
      </strong>

      <p
        style={{
          fontSize:
            12,
        }}
      >
        登録された答案がここに表示されます。
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
          答案を選択してください
        </strong>

        <p
          style={{
            marginTop:
              6,

            fontSize:
              12,
          }}
        >
          左側から確認する答案を選択してください。
        </p>
      </div>
    </div>
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
