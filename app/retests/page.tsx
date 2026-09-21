"use client";

import {
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

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type RetestStatus =
  | "未受験"
  | "採点待ち"
  | "採点済み"
  | "確定";

type CurrentUser = {
  uid: string;
  name: string;
  organizationId: string | null;
  role: UserRole | null;
  schoolIds: string[];
};

type Test = {
  id: string;
  testId: string;
  name: string;
  subject: string;
  grade: string;
  className: string;
  schoolId: string;
  examDate: string;
  totalScore: number;
  active: boolean;
};

type Student = {
  id: string;
  name: string;
  studentNumber: string;
  grade: string;
  className: string;
  schoolId: string;
  active: boolean;
};

type Answer = {
  id: string;
  testId: string;
  studentId: string | null;
  studentNumber: string | null;
  totalScore: number;
  maxScore: number;
  finalized: boolean;
};

type Retest = {
  id: string;

  organizationId: string;

  originalTestId: string;

  originalTestCode: string;

  studentId: string;

  studentNumber: string;

  originalScore: number;

  retestTestId: string;

  retestTestCode: string;

  scheduledDate: string;

  status: RetestStatus;

  /*
   * 手採点結果だけを保持
   */
  manualScore: number | null;

  manualMaxScore: number;

  manualPercentage: number | null;

  /*
   * 通常成績へ反映済みか
   */
  appliedToResult: boolean;

  createdAt: unknown;
};

type Candidate = {
  student: Student;
  answer: Answer;
};

const DEFAULT_THRESHOLD = 60;

export default function RetestsPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(null);

  const [
    tests,
    setTests,
  ] = useState<Test[]>([]);

  const [
    students,
    setStudents,
  ] = useState<Student[]>([]);

  const [
    answers,
    setAnswers,
  ] = useState<Answer[]>([]);

  const [
    retests,
    setRetests,
  ] = useState<Retest[]>([]);

  const [
    selectedTestId,
    setSelectedTestId,
  ] = useState("");

  const [
    threshold,
    setThreshold,
  ] = useState(
    String(DEFAULT_THRESHOLD)
  );

  const [
    scheduledDate,
    setScheduledDate,
  ] = useState("");

  const [
    selectedCandidateIds,
    setSelectedCandidateIds,
  ] = useState<string[]>([]);

  const [
    manualScores,
    setManualScores,
  ] = useState<Record<string, string>>({});

  const [
    search,
    setSearch,
  ] = useState("");

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

  /*
   * ========================================================
   * Authentication
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

            if (snapshot.empty) {
              setLoading(false);
              setError(
                "システムのユーザー情報が登録されていません。"
              );
              return;
            }

            const data =
              snapshot.docs[0].data();

            setCurrentUser({
              uid: firebaseUser.uid,

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

              role:
                isUserRole(data.role)
                  ? data.role
                  : null,

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
            console.error(err);

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
   * Data
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
        answerSnapshot,
        retestSnapshot,
      ] = await Promise.all([
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

        /*
         * 通常テストの確定答案。
         * 追試対象者を探すためだけに使用。
         */
        getDocs(
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
              "finalized",
              "==",
              true
            )
          )
        ),

        /*
         * 追試。
         */
        getDocs(
          query(
            collection(
              db,
              "retests"
            ),
            where(
              "organizationId",
              "==",
              organizationId
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
              id: item.id,

              testId:
                stringValue(
                  data.testId
                ),

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

              schoolId:
                stringValue(
                  data.schoolId
                ),

              examDate:
                stringValue(
                  data.examDate
                ),

              totalScore:
                numberValue(
                  data.totalScore
                ),

              active:
                data.active !== false,
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
              id: item.id,

              name:
                stringValue(
                  data.name
                ),

              studentNumber:
                stringValue(
                  data.studentNumber
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
                data.active !== false,
            };
          }
        );

      const loadedAnswers =
        answerSnapshot.docs.map(
          (
            item
          ): Answer => {
            const data =
              item.data();

            return {
              id: item.id,

              testId:
                stringValue(
                  data.testId
                ),

              studentId:
                nullableString(
                  data.studentId
                ),

              studentNumber:
                nullableString(
                  data.studentNumber
                ),

              totalScore:
                numberValue(
                  data.totalScore
                ),

              maxScore:
                numberValue(
                  data.maxScore
                ),

              finalized:
                data.finalized ===
                true,
            };
          }
        );

      const loadedRetests =
        retestSnapshot.docs.map(
          (
            item
          ): Retest => {
            const data =
              item.data();

            return {
              id: item.id,

              organizationId,

              originalTestId:
                stringValue(
                  data.originalTestId
                ),

              originalTestCode:
                stringValue(
                  data.originalTestCode
                ),

              studentId:
                stringValue(
                  data.studentId
                ),

              studentNumber:
                stringValue(
                  data.studentNumber
                ),

              originalScore:
                numberValue(
                  data.originalScore
                ),

              retestTestId:
                stringValue(
                  data.retestTestId
                ),

              retestTestCode:
                stringValue(
                  data.retestTestCode
                ),

              scheduledDate:
                stringValue(
                  data.scheduledDate
                ),

              status:
                isRetestStatus(
                  data.status
                )
                  ? data.status
                  : "未受験",

              manualScore:
                nullableNumber(
                  data.manualScore
                ),

              manualMaxScore:
                numberValue(
                  data.manualMaxScore
                ),

              manualPercentage:
                nullableNumber(
                  data.manualPercentage
                ),

              appliedToResult:
                data.appliedToResult ===
                true,

              createdAt:
                data.createdAt,
            };
          }
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

      setRetests(
        loadedRetests
      );

      const scores: Record<
        string,
        string
      > = {};

      for (
        const retest of
          loadedRetests
      ) {
        if (
          retest.manualScore !==
          null
        ) {
          scores[
            retest.id
          ] =
            String(
              retest.manualScore
            );
        }
      }

      setManualScores(
        scores
      );

      if (
        !selectedTestId
      ) {
        const available =
          getAvailableTests(
            loadedTests,
            currentUser
          );

        if (
          available.length >
          0
        ) {
          setSelectedTestId(
            available[0].id
          );
        }
      }
    } catch (err) {
      console.error(err);

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
   * Available tests
   * ========================================================
   */

  const availableTests =
    useMemo(
      () =>
        getAvailableTests(
          tests,
          currentUser
        ),
      [
        tests,
        currentUser,
      ]
    );

  const selectedTest =
    tests.find(
      (
        test
      ) =>
        test.id ===
        selectedTestId
    );

  /*
   * ========================================================
   * Candidates
   * ========================================================
   */

  const candidates =
    useMemo(() => {
      if (
        !selectedTest
      ) {
        return [];
      }

      const thresholdValue =
        Number(
          threshold
        );

      if (
        !Number.isFinite(
          thresholdValue
        )
      ) {
        return [];
      }

      /*
       * すでに追試登録済みなら除外。
       */
      const existing =
        new Set(
          retests
            .filter(
              (
                retest
              ) =>
                retest.originalTestId ===
                selectedTest.id
            )
            .map(
              (
                retest
              ) =>
                retest.studentId
            )
        );

      const result:
        Candidate[] =
        [];

      for (
        const answer of
          answers
      ) {
        if (
          answer.testId !==
          selectedTest.id
        ) {
          continue;
        }

        if (
          !answer.finalized
        ) {
          continue;
        }

        if (
          !answer.studentId
        ) {
          continue;
        }

        if (
          existing.has(
            answer.studentId
          )
        ) {
          continue;
        }

        if (
          answer.totalScore >=
          thresholdValue
        ) {
          continue;
        }

        const student =
          students.find(
            (
              item
            ) =>
              item.id ===
              answer.studentId
          );

        if (
          !student
        ) {
          continue;
        }

        if (
          currentUser?.role !==
            "本部管理者" &&
          !currentUser?.schoolIds.includes(
            student.schoolId
          )
        ) {
          continue;
        }

        result.push({
          student,
          answer,
        });
      }

      return result;
    }, [
      selectedTest,
      threshold,
      retests,
      answers,
      students,
      currentUser,
    ]);

  /*
   * ========================================================
   * Search
   * ========================================================
   */

  const filteredCandidates =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (
        !keyword
      ) {
        return candidates;
      }

      return candidates.filter(
        (
          candidate
        ) =>
          candidate.student.name
            .toLowerCase()
            .includes(
              keyword
            ) ||
          candidate.student.studentNumber.includes(
            keyword
          ) ||
          candidate.student.className
            .toLowerCase()
            .includes(
              keyword
            )
      );
    }, [
      candidates,
      search,
    ]);

  /*
   * ========================================================
   * Register retest
   * ========================================================
   */

  async function registerRetests() {
    if (
      saving
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
        "対象テストを選択してください。"
      );
      return;
    }

    if (
      selectedCandidateIds.length ===
      0
    ) {
      setError(
        "追試対象者を選択してください。"
      );
      return;
    }

    if (
      !scheduledDate
    ) {
      setError(
        "追試実施日を入力してください。"
      );
      return;
    }

    try {
      setSaving(true);

      const retestCode =
        generateRetestCode(
          selectedTest
        );

      /*
       * 追試専用テスト。
       *
       * ただし自動採点ルートには流さない。
       */
      const duplicate =
        await getDocs(
          query(
            collection(
              db,
              "tests"
            ),
            where(
              "organizationId",
              "==",
              currentUser.organizationId
            ),
            where(
              "testId",
              "==",
              retestCode
            )
          )
        );

      let retestTestId =
        duplicate.empty
          ? ""
          : duplicate.docs[0].id;

      if (
        !retestTestId
      ) {
        const newTest =
          await addDoc(
            collection(
              db,
              "tests"
            ),
            {
              organizationId:
                currentUser.organizationId,

              schoolId:
                selectedTest.schoolId,

              testId:
                retestCode,

              name:
                `${selectedTest.name} 追試`,

              subject:
                selectedTest.subject,

              grade:
                selectedTest.grade,

              className:
                selectedTest.className,

              examDate:
                scheduledDate,

              totalScore:
                selectedTest.totalScore,

              active:
                true,

              isRetest:
                true,

              retestManualGrading:
                true,

              /*
               * 自動採点を明示的に無効。
               */
              automaticGrading:
                false,

              aiGrading:
                false,

              originalTestId:
                selectedTest.id,

              originalTestCode:
                selectedTest.testId,

              createdAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),
            }
          );

        retestTestId =
          newTest.id;
      }

      /*
       * 追試対象を作成。
       */
      for (
        const studentId of
          selectedCandidateIds
      ) {
        const candidate =
          candidates.find(
            (
              item
            ) =>
              item.student.id ===
              studentId
          );

        if (
          !candidate
        ) {
          continue;
        }

        await addDoc(
          collection(
            db,
            "retests"
          ),
          {
            organizationId:
              currentUser.organizationId,

            originalTestId:
              selectedTest.id,

            originalTestCode:
              selectedTest.testId,

            studentId:
              candidate.student.id,

            studentNumber:
              candidate.student
                .studentNumber,

            originalScore:
              candidate.answer
                .totalScore,

            retestTestId:
              retestTestId,

            retestTestCode:
              retestCode,

            scheduledDate,

            status:
              "未受験",

            manualScore:
              null,

            manualMaxScore:
              selectedTest.totalScore,

            manualPercentage:
              null,

            appliedToResult:
              false,

            createdBy:
              currentUser.uid,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );
      }

      setSelectedCandidateIds(
        []
      );

      setMessage(
        `${selectedCandidateIds.length}人を追試対象として登録しました。`
      );

      await loadData(
        currentUser.organizationId
      );
    } catch (err) {
      console.error(err);

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
   * Candidate selection
   * ========================================================
   */

  function toggleCandidate(
    studentId: string
  ) {
    setSelectedCandidateIds(
      (
        current
      ) =>
        current.includes(
          studentId
        )
          ? current.filter(
              (
                id
              ) =>
                id !==
                studentId
            )
          : [
              ...current,
              studentId,
            ]
    );
  }

  function selectAllCandidates() {
    setSelectedCandidateIds(
      filteredCandidates.map(
        (
          item
        ) =>
          item.student.id
      )
    );
  }

  function clearSelection() {
    setSelectedCandidateIds(
      []
    );
  }

  /*
   * ========================================================
   * Manual score
   * ========================================================
   */

  function changeManualScore(
    retestId: string,
    value: string
  ) {
    setManualScores(
      (
        current
      ) => ({
        ...current,

        [retestId]:
          value,
      })
    );
  }

  /*
   * ========================================================
   * Save manual score
   * ========================================================
   */

  async function saveManualScore(
    retest: Retest
  ) {
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
      retest.status ===
      "確定"
    ) {
      setError(
        "確定済みの追試結果は変更できません。"
      );
      return;
    }

    const raw =
      manualScores[
        retest.id
      ] ??
      "";

    if (
      raw.trim() ===
      ""
    ) {
      setError(
        "追試得点を入力してください。"
      );
      return;
    }

    const score =
      Number(
        raw
      );

    if (
      !Number.isFinite(
        score
      )
    ) {
      setError(
        "得点を正しく入力してください。"
      );
      return;
    }

    if (
      score < 0 ||
      score >
        retest.manualMaxScore
    ) {
      setError(
        `得点は0〜${retest.manualMaxScore}点で入力してください。`
      );
      return;
    }

    try {
      setSaving(true);

      setError("");
      setMessage("");

      const percentage =
        retest.manualMaxScore >
        0
          ? (
              score /
              retest.manualMaxScore
            ) *
            100
          : 0;

      await updateDoc(
        doc(
          db,
          "retests",
          retest.id
        ),
        {
          manualScore:
            score,

          manualMaxScore:
            retest.manualMaxScore,

          manualPercentage:
            percentage,

          status:
            "採点済み",

          appliedToResult:
            false,

          scoredBy:
            currentUser.uid,

          scoredByName:
            currentUser.name,

          scoredAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "追試の点数を保存しました。"
      );

      await loadData(
        currentUser.organizationId!
      );
    } catch (err) {
      console.error(err);

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
   * Finalize
   * ========================================================
   */

  async function finalizeRetest(
    retest: Retest
  ) {
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
      retest.manualScore ===
      null
    ) {
      setError(
        "先に追試得点を入力してください。"
      );
      return;
    }

    if (
      retest.status !==
      "採点済み"
    ) {
      setError(
        "採点済みの追試だけ確定できます。"
      );
      return;
    }

    try {
      setSaving(true);

      setError("");
      setMessage("");

      /*
       * 追試そのものを確定。
       */
      await updateDoc(
        doc(
          db,
          "retests",
          retest.id
        ),
        {
          status:
            "確定",

          finalized:
            true,

          finalizedBy:
            currentUser.uid,

          finalizedByName:
            currentUser.name,

          finalizedAt:
            serverTimestamp(),

          /*
           * まだ通常成績へ反映していない。
           */
          appliedToResult:
            false,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "追試結果を確定しました。通常成績への反映対象になりました。"
      );

      await loadData(
        currentUser.organizationId!
      );
    } catch (err) {
      console.error(err);

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
   * 通常成績への反映
   * ========================================================
   *
   * 元テストの成績として、
   * 追試で確定した点数を採用する。
   *
   * 元の答案データそのものは変更しない。
   */

  async function applyRetestToResult(
    retest: Retest
  ) {
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
      retest.status !==
      "確定"
    ) {
      setError(
        "確定済みの追試だけ通常成績へ反映できます。"
      );
      return;
    }

    if (
      retest.manualScore ===
      null
    ) {
      setError(
        "追試得点がありません。"
      );
      return;
    }

    if (
      retest.appliedToResult
    ) {
      setError(
        "この追試結果はすでに通常成績へ反映されています。"
      );
      return;
    }

    try {
      setSaving(true);

      setError("");
      setMessage("");

      /*
       * retestResultを独立保存。
       *
       * 元のanswersは変更しない。
       */
      await addDoc(
        collection(
          db,
          "retestResults"
        ),
        {
          organizationId:
            retest.organizationId,

          retestId:
            retest.id,

          originalTestId:
            retest.originalTestId,

          originalTestCode:
            retest.originalTestCode,

          studentId:
            retest.studentId,

          studentNumber:
            retest.studentNumber,

          originalScore:
            retest.originalScore,

          retestScore:
            retest.manualScore,

          retestMaxScore:
            retest.manualMaxScore,

          retestPercentage:
            retest.manualPercentage,

          /*
           * 通常成績で採用する値。
           */
          appliedScore:
            retest.manualScore,

          appliedMaxScore:
            retest.manualMaxScore,

          appliedPercentage:
            retest.manualPercentage,

          source:
            "追試",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * 二重反映防止。
       */
      await updateDoc(
        doc(
          db,
          "retests",
          retest.id
        ),
        {
          appliedToResult:
            true,

          appliedAt:
            serverTimestamp(),

          appliedBy:
            currentUser.uid,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "追試結果を通常成績の集計対象として登録しました。"
      );

      await loadData(
        currentUser.organizationId!
      );
    } catch (err) {
      console.error(err);

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
   * Display
   * ========================================================
   */

  const displayedRetests =
    retests.filter(
      (
        retest
      ) => {
        if (
          selectedTestId &&
          retest.originalTestId !==
            selectedTestId
        ) {
          return false;
        }

        const keyword =
          search
            .trim()
            .toLowerCase();

        if (
          !keyword
        ) {
          return true;
        }

        const student =
          students.find(
            (
              item
            ) =>
              item.id ===
              retest.studentId
          );

        return (
          retest.studentNumber.includes(
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

  /*
   * ========================================================
   * Permission
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
            追試管理
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
            1450,

          margin:
            "0 auto",
        }}
      >
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
            追試管理
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
            追試は講師が手採点し、確定した点数を通常テストの成績集計に反映します。
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
            対象者登録
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            追試対象者を登録
          </h2>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",

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
              元テスト

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

                  setSelectedCandidateIds(
                    []
                  );
                }}
                style={
                  inputStyle
                }
              >
                <option value="">
                  テストを選択してください
                </option>

                {availableTests.map(
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
              追試基準点

              <input
                type="number"
                min="0"
                value={
                  threshold
                }
                onChange={(
                  event
                ) =>
                  setThreshold(
                    event.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              />

              <span
                style={
                  helpTextStyle
                }
              >
                この点数未満の確定答案を候補にします。
              </span>
            </label>

            <label
              style={
                labelStyle
              }
            >
              追試実施日

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
                style={
                  inputStyle
                }
              />
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
                {
                  selectedTest.testId
                }
              </strong>

              {" — "}

              {
                selectedTest.name
              }

              {" / "}

              {
                selectedTest.subject
              }

              {" / 満点 "}

              {
                selectedTest.totalScore
              }
              点
            </div>
          )}
        </section>

        {/* ==================================================
            候補
            ================================================== */}

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

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
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
                追試候補
              </h2>

              <p
                style={{
                  margin:
                    "5px 0 0",

                  color:
                    "#777",

                  fontSize:
                    12,
                }}
              >
                {
                  filteredCandidates.length
                }
                人
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
              <button
                type="button"
                onClick={
                  selectAllCandidates
                }
                style={
                  secondaryButton
                }
              >
                全員選択
              </button>

              <button
                type="button"
                onClick={
                  clearSelection
                }
                style={
                  secondaryButton
                }
              >
                選択解除
              </button>
            </div>
          </div>

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
            placeholder="氏名・生徒番号・クラス"
            style={
              inputStyle
            }
          />

          <div
            style={{
              overflowX:
                "auto",

              marginTop:
                16,
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
                    選択
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    生徒番号
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    氏名
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    クラス
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    元得点
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    満点
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredCandidates.map(
                  (
                    candidate
                  ) => (
                    <tr
                      key={
                        candidate.student.id
                      }
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedCandidateIds.includes(
                            candidate.student.id
                          )}
                          onChange={() =>
                            toggleCandidate(
                              candidate.student.id
                            )
                          }
                        />
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          candidate
                            .student
                            .studentNumber
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          candidate
                            .student
                            .name
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          candidate
                            .student
                            .className ||
                          "—"
                        }
                      </td>

                      <td
                        style={{
                          ...tdStyle,

                          fontWeight:
                            700,

                          color:
                            "#a00000",
                        }}
                      >
                        {
                          candidate
                            .answer
                            .totalScore
                        }
                        点
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          candidate
                            .answer
                            .maxScore
                        }
                        点
                      </td>
                    </tr>
                  )
                )}

                {filteredCandidates.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                      style={{
                        ...tdStyle,

                        padding:
                          40,

                        textAlign:
                          "center",

                        color:
                          "#777",
                      }}
                    >
                      追試候補はいません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={
              saving ||
              selectedCandidateIds.length ===
                0
            }
            onClick={
              registerRetests
            }
            style={{
              ...primaryButton,

              marginTop:
                20,

              opacity:
                saving ||
                selectedCandidateIds.length ===
                  0
                  ? 0.5
                  : 1,
            }}
          >
            {saving
              ? "登録中..."
              : `${selectedCandidateIds.length}人を追試対象に登録`}
          </button>
        </section>

        {/* ==================================================
            手採点
            ================================================== */}

        <section
          style={
            cardStyle
          }
        >
          <h2>
            追試手採点
          </h2>

          <p
            style={{
              margin:
                "6px 0 0",

              color:
                "#777",

              fontSize:
                12,

              lineHeight:
                1.7,
            }}
          >
            追試はQR自動解析・OCR・自動採点・AI採点を使用しません。
            答案を確認して講師が得点を入力します。
          </p>

          <div
            style={{
              overflowX:
                "auto",

              marginTop:
                18,
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
                    追試ID
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    生徒番号
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    氏名
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    元得点
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    追試得点
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    得点率
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    状態
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    操作
                  </th>
                </tr>
              </thead>

              <tbody>
                {displayedRetests.map(
                  (
                    retest
                  ) => {
                    const student =
                      students.find(
                        (
                          item
                        ) =>
                          item.id ===
                          retest.studentId
                      );

                    const score =
                      manualScores[
                        retest.id
                      ] ??
                      (
                        retest.manualScore ??
                        ""
                      ).toString();

                    return (
                      <tr
                        key={
                          retest.id
                        }
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            retest.retestTestCode
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            retest.studentNumber
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {student?.name ||
                            "—"}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            retest.originalScore
                          }
                          点
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
                                retest.manualMaxScore
                              }
                              step="0.1"
                              value={
                                score
                              }
                              disabled={
                                retest.status ===
                                "確定"
                              }
                              onChange={(
                                event
                              ) =>
                                changeManualScore(
                                  retest.id,
                                  event
                                    .target
                                    .value
                                )
                              }
                              style={
                                scoreInputStyle
                              }
                            />

                            <span>
                              /
                              {
                                retest.manualMaxScore
                              }
                            </span>
                          </div>
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {retest.manualPercentage ===
                          null
                            ? "—"
                            : `${retest.manualPercentage.toFixed(
                                1
                              )}%`}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <StatusBadge
                            status={
                              retest.status
                            }
                          />
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

                              gap:
                                6,

                              flexWrap:
                                "wrap",
                            }}
                          >
                            {retest.status !==
                              "確定" && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  saveManualScore(
                                    retest
                                  )
                                }
                                style={
                                  smallPrimaryButton
                                }
                              >
                                点数保存
                              </button>
                            )}

                            {retest.status ===
                              "採点済み" && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  finalizeRetest(
                                    retest
                                  )
                                }
                                style={
                                  smallSecondaryButton
                                }
                              >
                                確定
                              </button>
                            )}

                            {retest.status ===
                              "確定" &&
                              !retest.appliedToResult && (
                                <button
                                  type="button"
                                  disabled={
                                    saving
                                  }
                                  onClick={() =>
                                    applyRetestToResult(
                                      retest
                                    )
                                  }
                                  style={
                                    smallApplyButton
                                  }
                                >
                                  成績へ反映
                                </button>
                              )}

                            {retest.appliedToResult && (
                              <span
                                style={{
                                  fontSize:
                                    11,

                                  color:
                                    "#28733f",

                                  fontWeight:
                                    600,
                                }}
                              >
                                成績反映済み
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}

                {displayedRetests.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        8
                      }
                      style={{
                        ...tdStyle,

                        padding:
                          40,

                        textAlign:
                          "center",

                        color:
                          "#777",
                      }}
                    >
                      追試対象はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
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
          "5px 9px",

        borderRadius:
          999,

        background:
          getStatusBackground(
            status
          ),

        color:
          getStatusColor(
            status
          ),

        fontSize:
          11,

        fontWeight:
          600,
      }}
    >
      {status}
    </span>
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

function isRetestStatus(
  value: unknown
): value is RetestStatus {
  return (
    value ===
      "未受験" ||
    value ===
      "採点待ち" ||
    value ===
      "採点済み" ||
    value ===
      "確定"
  );
}

function getAvailableTests(
  tests: Test[],
  user: CurrentUser | null
) {
  if (!user) {
    return [];
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return tests;
  }

  return tests.filter(
    (
      test
    ) =>
      user.schoolIds.includes(
        test.schoolId
      )
  );
}

function generateRetestCode(
  test: Test
) {
  const date =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )
      .replace(
        /-/g,
        ""
      );

  return `${test.testId}-R${date}`;
}

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

function numberValue(
  value: unknown
) {
  return typeof value ===
    "number"
    ? value
    : 0;
}

function nullableNumber(
  value: unknown
) {
  return typeof value ===
    "number"
    ? value
    : null;
}

function getStatusColor(
  status: RetestStatus
) {
  switch (
    status
  ) {
    case "未受験":
      return "#555";

    case "採点待ち":
      return "#765d00";

    case "採点済み":
      return "#28733f";

    case "確定":
      return "#1f4d80";

    default:
      return "#555";
  }
}

function getStatusBackground(
  status: RetestStatus
) {
  switch (
    status
  ) {
    case "未受験":
      return "#f0f0f0";

    case "採点待ち":
      return "#fff8df";

    case "採点済み":
      return "#eef9f1";

    case "確定":
      return "#eef5fc";

    default:
      return "#f0f0f0";
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

    case "failed-precondition":
      return "現在この操作を実行できません。";

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからお試しください。";

    default:
      return error instanceof Error
        ? error.message
        : "追試情報を処理できませんでした。";
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
      "10px 12px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",
  };

const helpTextStyle:
  React.CSSProperties = {
    display:
      "block",

    marginTop:
      6,

    color:
      "#777",

    fontSize:
      11,

    lineHeight:
      1.6,
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
      "9px 13px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",

    cursor:
      "pointer",

    fontSize:
      12,

    fontWeight:
      600,
  };

const smallPrimaryButton:
  React.CSSProperties = {
    padding:
      "7px 10px",

    border:
      "none",

    borderRadius:
      6,

    background:
      "#111",

    color:
      "#fff",

    cursor:
      "pointer",

    fontSize:
      11,

    fontWeight:
      600,
  };

const smallSecondaryButton:
  React.CSSProperties = {
    padding:
      "7px 10px",

    border:
      "1px solid #ccc",

    borderRadius:
      6,

    background:
      "#fff",

    cursor:
      "pointer",

    fontSize:
      11,

    fontWeight:
      600,
  };

const smallApplyButton:
  React.CSSProperties = {
    padding:
      "7px 10px",

    border:
      "1px solid #6b8",

    borderRadius:
      6,

    background:
      "#f2faf4",

    color:
      "#28733f",

    cursor:
      "pointer",

    fontSize:
      11,

    fontWeight:
      600,
  };

const scoreInputStyle:
  React.CSSProperties = {
    width:
      80,

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

    whiteSpace:
      "nowrap",

    verticalAlign:
      "middle",
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
