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
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  doc,
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

type CurrentUser = {
  uid: string;
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
  thresholdScore: number;
  originalScore: number;
  retestTestId: string;
  retestTestCode: string;
  scheduledDate: string;
  status:
    | "未受験"
    | "受験済み"
    | "合格"
    | "不合格"
    | "免除";
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
    DEFAULT_THRESHOLD.toString()
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

  /*
   * ========================================================
   * 認証
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

            setCurrentUser({
              uid:
                firebaseUser.uid,

              organizationId:
                typeof data.organizationId ===
                "string"
                  ? data.organizationId
                  : null,

              role:
                isUserRole(
                  data.role
                )
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
            console.error(
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
   * データ読み込み
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

      setTests(
        testSnapshot.docs.map(
          (
            item
          ): Test => {
            const data =
              item.data();

            return {
              id:
                item.id,

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
            };
          }
        )
      );

      setStudents(
        studentSnapshot.docs.map(
          (
            item
          ): Student => {
            const data =
              item.data();

            return {
              id:
                item.id,

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
                data.active !==
                false,
            };
          }
        )
      );

      setAnswers(
        answerSnapshot.docs.map(
          (
            item
          ): Answer => {
            const data =
              item.data();

            return {
              id:
                item.id,

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
        )
      );

      setRetests(
        retestSnapshot.docs.map(
          (
            item
          ): Retest => {
            const data =
              item.data();

            return {
              id:
                item.id,

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

              thresholdScore:
                numberValue(
                  data.thresholdScore
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

              createdAt:
                data.createdAt,
            };
          }
        )
      );

      /*
       * 初期テスト
       */

      if (
        !selectedTestId
      ) {
        const available =
          getAvailableTests(
            testSnapshot.docs.map(
              (
                item
              ) => {
                const data =
                  item.data();

                return {
                  id:
                    item.id,

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
                } satisfies Test;
              }
            ),
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
      console.error(
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
   * 利用可能テスト
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

  /*
   * ========================================================
   * 選択テスト
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

  /*
   * ========================================================
   * 追試候補
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

      const existingStudentIds =
        new Set(
          retests
            .filter(
              (
                retest
              ) =>
                retest.originalTestId ===
                  selectedTest.id &&
                retest.status !==
                  "免除"
            )
            .map(
              (
                retest
              ) =>
                retest.studentId
            )
        );

      const result: Candidate[] =
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
          answer.studentId ===
          null
        ) {
          continue;
        }

        if (
          existingStudentIds.has(
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
      answers,
      students,
      retests,
      currentUser,
    ]);

  /*
   * ========================================================
   * 検索
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
   * 選択
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

  /*
   * ========================================================
   * 追試テストID
   * ========================================================
   */

  function generateRetestCode(
    originalTest: Test
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

    return `${originalTest.testId}-R${date}`;
  }

  /*
   * ========================================================
   * 追試登録
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

      /*
       * 追試テストID
       *
       * 同一の追試テストを
       * 対象者全員で共有する。
       */

      const retestCode =
        generateRetestCode(
          selectedTest
        );

      /*
       * 既に同じ追試コードがあるか確認。
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

      let retestTestDocId =
        duplicate.empty
          ? ""
          : duplicate.docs[0].id;

      /*
       * 追試テストを作成。
       */

      if (
        !retestTestDocId
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

              originalTestId:
                selectedTest.id,

              originalTestCode:
                selectedTest.testId,

              gradingMethod:
                "手動",

              gradingSettings: {
                automaticGrading:
                  false,

                aiGrading:
                  false,

                firstReviewRequired:
                  true,

                secondReviewRequired:
                  true,

                allowManualCorrection:
                  true,
              },

              createdAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),
            }
          );

        retestTestDocId =
          newTest.id;
      }

      /*
       * 対象者ごとに追試レコード作成。
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

            thresholdScore:
              thresholdValue,

            originalScore:
              candidate.answer
                .totalScore,

            retestTestId:
              retestTestDocId,

            retestTestCode:
              retestCode,

            scheduledDate,

            status:
              "未受験",

            createdBy:
              currentUser.uid,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );
      }

      setMessage(
        `${selectedCandidateIds.length}人を追試対象として登録しました。`
      );

      setSelectedCandidateIds(
        []
      );

      if (
        currentUser.organizationId
      ) {
        await loadData(
          currentUser.organizationId
        );
      }
    } catch (err) {
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
      setSaving(false);
    }
  }

  /*
   * ========================================================
   * ステータス変更
   * ========================================================
   */

  async function updateRetestStatus(
    retest: Retest,
    status: Retest["status"]
  ) {
    try {
      setError("");
      setMessage("");

      await updateDoc(
        doc(
          db,
          "retests",
          retest.id
        ),
        {
          status,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "追試ステータスを更新しました。"
      );

      if (
        currentUser?.organizationId
      ) {
        await loadData(
          currentUser.organizationId
        );
      }
    } catch (err) {
      console.error(
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    }
  }

  /*
   * ========================================================
   * 既存追試
   * ========================================================
   */

  const filteredRetests =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return retests.filter(
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
    }, [
      retests,
      selectedTestId,
      search,
      students,
    ]);

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
            1400,

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
            確定した成績から追試対象者を登録・管理します。
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
            基準設定
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            追試対象者を抽出
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
                16,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              対象テスト

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

              {"点"}
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
                    元の得点
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    満点
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    基準点
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredCandidates.map(
                  (
                    candidate
                  ) => {
                    const checked =
                      selectedCandidateIds.includes(
                        candidate.student.id
                      );

                    return (
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
                            checked={
                              checked
                            }
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

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            threshold
                          }
                          点未満
                        </td>
                      </tr>
                    );
                  }
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
            追試一覧
            ================================================== */}

        <section
          style={
            cardStyle
          }
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                追試一覧
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
                  filteredRetests.length
                }
                件
              </p>
            </div>
          </div>

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
                    追試テストID
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
                    元テスト
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
                    基準点
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    実施日
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
                {filteredRetests.map(
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
                            retest.originalTestCode
                          }
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
                          {
                            retest.thresholdScore
                          }
                          点
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            retest.scheduledDate
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            retest.status
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <select
                            value={
                              retest.status
                            }
                            onChange={(
                              event
                            ) =>
                              updateRetestStatus(
                                retest,
                                event
                                  .target
                                  .value as Retest["status"]
                              )
                            }
                            style={{
                              padding:
                                "6px 8px",

                              border:
                                "1px solid #ccc",

                              borderRadius:
                                6,

                              background:
                                "#fff",
                            }}
                          >
                            <option value="未受験">
                              未受験
                            </option>

                            <option value="受験済み">
                              受験済み
                            </option>

                            <option value="合格">
                              合格
                            </option>

                            <option value="不合格">
                              不合格
                            </option>

                            <option value="免除">
                              免除
                            </option>
                          </select>
                        </td>
                      </tr>
                    );
                  }
                )}

                {filteredRetests.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        9
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
                      追試登録はありません。
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
): value is Retest["status"] {
  return (
    value ===
      "未受験" ||
    value ===
      "受験済み" ||
    value ===
      "合格" ||
    value ===
      "不合格" ||
    value ===
      "免除"
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
      return "追試情報を処理できませんでした。";
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
      "8px 12px",

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
