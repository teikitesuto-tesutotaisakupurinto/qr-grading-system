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
  getDoc,
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
  answersQuery,
  retestsQuery,
  studentsQuery,
  testsQuery,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type RetestStatus =
  | "未受験"
  | "採点待ち"
  | "採点済み"
  | "確定";

type Test = {
  id: string;

  organizationId: string;

  testId: string;

  name: string;

  subject: string;

  grade: string;

  className: string;

  schoolId: string;

  examDate: string;

  totalScore: number;

  active: boolean;

  isRetest: boolean;
};

type Student = {
  id: string;

  organizationId: string;

  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  schoolId: string;

  active: boolean;
};

type Answer = {
  id: string;

  organizationId: string;

  testId: string;

  studentId: string | null;

  studentNumber: string | null;

  schoolId: string;

  totalScore: number;

  maxScore: number;

  finalized: boolean;
};

type Retest = {
  id: string;

  organizationId: string;

  schoolId: string;

  originalTestId: string;

  originalTestCode: string;

  studentId: string;

  studentNumber: string;

  originalScore: number;

  retestTestId: string;

  retestTestCode: string;

  scheduledDate: string;

  status: RetestStatus;

  manualScore: number | null;

  manualMaxScore: number;

  manualPercentage: number | null;

  appliedToResult: boolean;

  finalized: boolean;

  createdAt: unknown;
};

type Candidate = {
  student: Student;

  answer: Answer;
};

/* =========================================================
   Current User
   ========================================================= */

type CurrentUser = FirestoreUser & {
  name: string;
};

/* =========================================================
   Constants
   ========================================================= */

const DEFAULT_THRESHOLD =
  60;

/* =========================================================
   Page
   ========================================================= */

export default function RetestsPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(
    null
  );

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
    String(
      DEFAULT_THRESHOLD
    )
  );

  const [
    scheduledDate,
    setScheduledDate,
  ] = useState("");

  const [
    selectedCandidateIds,
    setSelectedCandidateIds,
  ] = useState<string[]>(
    []
  );

  const [
    manualScores,
    setManualScores,
  ] = useState<
    Record<string, string>
  >({});

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
          if (
            !firebaseUser
          ) {
            setCurrentUser(
              null
            );

            setLoading(
              false
            );

            setError(
              "ログイン状態を確認できません。"
            );

            return;
          }

          try {
            /*
             * users/{uid} を直接取得。
             */
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  firebaseUser.uid
                )
              );

            if (
              !snapshot.exists()
            ) {
              setCurrentUser(
                null
              );

              setError(
                "システムのユーザー情報が登録されていません。"
              );

              setLoading(
                false
              );

              return;
            }

            const data =
              snapshot.data();

            const role =
              isUserRole(
                data.role
              )
                ? data.role
                : null;

            const organizationId =
              typeof data.organizationId ===
              "string"
                ? data.organizationId
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

              organizationId,

              role,

              schoolIds,

              studentId:
                typeof data.studentId ===
                "string"
                  ? data.studentId
                  : null,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : firebaseUser.displayName ??
                    "",
            });
          } catch (
            err
          ) {
            console.error(
              "User loading error:",
              err
            );

            setError(
              getSafeErrorMessage(
                err
              )
            );
          } finally {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================================
     Permission
     ======================================================= */

  const canUsePage =
    currentUser?.role ===
      "本部管理者" ||
    currentUser?.role ===
      "校舎管理者" ||
    currentUser?.role ===
      "講師";

  /* =======================================================
     Data loading
     ======================================================= */

  useEffect(() => {
    if (
      !currentUser ||
      !currentUser.organizationId ||
      !canUsePage
    ) {
      return;
    }

    void loadData(
      currentUser
    );
  }, [
    currentUser,
    canUsePage,
  ]);

  async function loadData(
    user: CurrentUser
  ) {
    if (
      !user.organizationId
    ) {
      return;
    }

    try {
      setLoading(
        true
      );

      setError("");

      /*
       * 権限に応じたQueryを使用。
       */
      const testsQ =
        testsQuery(
          user
        );

      const studentsQ =
        studentsQuery(
          user
        );

      const answersQ =
        answersQuery(
          user
        );

      const retestsQ =
        retestsQuery(
          user
        );

      if (
        !testsQ ||
        !studentsQ ||
        !answersQ ||
        !retestsQ
      ) {
        setTests(
          []
        );

        setStudents(
          []
        );

        setAnswers(
          []
        );

        setRetests(
          []
        );

        return;
      }

      const [
        testSnapshot,
        studentSnapshot,
        answerSnapshot,
        retestSnapshot,
      ] =
        await Promise.all([
          getDocs(
            testsQ
          ),

          getDocs(
            studentsQ
          ),

          getDocs(
            answersQ
          ),

          getDocs(
            retestsQ
          ),
        ]);

      /*
       * Tests
       */

      const loadedTests =
        testSnapshot.docs
          .map(
            (
              item
            ): Test => {
              const data =
                item.data();

              return {
                id:
                  item.id,

                organizationId:
                  stringValue(
                    data.organizationId
                  ),

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
                  data.active !==
                  false,

                isRetest:
                  data.isRetest ===
                  true,
              };
            }
          )
          /*
           * 追試テスト自体は
           * この画面の元テスト選択には出さない。
           */
          .filter(
            (
              test
            ) =>
              test.active &&
              !test.isRetest
          );

      /*
       * Students
       */

      const loadedStudents =
        studentSnapshot.docs
          .map(
            (
              item
            ): Student => {
              const data =
                item.data();

              return {
                id:
                  item.id,

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
              };
            }
          )
          .filter(
            (
              student
            ) =>
              student.active
          );

      /*
       * Answers
       */

      const loadedAnswers =
        answerSnapshot.docs
          .map(
            (
              item
            ): Answer => {
              const data =
                item.data();

              return {
                id:
                  item.id,

                organizationId:
                  stringValue(
                    data.organizationId
                  ),

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

                schoolId:
                  stringValue(
                    data.schoolId
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
          )
          .filter(
            (
              answer
            ) =>
              answer.finalized
          );

      /*
       * Retests
       */

      const loadedRetests =
        retestSnapshot.docs
          .map(
            (
              item
            ): Retest => {
              const data =
                item.data();

              return {
                id:
                  item.id,

                organizationId:
                  stringValue(
                    data.organizationId
                  ),

                schoolId:
                  stringValue(
                    data.schoolId
                  ),

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

                finalized:
                  data.finalized ===
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

      /*
       * 入力値を復元。
       */
      const scores:
        Record<
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

      /*
       * 初期テスト。
       */
      if (
        !selectedTestId &&
        loadedTests.length >
          0
      ) {
        setSelectedTestId(
          loadedTests[0].id
        );
      }
    } catch (
      err
    ) {
      console.error(
        "Retest data loading error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /* =======================================================
     Available tests
     ======================================================= */

  const availableTests =
    useMemo(() => {
      if (
        !currentUser
      ) {
        return [];
      }

      if (
        currentUser.role ===
        "本部管理者"
      ) {
        return tests;
      }

      return tests.filter(
        (
          test
        ) =>
          currentUser.schoolIds.includes(
            test.schoolId
          )
      );
    }, [
      tests,
      currentUser,
    ]);

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
     Candidates
     ======================================================= */

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
       * すでに追試登録済みの生徒を除外。
       */
      const registered =
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
          !answer.studentId
        ) {
          continue;
        }

        if (
          registered.has(
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

        /*
         * 念のためクライアント側でも
         * 校舎範囲を再確認。
         */
        if (
          currentUser?.role !==
          "本部管理者"
        ) {
          if (
            !currentUser?.schoolIds.includes(
              student.schoolId
            )
          ) {
            continue;
          }
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

  /* =======================================================
     Search
     ======================================================= */

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

  /* =======================================================
     Displayed retests
     ======================================================= */

  const displayedRetests =
    useMemo(() => {
      let result =
        retests;

      if (
        selectedTestId
      ) {
        result =
          result.filter(
            (
              retest
            ) =>
              retest.originalTestId ===
              selectedTestId
          );
      }

      const keyword =
        search
          .trim()
          .toLowerCase();

      if (
        keyword
      ) {
        result =
          result.filter(
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
      }

      return result;
    }, [
      retests,
      selectedTestId,
      search,
      students,
    ]);

  /* =======================================================
     Candidate selection
     ======================================================= */

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
          candidate
        ) =>
          candidate.student.id
      )
    );
  }

  function clearSelection() {
    setSelectedCandidateIds(
      []
    );
  }

  /* =======================================================
     Generate retest code
     ======================================================= */

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

  /* =======================================================
     Register retests
     ======================================================= */

  async function registerRetests() {
    if (
      saving
    ) {
      return;
    }

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
        "元テストを選択してください。"
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

    /*
     * 選択テストの校舎権限。
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
          "この校舎の追試を登録する権限がありません。"
        );

        return;
      }
    }

    const thresholdValue =
      Number(
        threshold
      );

    if (
      !Number.isFinite(
        thresholdValue
      ) ||
      thresholdValue <
        0
    ) {
      setError(
        "追試基準点を正しく入力してください。"
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setError("");
      setMessage("");

      const retestCode =
        generateRetestCode(
          selectedTest
        );

      /*
       * 追試テストの既存確認。
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
        duplicateSnapshot.empty
          ? ""
          : duplicateSnapshot.docs[0].id;

      /*
       * 追試専用テスト作成。
       */
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

              /*
               * 追試フラグ。
               */
              isRetest:
                true,

              /*
               * 自動採点を完全に無効化。
               */
              automaticGrading:
                false,

              aiGrading:
                false,

              retestManualGrading:
                true,

              originalTestId:
                selectedTest.id,

              originalTestCode:
                selectedTest.testId,

              createdBy:
                currentUser.uid,

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
       * 対象者ごとに追試を作成。
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

        /*
         * schoolIdを必ず保存。
         */
        await addDoc(
          collection(
            db,
            "retests"
          ),
          {
            organizationId:
              currentUser.organizationId,

            schoolId:
              candidate.student.schoolId,

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

            finalized:
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
        currentUser
      );
    } catch (
      err
    ) {
      console.error(
        "Retest registration error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Manual score input
     ======================================================= */

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

  /* =======================================================
     Save manual score
     ======================================================= */

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

    /*
     * クライアント側の校舎確認。
     */
    if (
      currentUser.role !==
      "本部管理者" &&
      !currentUser.schoolIds.includes(
        retest.schoolId
      )
    ) {
      setError(
        "この追試結果を変更する権限がありません。"
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
      score <
        0 ||
      score >
        retest.manualMaxScore
    ) {
      setError(
        `得点は0〜${retest.manualMaxScore}点で入力してください。`
      );

      return;
    }

    try {
      setSaving(
        true
      );

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

          finalized:
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
        currentUser
      );
    } catch (
      err
    ) {
      console.error(
        "Manual score save error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Finalize retest
     ======================================================= */

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
      currentUser.role !==
      "本部管理者" &&
      !currentUser.schoolIds.includes(
        retest.schoolId
      )
    ) {
      setError(
        "この追試結果を確定する権限がありません。"
      );

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
      setSaving(
        true
      );

      setError("");
      setMessage("");

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

          appliedToResult:
            false,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "追試結果を確定しました。"
      );

      await loadData(
        currentUser
      );
    } catch (
      err
    ) {
      console.error(
        "Retest finalization error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Apply to normal result
     ======================================================= */

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
      !currentUser.organizationId
    ) {
      return;
    }

    if (
      currentUser.role !==
      "本部管理者" &&
      !currentUser.schoolIds.includes(
        retest.schoolId
      )
    ) {
      setError(
        "この追試結果を成績へ反映する権限がありません。"
      );

      return;
    }

    if (
      retest.status !==
      "確定"
    ) {
      setError(
        "確定済みの追試だけ成績へ反映できます。"
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
        "この追試結果はすでに成績へ反映されています。"
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setError("");
      setMessage("");

      /*
       * 既存反映データ確認。
       *
       * 同じretetIdを二重登録しない。
       */
      const existing =
        await getDocs(
          query(
            collection(
              db,
              "retestResults"
            ),
            where(
              "organizationId",
              "==",
              currentUser.organizationId
            ),
            where(
              "retestId",
              "==",
              retest.id
            )
          )
        );

      if (
        !existing.empty
      ) {
        /*
         * すでに存在するなら
         * retests側だけ反映済みに修正。
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
          "この追試結果はすでに成績へ登録されています。"
        );

        await loadData(
          currentUser
        );

        return;
      }

      /*
       * retestResultsを作成。
       *
       * ここにもschoolIdを保存。
       */
      await addDoc(
        collection(
          db,
          "retestResults"
        ),
        {
          organizationId:
            retest.organizationId,

          schoolId:
            retest.schoolId,

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
           * 成績集計で採用する値。
           */
          appliedScore:
            retest.manualScore,

          appliedMaxScore:
            retest.manualMaxScore,

          appliedPercentage:
            retest.manualPercentage,

          source:
            "追試",

          createdBy:
            currentUser.uid,

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
        "追試結果を通常成績の集計対象へ反映しました。"
      );

      await loadData(
        currentUser
      );
    } catch (
      err
    ) {
      console.error(
        "Retest result apply error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =======================================================
     Permission denied
     ======================================================= */

  if (
    !currentUser
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
            ログイン状態を確認しています。
          </p>
        </section>
      </main>
    );
  }

  if (
    !canUsePage
  ) {
    return null;
  }

  /* =======================================================
     Render
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
            1500,

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
            追試は講師が手採点し、確定した点数を通常テストの成績集計へ反映します。
          </p>
        </header>

        {/* ==================================================
            Messages
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
            Registration
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2
            style={{
              margin:
                0,
            }}
          >
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
                この点数未満の確定答案を追試候補にします。
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
            Candidates
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
                    学年
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
                            .grade
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

                          color:
                            "#a00000",

                          fontWeight:
                            700,
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
                        7
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
                      現在の条件では追試候補はいません。
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
            Manual grading
            ================================================== */}

        <section
          style={
            cardStyle
          }
        >
          <h2
            style={{
              margin:
                0,
            }}
          >
            追試手採点
          </h2>

          <p
            style={{
              margin:
                "7px 0 0",

              color:
                "#777",

              fontSize:
                12,

              lineHeight:
                1.7,
            }}
          >
            追試ではQR解析・OCR・自動採点・AI採点を使用しません。
            答案を確認して講師が点数を直接入力します。
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

                    const scoreValue =
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
                          {student?.name ??
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
                                scoreValue
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
                                  color:
                                    "#28733f",

                                  fontSize:
                                    11,

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
   Validation
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

/* =========================================================
   Value helpers
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

/* =========================================================
   Error
   ========================================================= */

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

    case "already-exists":
      return "同じデータがすでに登録されています。";

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからお試しください。";

    default:
      return error instanceof Error
        ? error.message
        : "追試情報を処理できませんでした。";
  }
}

/* =========================================================
   Status colors
   ========================================================= */

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
