"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

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
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import {
  getScopedDocs,
  retestsQueries,
  studentsQueries,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Retest,
  RetestStatus,
  Student,
  Test,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type RetestRow =
  Retest & {
    studentName: string;
    originalTestName: string;
    retestTestName: string;
  };

/* =========================================================
   Page
   ========================================================= */

export default function RetestsPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    retests,
    setRetests,
  ] =
    useState<RetestRow[]>(
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
    loading,
    setLoading,
  ] =
    useState(true);

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
      "all" | RetestStatus
    >(
      "all"
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    score,
    setScore,
  ] =
    useState("");

  /* =======================================================
     Load
     ======================================================= */

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
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
        user.role ===
        "生徒"
      ) {
        throw new Error(
          "追試管理は職員のみ利用できます。"
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
        retestDocuments,
        studentDocuments,
        testDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            retestsQueries(
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

      const loadedTests =
        testDocuments.map(
          (
            item
          ) =>
            normalizeTest(
              item.id,
              item.data
            )
        );

      const loadedRetests =
        retestDocuments.map(
          (
            item
          ) =>
            normalizeRetest(
              item.id,
              item.data,
              loadedStudents,
              loadedTests
            )
        );

      setStudents(
        loadedStudents
      );

      setTests(
        loadedTests
      );

      setRetests(
        loadedRetests
      );

      setSelectedId(
        (
          current
        ) => {
          if (
            current &&
            loadedRetests.some(
              (
                retest
              ) =>
                retest.id ===
                current
            )
          ) {
            return current;
          }

          return (
            loadedRetests[0]?.id ??
            null
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        "Retest page error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "追試データを取得できませんでした。"
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

      return retests.filter(
        (
          retest
        ) => {
          const statusMatch =
            statusFilter ===
              "all" ||
            retest.status ===
              statusFilter;

          const searchMatch =
            !keyword ||
            retest.studentName
              .toLowerCase()
              .includes(
                keyword
              ) ||
            retest.studentNumber
              .toLowerCase()
              .includes(
                keyword
              ) ||
            retest.originalTestName
              .toLowerCase()
              .includes(
                keyword
              ) ||
            retest.retestTestName
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
      retests,
      search,
      statusFilter,
    ]);

  const selected =
    retests.find(
      (
        retest
      ) =>
        retest.id ===
        selectedId
    ) ??
    null;

  /* =======================================================
     Select
     ======================================================= */

  useEffect(() => {
    if (
      selected
    ) {
      setScore(
        selected.manualScore ===
          null
          ? ""
          : String(
              selected.manualScore
            )
      );
    } else {
      setScore("");
    }
  }, [
    selectedId,
  ]);

  /* =======================================================
     Manual score
     ======================================================= */

  async function saveScore() {
    if (
      !selected
    ) {
      return;
    }

    try {
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
        user.role ===
        "生徒"
      ) {
        throw new Error(
          "追試を採点する権限がありません。"
        );
      }

      const numericScore =
        Number(
          score
        );

      if (
        !Number.isFinite(
          numericScore
        )
      ) {
        throw new Error(
          "点数を入力してください。"
        );
      }

      if (
        numericScore <
          0 ||
        numericScore >
          selected.manualMaxScore
      ) {
        throw new Error(
          `点数は0〜${selected.manualMaxScore}の範囲で入力してください。`
        );
      }

      await updateDoc(
        doc(
          db,
          "retests",
          selected.id
        ),
        {
          manualScore:
            numericScore,

          status:
            "採点済み",

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "追試の採点結果を保存しました。"
      );

      await loadPage();
    } catch (
      error
    ) {
      console.error(
        "Retest scoring error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "追試の採点に失敗しました。"
      );
    }
  }

  /* =======================================================
     Finalize
     ======================================================= */

  async function finalizeRetest() {
    if (
      !selected
    ) {
      return;
    }

    try {
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
        user.role ===
        "生徒"
      ) {
        throw new Error(
          "追試を確定する権限がありません。"
        );
      }

      if (
        selected.manualScore ===
        null
      ) {
        throw new Error(
          "先に手採点を完了してください。"
        );
      }

      await updateDoc(
        doc(
          db,
          "retests",
          selected.id
        ),
        {
          status:
            "確定",

          finalized:
            true,

          appliedToResult:
            false,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "追試を確定しました。"
      );

      await loadPage();
    } catch (
      error
    ) {
      console.error(
        "Retest finalize error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "追試を確定できませんでした。"
      );
    }
  }

  /* =======================================================
     Summary
     ======================================================= */

  const waiting =
    retests.filter(
      (
        retest
      ) =>
        retest.status ===
        "未受験"
    ).length;

  const scoring =
    retests.filter(
      (
        retest
      ) =>
        retest.status ===
        "採点待ち"
    ).length;

  const scored =
    retests.filter(
      (
        retest
      ) =>
        retest.status ===
        "採点済み"
    ).length;

  const finalized =
    retests.filter(
      (
        retest
      ) =>
        retest.status ===
        "確定"
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
            追試
          </h1>

          <p>
            追試データを読み込んでいます...
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

        <header className="pageHeader">
          <div>
            <h1>
              追試
            </h1>

            <p className="muted">
              追試は自動採点せず、講師が手採点します。
            </p>
          </div>

          <Link
            href="/results/teacher"
            className="button"
          >
            成績
          </Link>
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
            Summary
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",

            gap:
              12,

            marginBottom:
              18,
          }}
        >
          <SummaryCard
            label="未受験"
            value={
              waiting
            }
          />

          <SummaryCard
            label="採点待ち"
            value={
              scoring
            }
          />

          <SummaryCard
            label="採点済み"
            value={
              scored
            }
          />

          <SummaryCard
            label="確定"
            value={
              finalized
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
              placeholder="生徒番号・氏名・テスト名"
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
                    | RetestStatus
                )
              }
            >
              <option value="all">
                すべて
              </option>

              <option value="未受験">
                未受験
              </option>

              <option value="採点待ち">
                採点待ち
              </option>

              <option value="採点済み">
                採点済み
              </option>

              <option value="確定">
                確定
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
              "minmax(0, 1.1fr) minmax(360px, .9fr)",

            gap:
              18,

            marginTop:
              16,

            alignItems:
              "start",
          }}
        >
          {/* List */}

          <section className="card">
            <h2>
              追試一覧
            </h2>

            {filtered.length ===
            0 ? (
              <EmptyState />
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
                        元テスト
                      </th>

                      <th>
                        追試
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
                        retest
                      ) => (
                        <tr
                          key={
                            retest.id
                          }
                          onClick={() =>
                            setSelectedId(
                              retest.id
                            )
                          }
                          style={{
                            cursor:
                              "pointer",

                            background:
                              selectedId ===
                              retest.id
                                ? "#f5f5f5"
                                : undefined,
                          }}
                        >
                          <td>
                            <strong>
                              {
                                retest.studentName
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
                                retest.studentNumber
                              }
                            </div>
                          </td>

                          <td>
                            {
                              retest.originalTestName
                            }
                          </td>

                          <td>
                            {
                              retest.retestTestName
                            }
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                retest.status
                              }
                            />
                          </td>

                          <td>
                            {retest.manualScore ===
                            null
                              ? "—"
                              : `${retest.manualScore} / ${retest.manualMaxScore}`}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Detail */}

          <section className="card">
            {!selected ? (
              <EmptyDetail />
            ) : (
              <>
                <h2>
                  追試採点
                </h2>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "1fr 1fr",

                    gap:
                      10,

                    marginTop:
                      16,
                  }}
                >
                  <Info
                    label="生徒"
                    value={
                      selected.studentName
                    }
                  />

                  <Info
                    label="生徒番号"
                    value={
                      selected.studentNumber
                    }
                  />

                  <Info
                    label="元テスト"
                    value={
                      selected.originalTestName
                    }
                  />

                  <Info
                    label="追試"
                    value={
                      selected.retestTestName
                    }
                  />
                </div>

                {/* Manual grading */}

                <section
                  style={{
                    marginTop:
                      22,
                  }}
                >
                  <h3>
                    手採点
                  </h3>

                  <p
                    className="muted"
                    style={{
                      fontSize:
                        12,
                    }}
                  >
                    追試は自動採点せず、講師が点数を入力します。
                  </p>

                  <div
                    style={{
                      display:
                        "flex",

                      alignItems:
                        "center",

                      gap:
                        8,

                      marginTop:
                        12,
                    }}
                  >
                    <input
                      type="number"
                      min={
                        0
                      }
                      max={
                        selected.manualMaxScore
                      }
                      value={
                        score
                      }
                      onChange={(
                        event
                      ) =>
                        setScore(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        selected.status ===
                        "確定"
                      }
                      style={{
                        width:
                          120,

                        fontSize:
                          20,
                      }}
                    />

                    <span>
                      /
                      {
                        selected.manualMaxScore
                      }
                      点
                    </span>
                  </div>

                  {selected.status !==
                    "確定" && (
                    <button
                      type="button"
                      className="button primary"
                      style={{
                        marginTop:
                          14,
                      }}
                      onClick={
                        saveScore
                      }
                    >
                      採点結果を保存
                    </button>
                  )}
                </section>

                {/* Finalize */}

                {selected.status ===
                  "採点済み" && (
                  <section
                    style={{
                      marginTop:
                        24,

                      paddingTop:
                        20,

                      borderTop:
                        "1px solid #eee",
                    }}
                  >
                    <h3>
                      追試確定
                    </h3>

                    <p
                      className="muted"
                      style={{
                        fontSize:
                          12,
                      }}
                    >
                      確定後は追試結果を成績集計へ反映できる状態になります。
                    </p>

                    <button
                      type="button"
                      className="button primary"
                      style={{
                        marginTop:
                          10,
                      }}
                      onClick={
                        finalizeRetest
                      }
                    >
                      追試を確定
                    </button>
                  </section>
                )}

                {selected.status ===
                  "確定" && (
                  <div
                    style={{
                      marginTop:
                        22,

                      padding:
                        14,

                      borderRadius:
                        8,

                      background:
                        "#f1f8f2",
                    }}
                  >
                    <strong>
                      追試は確定済みです。
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
                      成績反映状態：
                      {
                        selected.appliedToResult
                          ? "反映済み"
                          : "未反映"
                      }
                    </p>
                  </div>
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
   Normalize
   ========================================================= */

function normalizeRetest(
  id: string,
  data: Record<
    string,
    unknown
  >,
  students: Student[],
  tests: Test[]
): RetestRow {
  const studentId =
    stringValue(
      data.studentId
    );

  const originalTestId =
    stringValue(
      data.originalTestId
    );

  const retestTestId =
    stringValue(
      data.retestTestId
    );

  const student =
    students.find(
      (
        item
      ) =>
        item.id ===
        studentId
    );

  const originalTest =
    tests.find(
      (
        item
      ) =>
        item.id ===
        originalTestId ||
        item.testId ===
        originalTestId
    );

  const retestTest =
    tests.find(
      (
        item
      ) =>
        item.id ===
        retestTestId ||
        item.testId ===
        retestTestId
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

    originalTestId,

    studentId,

    studentNumber:
      stringValue(
        data.studentNumber
      ) ||
      student?.studentNumber ||
      "",

    retestTestId,

    scheduledDate:
      stringValue(
        data.scheduledDate
      ),

    status:
      normalizeStatus(
        data.status
      ),

    manualScore:
      nullableNumber(
        data.manualScore
      ),

    manualMaxScore:
      safeNumber(
        data.manualMaxScore
      ),

    finalized:
      data.finalized ===
      true,

    appliedToResult:
      data.appliedToResult ===
      true,

    createdBy:
      stringValue(
        data.createdBy
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    studentName:
      student?.name ??
      "生徒未設定",

    originalTestName:
      originalTest?.name ??
      "元テスト未設定",

    retestTestName:
      retestTest?.name ??
      "追試テスト未設定",
  };
}

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
): RetestStatus {
  switch (
    value
  ) {
    case "未受験":
    case "採点待ち":
    case "採点済み":
    case "確定":
      return value;

    default:
      return "未受験";
  }
}

/* =========================================================
   Status badge
   ========================================================= */

function StatusBadge({
  status,
}: {
  status: RetestStatus;
}) {
  return (
    <span
      style={{
        display:
          "inline-block",

        padding:
          "4px 8px",

        borderRadius:
          999,

        background:
          status ===
          "確定"
            ? "#e8f5e9"
            : status ===
                "採点済み"
              ? "#e8eef8"
              : "#fff4d6",

        fontSize:
          11,
      }}
    >
      {
        status
      }
    </span>
  );
}

/* =========================================================
   Summary
   ========================================================= */

function SummaryCard({
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
            24,
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
            3,
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

function EmptyState() {
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
        追試はありません。
      </strong>

      <p
        style={{
          fontSize:
            12,
        }}
      >
        登録された追試だけがここに表示されます。
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
          追試を選択してください
        </strong>

        <p
          style={{
            fontSize:
              12,
          }}
        >
          左側から採点する追試を選択してください。
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

function nullableNumber(
  value: unknown
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
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
