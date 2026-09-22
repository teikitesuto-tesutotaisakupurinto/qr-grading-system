"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

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

import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

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
  ] = useState<UserRole | null>(
    null
  );

  const [
    retests,
    setRetests,
  ] = useState<RetestRow[]>(
    []
  );

  const [
    students,
    setStudents,
  ] = useState<Student[]>(
    []
  );

  const [
    tests,
    setTests,
  ] = useState<Test[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

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
    statusFilter,
    setStatusFilter,
  ] = useState<
    "all" | RetestStatus
  >(
    "all"
  );

  const [
    selectedId,
    setSelectedId,
  ] = useState<
    string | null
  >(null);

  /* =======================================================
     Create form
     ======================================================= */

  const [
    showCreate,
    setShowCreate,
  ] = useState(false);

  const [
    studentId,
    setStudentId,
  ] = useState("");

  const [
    originalTestId,
    setOriginalTestId,
  ] = useState("");

  const [
    scheduledDate,
    setScheduledDate,
  ] = useState("");

  /* =======================================================
     Edit score
     ======================================================= */

  const [
    score,
    setScore,
  ] = useState("");

  const [
    editNote,
    setEditNote,
  ] = useState("");

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
          "追試管理を利用する権限がありません。"
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
        FirestoreUser = {
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
        retestDocuments
          .map(
            (
              item
            ) =>
              normalizeRetest(
                item.id,
                item.data,
                loadedStudents,
                loadedTests
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              getTime(
                b.updatedAt ??
                  b.createdAt
              ) -
              getTime(
                a.updatedAt ??
                  a.createdAt
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
                item
              ) =>
                item.id ===
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
        "Retest load error:",
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
     Statistics
     ======================================================= */

  const untestedCount =
    retests.filter(
      (
        item
      ) =>
        item.status ===
        "未受験"
    ).length;

  const waitingCount =
    retests.filter(
      (
        item
      ) =>
        item.status ===
        "採点待ち"
    ).length;

  const gradedCount =
    retests.filter(
      (
        item
      ) =>
        item.status ===
        "採点済み"
    ).length;

  const confirmedCount =
    retests.filter(
      (
        item
      ) =>
        item.status ===
        "確定"
    ).length;

  /* =======================================================
     Create
     ======================================================= */

  async function createRetest() {
    if (saving) {
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
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者"
      ) {
        throw new Error(
          "追試を作成する権限がありません。"
        );
      }

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織がありません。"
        );
      }

      if (!studentId) {
        throw new Error(
          "生徒を選択してください。"
        );
      }

      if (!originalTestId) {
        throw new Error(
          "元テストを選択してください。"
        );
      }

      const student =
        students.find(
          (
            item
          ) =>
            item.id ===
            studentId
        );

      if (!student) {
        throw new Error(
          "生徒が見つかりません。"
        );
      }

      if (
        user.role ===
        "校舎管理者" &&
        !user.schoolIds.includes(
          student.schoolId
        )
      ) {
        throw new Error(
          "所属校舎外の生徒には追試を作成できません。"
        );
      }

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

      if (!originalTest) {
        throw new Error(
          "元テストが見つかりません。"
        );
      }

      /*
       * 追試テストを新規作成。
       *
       * 元テストの設定を引き継ぐが、
       * isRetest=trueにする。
       */
      const retestTestRef =
        doc(
          collection(
            db,
            "tests"
          )
        );

      await setDoc(
        retestTestRef,
        {
          organizationId:
            user.organizationId,

          schoolId:
            student.schoolId,

          testId:
            retestTestRef.id,

          name:
            `${originalTest.name}（追試）`,

          subject:
            originalTest.subject,

          grade:
            originalTest.grade,

          className:
            student.className,

          examDate:
            scheduledDate,

          totalScore:
            originalTest.totalScore,

          active:
            true,

          isRetest:
            true,

          originalTestId:
            originalTest.id,

          /*
           * 追試は自動採点しない。
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
       * Retestレコード。
       */
      const retestRef =
        doc(
          collection(
            db,
            "retests"
          )
        );

      await setDoc(
        retestRef,
        {
          organizationId:
            user.organizationId,

          schoolId:
            student.schoolId,

          originalTestId:
            originalTest.id,

          studentId:
            student.id,

          studentNumber:
            student.studentNumber,

          retestTestId:
            retestTestRef.id,

          scheduledDate:
            scheduledDate,

          status:
            "未受験",

          manualScore:
            null,

          manualMaxScore:
            originalTest.totalScore,

          finalized:
            false,

          appliedToResult:
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
       * 追試テストの問題は、
       * 元テストの問題をコピーする必要がある。
       *
       * この画面ではテスト本体だけを作り、
       * 問題コピーは後続処理で行えるよう
       * originalTestIdを保持する。
       */

      setMessage(
        "追試を作成しました。"
      );

      setShowCreate(
        false
      );

      setStudentId("");

      setOriginalTestId("");

      setScheduledDate("");

      await loadPage();
    } catch (
      error
    ) {
      console.error(
        "Create retest error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "追試を作成できませんでした。"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     Save manual score
     ======================================================= */

  async function saveManualScore() {
    if (
      !selected ||
      saving
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
        user.role ===
        "生徒"
      ) {
        throw new Error(
          "追試を採点する権限がありません。"
        );
      }

      if (
        selected.status ===
        "確定"
      ) {
        throw new Error(
          "確定済みの追試は変更できません。"
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
          "得点を入力してください。"
        );
      }

      if (
        numericScore <
          0 ||
        numericScore >
          selected.manualMaxScore
      ) {
        throw new Error(
          `得点は0〜${selected.manualMaxScore}点で入力してください。`
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

          finalized:
            false,

          updatedAt:
            serverTimestamp(),

          internalNote:
            editNote.trim(),
        }
      );

      setMessage(
        "追試の手動採点結果を保存しました。"
      );

      setScore("");

      setEditNote("");

      await loadPage();
    } catch (
      error
    ) {
      console.error(
        "Retest score error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "追試の採点結果を保存できませんでした。"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     Finalize
     ======================================================= */

  async function finalizeRetest() {
    if (
      !selected ||
      saving
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
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者"
      ) {
        throw new Error(
          "追試を確定する権限がありません。"
        );
      }

      if (
        selected.status !==
        "採点済み"
      ) {
        throw new Error(
          "採点済みの追試だけ確定できます。"
        );
      }

      if (
        selected.manualScore ===
        null
      ) {
        throw new Error(
          "得点がありません。"
        );
      }

      const confirmed =
        window.confirm(
          "この追試の採点結果を確定しますか？"
        );

      if (!confirmed) {
        return;
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
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     Apply to result
     ======================================================= */

  async function applyRetestResult() {
    if (
      !selected ||
      saving
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
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者"
      ) {
        throw new Error(
          "成績反映を操作する権限がありません。"
        );
      }

      if (
        selected.status !==
        "確定"
      ) {
        throw new Error(
          "確定済みの追試だけ成績へ反映できます。"
        );
      }

      if (
        selected.appliedToResult
      ) {
        throw new Error(
          "この追試はすでに成績へ反映されています。"
        );
      }

      if (
        selected.manualScore ===
        null
      ) {
        throw new Error(
          "追試得点がありません。"
        );
      }

      /*
       * ここでは通常成績を上書きしない。
       *
       * 追試結果として別レコードを作成。
       */
      const resultRef =
        doc(
          collection(
            db,
            "results"
          )
        );

      const test =
        tests.find(
          (
            item
          ) =>
            item.id ===
              selected.retestTestId ||
            item.testId ===
              selected.retestTestId
        );

      await setDoc(
        resultRef,
        {
          organizationId:
            selected.organizationId,

          schoolId:
            selected.schoolId,

          answerId:
            null,

          retestId:
            selected.id,

          studentId:
            selected.studentId,

          studentNumber:
            selected.studentNumber,

          testId:
            selected.retestTestId,

          testName:
            test?.name ??
            selected.retestTestName,

          subject:
            test?.subject ??
            "",

          score:
            selected.manualScore,

          maxScore:
            selected.manualMaxScore,

          percentage:
            selected.manualMaxScore >
            0
              ? selected.manualScore /
                  selected.manualMaxScore *
                100
              : 0,

          average:
            null,

          deviationScore:
            null,

          rank:
            null,

          population:
            null,

          source:
            "追試",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      await updateDoc(
        doc(
          db,
          "retests",
          selected.id
        ),
        {
          appliedToResult:
            true,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "追試結果を成績へ反映しました。"
      );

      await loadPage();
    } catch (
      error
    ) {
      console.error(
        "Apply retest result error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "追試結果を成績へ反映できませんでした。"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     Loading
     ======================================================= */

  if (loading) {
    return (
      <main className="page">
        <section className="content">
          <h1>
            追試管理
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

        {/* ==================================================
            Header
            ================================================== */}

        <header className="pageHeader">
          <div>
            <h1>
              追試管理
            </h1>

            <p className="muted">
              通常テストとは分離して追試を管理します。
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
                : "追試を作成"}
            </button>
          )}
        </header>

        {/* ==================================================
            Messages
            ================================================== */}

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
            Statistics
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",

            gap:
              10,

            marginBottom:
              16,
          }}
        >
          <StatCard
            label="未受験"
            value={
              untestedCount
            }
          />

          <StatCard
            label="採点待ち"
            value={
              waitingCount
            }
          />

          <StatCard
            label="採点済み"
            value={
              gradedCount
            }
          />

          <StatCard
            label="確定"
            value={
              confirmedCount
            }
          />
        </div>

        {/* ==================================================
            Create
            ================================================== */}

        {showCreate && (
          <section className="card">
            <h2>
              追試作成
            </h2>

            <p
              className="muted"
              style={{
                fontSize:
                  12,
              }}
            >
              追試は元テストを基準に作成され、自動採点は行いません。
            </p>

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "1fr 1fr 180px",

                gap:
                  10,

                marginTop:
                  14,
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

                    fontWeight:
                      600,
                  }}
                >
                  生徒
                </span>

                <select
                  value={
                    studentId
                  }
                  onChange={(
                    event
                  ) =>
                    setStudentId(
                      event.target
                        .value
                    )
                  }
                  style={{
                    width:
                      "100%",
                  }}
                >
                  <option value="">
                    生徒を選択
                  </option>

                  {students
                    .filter(
                      (
                        student
                      ) =>
                        student.active
                    )
                    .map(
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
                          {" - "}
                          {
                            student.name
                          }
                        </option>
                      )
                    )}
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

                    fontWeight:
                      600,
                  }}
                >
                  元テスト
                </span>

                <select
                  value={
                    originalTestId
                  }
                  onChange={(
                    event
                  ) =>
                    setOriginalTestId(
                      event.target
                        .value
                    )
                  }
                  style={{
                    width:
                      "100%",
                  }}
                >
                  <option value="">
                    元テストを選択
                  </option>

                  {tests
                    .filter(
                      (
                        test
                      ) =>
                        test.active &&
                        !test.isRetest
                    )
                    .map(
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
                          {" / "}
                          {
                            test.subject
                          }
                        </option>
                      )
                    )}
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

                    fontWeight:
                      600,
                  }}
                >
                  予定日
                </span>

                <input
                  type="date"
                  value={
                    scheduledDate
                  }
                  onChange={(
                    event
                  ) =>
                    setScheduledDate(
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
                  createRetest
                }
              >
                {saving
                  ? "作成中..."
                  : "追試を作成"}
              </button>
            </div>
          </section>
        )}

        {/* ==================================================
            Filter
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
                "1fr 200px",

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
              placeholder="生徒番号・氏名・元テスト・追試テスト"
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
              "minmax(360px, 1fr) minmax(400px, 1fr)",

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
                追試一覧
              </h2>

              <span
                className="muted"
                style={{
                  fontSize:
                    11,
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
              filtered.map(
                (
                  retest
                ) => (
                  <button
                    key={
                      retest.id
                    }
                    type="button"
                    onClick={() => {
                      setSelectedId(
                        retest.id
                      );

                      setScore(
                        retest.manualScore ===
                          null
                          ? ""
                          : String(
                              retest.manualScore
                            )
                      );

                      setEditNote("");
                    }}
                    style={{
                      display:
                        "block",

                      width:
                        "100%",

                      marginBottom:
                        8,

                      padding:
                        14,

                      border:
                        selectedId ===
                        retest.id
                          ? "2px solid #111"
                          : "1px solid #ddd",

                      borderRadius:
                        8,

                      background:
                        selectedId ===
                        retest.id
                          ? "#f7f7f7"
                          : "#fff",

                      textAlign:
                        "left",

                      cursor:
                        "pointer",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap:
                          10,
                      }}
                    >
                      <strong>
                        {
                          retest.studentName
                        }
                      </strong>

                      <StatusBadge
                        status={
                          retest.status
                        }
                      />
                    </div>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          5,

                        fontSize:
                          11,
                      }}
                    >
                      {
                        retest.studentNumber
                      }
                    </div>

                    <div
                      style={{
                        marginTop:
                          8,

                        fontSize:
                          12,
                      }}
                    >
                      元：
                      {
                        retest.originalTestName
                      }
                    </div>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          3,

                        fontSize:
                          11,
                      }}
                    >
                      追試：
                      {
                        retest.retestTestName
                      }
                    </div>

                    <div
                      style={{
                        marginTop:
                          9,

                        display:
                          "flex",

                        gap:
                          7,
                      }}
                    >
                      <MiniStat
                        label="予定日"
                        value={
                          retest.scheduledDate ||
                          "未設定"
                        }
                      />

                      <MiniStat
                        label="得点"
                        value={
                          retest.manualScore ===
                          null
                            ? "未採点"
                            : `${retest.manualScore}/${retest.manualMaxScore}`
                        }
                      />
                    </div>
                  </button>
                )
              )
            )}
          </section>

          {/* ================================================
              Detail
              ================================================ */}

          <section className="card">
            {!selected ? (
              <EmptyDetail />
            ) : (
              <>
                <header
                  style={{
                    paddingBottom:
                      16,

                    borderBottom:
                      "1px solid #eee",
                  }}
                >
                  <div
                    className="muted"
                    style={{
                      fontSize:
                        11,
                    }}
                  >
                    追試
                  </div>

                  <h2
                    style={{
                      margin:
                        "5px 0 0",
                    }}
                  >
                    {
                      selected.studentName
                    }
                  </h2>

                  <p
                    className="muted"
                    style={{
                      margin:
                        "5px 0 0",

                      fontSize:
                        12,
                    }}
                  >
                    {
                      selected.studentNumber
                    }
                  </p>
                </header>

                {/* ==========================================
                    Information
                    ========================================== */}

                <section
                  style={{
                    marginTop:
                      18,
                  }}
                >
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
                    <InfoCard
                      label="元テスト"
                      value={
                        selected.originalTestName
                      }
                    />

                    <InfoCard
                      label="追試テスト"
                      value={
                        selected.retestTestName
                      }
                    />

                    <InfoCard
                      label="予定日"
                      value={
                        selected.scheduledDate ||
                        "未設定"
                      }
                    />

                    <InfoCard
                      label="状態"
                      value={
                        getStatusLabel(
                          selected.status
                        )
                      }
                    />

                    <InfoCard
                      label="満点"
                      value={
                        String(
                          selected.manualMaxScore
                        )
                      }
                    />

                    <InfoCard
                      label="成績反映"
                      value={
                        selected.appliedToResult
                          ? "反映済み"
                          : "未反映"
                      }
                    />
                  </div>
                </section>

                {/* ==========================================
                    Manual grading
                    ========================================== */}

                <section
                  style={{
                    marginTop:
                      20,
                  }}
                >
                  <h3>
                    手動採点
                  </h3>

                  <p
                    className="muted"
                    style={{
                      fontSize:
                        11,

                      margin:
                        "5px 0 0",
                    }}
                  >
                    追試は自動採点せず、担当者が手動で採点します。
                  </p>

                  <label
                    style={{
                      display:
                        "block",

                      marginTop:
                        14,
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

                        fontWeight:
                          600,
                      }}
                    >
                      得点
                    </span>

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
                          "100%",
                      }}
                    />
                  </label>

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
                      内部メモ
                    </span>

                    <textarea
                      value={
                        editNote
                      }
                      onChange={(
                        event
                      ) =>
                        setEditNote(
                          event.target
                            .value
                        )
                      }
                      rows={
                        3
                      }
                      disabled={
                        selected.status ===
                        "確定"
                      }
                      style={{
                        width:
                          "100%",
                      }}
                    />
                  </label>
                </section>

                {/* ==========================================
                    Actions
                    ========================================== */}

                <section
                  style={{
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

                      flexWrap:
                        "wrap",

                      gap:
                        8,
                    }}
                  >
                    {selected.status !==
                      "確定" && (
                      <button
                        type="button"
                        className="button primary"
                        disabled={
                          saving
                        }
                        onClick={
                          saveManualScore
                        }
                      >
                        {saving
                          ? "保存中..."
                          : "採点結果を保存"}
                      </button>
                    )}

                    {(role ===
                      "本部管理者" ||
                      role ===
                        "校舎管理者") &&
                      selected.status ===
                        "採点済み" && (
                        <button
                          type="button"
                          className="button"
                          disabled={
                            saving
                          }
                          onClick={
                            finalizeRetest
                          }
                        >
                          {saving
                            ? "処理中..."
                            : "追試を確定"}
                        </button>
                      )}

                    {(role ===
                      "本部管理者" ||
                      role ===
                        "校舎管理者") &&
                      selected.status ===
                        "確定" &&
                      !selected.appliedToResult && (
                        <button
                          type="button"
                          className="button primary"
                          disabled={
                            saving
                          }
                          onClick={
                            applyRetestResult
                          }
                        >
                          {saving
                            ? "反映中..."
                            : "成績へ反映"}
                        </button>
                      )}
                  </div>

                  {selected.appliedToResult && (
                    <div
                      style={{
                        marginTop:
                          12,

                        padding:
                          10,

                        background:
                          "#e8f5e9",

                        borderRadius:
                          7,

                        fontSize:
                          11,
                      }}
                    >
                      この追試結果は成績へ反映済みです。
                    </div>
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
   Status
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
              ? "#eef4ff"
              : "#f1f1f1",

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

function getStatusLabel(
  status: RetestStatus
) {
  switch (
    status
  ) {
    case "未受験":
      return "未受験";

    case "採点待ち":
      return "採点待ち";

    case "採点済み":
      return "採点済み";

    case "確定":
      return "確定";

    default:
      return "未設定";
  }
}

/* =========================================================
   Statistics
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
            22,
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

function InfoCard({
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
          11,

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
        {
          value ||
          "—"
        }
      </strong>
    </div>
  );
}

/* =========================================================
   Mini stat
   ========================================================= */

function MiniStat({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <span
      style={{
        padding:
          "4px 7px",

        borderRadius:
          5,

        background:
          "#f1f1f1",

        fontSize:
          10,
      }}
    >
      {
        label
      }
      ：
      {
        value
      }
    </span>
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
        追試はありません。
      </strong>

      <p
        style={{
          marginTop:
            6,

          fontSize:
            12,
        }}
      >
        作成した追試がここに表示されます。
      </p>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div
      style={{
        minHeight:
          550,

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
            marginTop:
              6,

            fontSize:
              12,
          }}
        >
          左側から確認・採点する追試を選択してください。
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   Normalize Retest
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
      ),

    retestTestId,

    scheduledDate:
      stringValue(
        data.scheduledDate
      ),

    status:
      normalizeRetestStatus(
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
   Status
   ========================================================= */

function normalizeRetestStatus(
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
