"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

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

  studentId: string | null;

  studentNumber: string | null;

  testId: string;

  testCode: string;

  schoolId: string;

  status: string;

  gradingStatus: string;

  finalized: boolean;

  totalScore: number;

  maxScore: number;
};

type RetestResult = {
  id: string;

  retestId: string;

  originalTestId: string;

  originalTestCode: string;

  studentId: string;

  studentNumber: string;

  originalScore: number;

  retestScore: number;

  retestMaxScore: number;

  retestPercentage: number | null;

  appliedScore: number;

  appliedMaxScore: number;

  appliedPercentage: number | null;

  source: "追試";
};

type ResultRow = {
  answerId: string;

  studentId: string;

  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  schoolId: string;

  originalScore: number | null;

  retestScore: number | null;

  score: number;

  maxScore: number;

  percentage: number;

  source:
    | "通常"
    | "追試";

  rank: number;

  deviationScore:
    | number
    | null;
};

export default function ResultsPage() {
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
    retestResults,
    setRetestResults,
  ] = useState<RetestResult[]>([]);

  const [
    selectedTestId,
    setSelectedTestId,
  ] = useState("");

  const [
    selectedClass,
    setSelectedClass,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

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
   * Data loading
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
        retestResultSnapshot,
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

          /*
           * 通常テストの確定答案。
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
           * 追試で確定し、
           * 通常成績への反映対象になったデータ。
           */
          getDocs(
            query(
              collection(
                db,
                "retestResults"
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

              totalScore:
                numberValue(
                  data.totalScore
                ),

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
        );

      const loadedAnswers =
        answerSnapshot.docs.map(
          (
            item
          ): Answer => {
            const data =
              item.data();

            return {
              id:
                item.id,

              studentId:
                nullableString(
                  data.studentId
                ),

              studentNumber:
                nullableString(
                  data.studentNumber
                ),

              testId:
                stringValue(
                  data.testId
                ),

              testCode:
                stringValue(
                  data.testCode
                ),

              schoolId:
                stringValue(
                  data.schoolId
                ),

              status:
                stringValue(
                  data.status
                ),

              gradingStatus:
                stringValue(
                  data.gradingStatus
                ),

              finalized:
                data.finalized ===
                true,

              totalScore:
                numberValue(
                  data.totalScore
                ),

              maxScore:
                numberValue(
                  data.maxScore
                ),
            };
          }
        );

      const loadedRetestResults =
        retestResultSnapshot.docs.map(
          (
            item
          ): RetestResult => {
            const data =
              item.data();

            return {
              id:
                item.id,

              retestId:
                stringValue(
                  data.retestId
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

              retestScore:
                numberValue(
                  data.retestScore
                ),

              retestMaxScore:
                numberValue(
                  data.retestMaxScore
                ),

              retestPercentage:
                nullableNumber(
                  data.retestPercentage
                ),

              appliedScore:
                numberValue(
                  data.appliedScore
                ),

              appliedMaxScore:
                numberValue(
                  data.appliedMaxScore
                ),

              appliedPercentage:
                nullableNumber(
                  data.appliedPercentage
                ),

              source:
                "追試",
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

      setRetestResults(
        loadedRetestResults
      );

      /*
       * 初期テスト。
       */
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

  /*
   * ========================================================
   * Selected test
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
   * Classes
   * ========================================================
   */

  const availableClasses =
    useMemo(() => {
      if (
        !selectedTest
      ) {
        return [];
      }

      return Array.from(
        new Set(
          students
            .filter(
              (
                student
              ) =>
                student.schoolId ===
                selectedTest.schoolId
            )
            .map(
              (
                student
              ) =>
                student.className
            )
            .filter(
              Boolean
            )
        )
      ).sort();
    }, [
      students,
      selectedTest,
    ]);

  /*
   * ========================================================
   * Retest lookup
   * ========================================================
   *
   * 同じ生徒・同じ元テストに複数の
   * retestResultsがある場合は、
   * 最後のものを採用する。
   */

  const retestMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          RetestResult
        >();

      for (
        const result of
          retestResults
      ) {
        if (
          !result.originalTestId
        ) {
          continue;
        }

        const key =
          `${result.originalTestId}:${result.studentId}`;

        map.set(
          key,
          result
        );
      }

      return map;
    }, [
      retestResults,
    ]);

  /*
   * ========================================================
   * 成績行
   * ========================================================
   */

  const resultRows =
    useMemo(() => {
      if (
        !selectedTest
      ) {
        return [];
      }

      /*
       * 生徒ごとに通常答案を1件だけ採用。
       */
      const normalByStudent =
        new Map<
          string,
          Answer
        >();

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

        const existing =
          normalByStudent.get(
            answer.studentId
          );

        /*
         * 複数答案がある場合は
         * 後から取得したものを採用。
         *
         * 本番では answer の
         * finalizedAt 等を使って
         * 明示的に決める。
         */
        if (
          !existing
        ) {
          normalByStudent.set(
            answer.studentId,
            answer
          );
        }
      }

      /*
       * まず通常答案が存在する生徒を登録。
       */
      const studentIds =
        new Set<string>();

      for (
        const student of
          students
      ) {
        if (
          student.schoolId !==
          selectedTest.schoolId
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

        studentIds.add(
          student.id
        );
      }

      /*
       * 通常受験者＋追試で
       * 成績に反映された生徒。
       */
      const rows: ResultRow[] =
        [];

      for (
        const studentId of
          studentIds
      ) {
        const student =
          students.find(
            (
              item
            ) =>
              item.id ===
              studentId
          );

        if (
          !student
        ) {
          continue;
        }

        /*
         * クラス
         */
        if (
          selectedClass &&
          student.className !==
            selectedClass
        ) {
          continue;
        }

        /*
         * 検索
         */
        const keyword =
          search
            .trim()
            .toLowerCase();

        if (
          keyword &&
          !student.name
            .toLowerCase()
            .includes(
              keyword
            ) &&
          !student.studentNumber.includes(
            keyword
          )
        ) {
          continue;
        }

        const normal =
          normalByStudent.get(
            studentId
          );

        const retest =
          retestMap.get(
            `${selectedTest.id}:${studentId}`
          );

        /*
         * 通常点
         */
        const normalScore =
          normal
            ? normal.totalScore
            : null;

        /*
         * 追試点
         *
         * retestResultsに存在する場合、
         * それを採用。
         */
        const retestScore =
          retest
            ? retest.appliedScore
            : null;

        /*
         * 最終採用点
         *
         * 追試結果があれば追試点。
         * なければ通常点。
         */
        let score:
          | number
          | null =
          null;

        let maxScore =
          selectedTest.totalScore;

        let source:
          | "通常"
          | "追試" =
          "通常";

        if (
          retest
        ) {
          score =
            retest.appliedScore;

          maxScore =
            retest.appliedMaxScore ||
            selectedTest.totalScore;

          source =
            "追試";
        } else if (
          normal
        ) {
          score =
            normal.totalScore;

          maxScore =
            normal.maxScore ||
            selectedTest.totalScore;

          source =
            "通常";
        }

        /*
         * 成績が存在しない生徒は
         * 母集団に入れない。
         */
        if (
          score ===
          null
        ) {
          continue;
        }

        const percentage =
          maxScore >
          0
            ? (
                score /
                maxScore
              ) *
              100
            : 0;

        rows.push({
          answerId:
            normal?.id ??
            retest?.retestId ??
            "",

          studentId,

          studentNumber:
            student.studentNumber,

          name:
            student.name,

          grade:
            student.grade,

          className:
            student.className,

          schoolId:
            student.schoolId,

          originalScore:
            normalScore,

          retestScore,

          score,

          maxScore,

          percentage,

          source,

          rank:
            0,

          deviationScore:
            null,
        });
      }

      /*
       * ====================================================
       * 全体母集団で順位
       * ====================================================
       */

      const sorted =
        [...rows].sort(
          (
            a,
            b
          ) =>
            b.score -
            a.score
        );

      let previousScore:
        number | null =
        null;

      let previousRank =
        0;

      sorted.forEach(
        (
          row,
          index
        ) => {
          if (
            previousScore ===
            row.score
          ) {
            row.rank =
              previousRank;
          } else {
            row.rank =
              index + 1;

            previousRank =
              row.rank;

            previousScore =
              row.score;
          }
        }
      );

      /*
       * ====================================================
       * 全体母集団で平均・偏差値
       * ====================================================
       */

      if (
        sorted.length >
        0
      ) {
        const mean =
          sorted.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.score,
            0
          ) /
          sorted.length;

        const variance =
          sorted.reduce(
            (
              sum,
              row
            ) =>
              sum +
              Math.pow(
                row.score -
                  mean,
                2
              ),
            0
          ) /
          sorted.length;

        const standardDeviation =
          Math.sqrt(
            variance
          );

        sorted.forEach(
          (
            row
          ) => {
            if (
              standardDeviation ===
              0
            ) {
              row.deviationScore =
                50;
            } else {
              row.deviationScore =
                50 +
                10 *
                  (
                    row.score -
                    mean
                  ) /
                    standardDeviation;
            }
          }
        );
      }

      return sorted;
    }, [
      answers,
      students,
      selectedTest,
      currentUser,
      selectedClass,
      search,
      retestMap,
    ]);

  /*
   * ========================================================
   * Statistics
   * ========================================================
   */

  const statistics =
    useMemo(() => {
      if (
        resultRows.length ===
        0
      ) {
        return {
          count: 0,
          average: 0,
          highest: 0,
          lowest: 0,
        };
      }

      const total =
        resultRows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            row.score,
          0
        );

      return {
        count:
          resultRows.length,

        average:
          total /
          resultRows.length,

        highest:
          Math.max(
            ...resultRows.map(
              (
                row
              ) =>
                row.score
            )
          ),

        lowest:
          Math.min(
            ...resultRows.map(
              (
                row
              ) =>
                row.score
            )
          ),
      };
    }, [
      resultRows,
    ]);

  /*
   * ========================================================
   * CSV
   * ========================================================
   */

  function exportCSV() {
    if (
      !selectedTest ||
      resultRows.length ===
        0
    ) {
      setError(
        "出力する成績データがありません。"
      );

      return;
    }

    const header = [
      "順位",
      "生徒番号",
      "氏名",
      "学年",
      "クラス",
      "採用元",
      "通常得点",
      "追試得点",
      "採用得点",
      "満点",
      "得点率",
      "偏差値",
    ];

    const lines =
      resultRows.map(
        (
          row
        ) =>
          [
            row.rank,

            csvEscape(
              row.studentNumber
            ),

            csvEscape(
              row.name
            ),

            csvEscape(
              row.grade
            ),

            csvEscape(
              row.className
            ),

            row.source,

            row.originalScore ??
              "",

            row.retestScore ??
              "",

            row.score,

            row.maxScore,

            row.percentage.toFixed(
              1
            ),

            row.deviationScore ===
            null
              ? ""
              : row.deviationScore.toFixed(
                  1
                ),
          ].join(",")
      );

    const csv =
      "\uFEFF" +
      [
        header.join(
          ","
        ),
        ...lines,
      ].join(
        "\r\n"
      );

    const blob =
      new Blob(
        [
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    anchor.download =
      `${selectedTest.testId}_成績一覧.csv`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url
    );

    setMessage(
      "CSVを出力しました。"
    );
  }

  /*
   * ========================================================
   * Print
   * ========================================================
   */

  function printResults() {
    if (
      resultRows.length ===
      0
    ) {
      setError(
        "印刷する成績データがありません。"
      );

      return;
    }

    window.print();
  }

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
            成績管理
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
            1500,

          margin:
            "0 auto",
        }}
      >
        {/* ==================================================
            Header
            ================================================== */}

        <header
          className="noPrint"
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
            成績管理
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
            確定した通常答案と、確定して成績へ反映された追試結果を同じ母集団で集計します。
          </p>
        </header>

        {error && (
          <div
            className="noPrint"
            style={
              errorStyle
            }
          >
            {error}
          </div>
        )}

        {message && (
          <div
            className="noPrint"
            style={
              successStyle
            }
          >
            {message}
          </div>
        )}

        {/* ==================================================
            Filters
            ================================================== */}

        <section
          className="noPrint"
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",

              gap:
                14,
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

                  setSelectedClass(
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
              クラス

              <select
                value={
                  selectedClass
                }
                onChange={(
                  event
                ) =>
                  setSelectedClass(
                    event.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="">
                  すべて
                </option>

                {availableClasses.map(
                  (
                    className
                  ) => (
                    <option
                      key={
                        className
                      }
                      value={
                        className
                      }
                    >
                      {
                        className
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
                placeholder="氏名・生徒番号"
                style={
                  inputStyle
                }
              />
            </label>
          </div>

          <div
            style={{
              display:
                "flex",

              gap:
                10,

              flexWrap:
                "wrap",

              marginTop:
                18,
            }}
          >
            <button
              type="button"
              onClick={
                exportCSV
              }
              style={
                secondaryButton
              }
            >
              CSV出力
            </button>

            <button
              type="button"
              onClick={
                printResults
              }
              style={
                secondaryButton
              }
            >
              印刷
            </button>
          </div>
        </section>

        {/* ==================================================
            Summary
            ================================================== */}

        {selectedTest && (
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
                  "grid",

                gridTemplateColumns:
                  "repeat(4, 1fr)",

                gap:
                  12,
              }}
            >
              <Summary
                label="集計人数"
                value={`${statistics.count}人`}
              />

              <Summary
                label="平均点"
                value={`${statistics.average.toFixed(
                  1
                )}点`}
              />

              <Summary
                label="最高点"
                value={`${statistics.highest}点`}
              />

              <Summary
                label="最低点"
                value={`${statistics.lowest}点`}
              />
            </div>
          </section>
        )}

        {/* ==================================================
            Results
            ================================================== */}

        <section
          style={
            cardStyle
          }
        >
          {loading ? (
            <p>
              成績を読み込んでいます...
            </p>
          ) : !selectedTest ? (
            <div
              style={{
                padding:
                  60,

                textAlign:
                  "center",

                color:
                  "#777",
              }}
            >
              テストを選択してください。
            </div>
          ) : resultRows.length ===
            0 ? (
            <div
              style={{
                padding:
                  60,

                textAlign:
                  "center",

                color:
                  "#777",
              }}
            >
              確定済みの成績データがありません。
            </div>
          ) : (
            <>
              <div
                className="printHeader"
              >
                <h1>
                  {
                    selectedTest.name
                  }
                </h1>

                <p>
                  テストID：
                  {
                    selectedTest.testId
                  }
                  {" / "}
                  {
                    selectedTest.subject
                  }
                </p>
              </div>

              <div
                style={{
                  overflowX:
                    "auto",
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
                        順位
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
                        採用元
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        通常得点
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
                        採用得点
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
                        偏差値
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {resultRows.map(
                      (
                        row
                      ) => (
                        <tr
                          key={
                            row.studentId
                          }
                        >
                          <td
                            style={{
                              ...tdStyle,

                              fontWeight:
                                700,
                            }}
                          >
                            {
                              row.rank
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              row.studentNumber
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              row.name
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              row.grade
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              row.className ||
                              "—"
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            <span
                              style={{
                                display:
                                  "inline-block",

                                padding:
                                  "4px 8px",

                                borderRadius:
                                  999,

                                background:
                                  row.source ===
                                  "追試"
                                    ? "#f5f5f5"
                                    : "#eef5fc",

                                fontSize:
                                  11,

                                fontWeight:
                                  600,
                              }}
                            >
                              {
                                row.source
                              }
                            </span>
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {row.originalScore ===
                            null
                              ? "—"
                              : `${row.originalScore}点`}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {row.retestScore ===
                            null
                              ? "—"
                              : `${row.retestScore}点`}
                          </td>

                          <td
                            style={{
                              ...tdStyle,

                              fontWeight:
                                700,
                            }}
                          >
                            {
                              row.score
                            }
                            {" / "}
                            {
                              row.maxScore
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              row.percentage.toFixed(
                                1
                              )
                            }
                            %
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {row.deviationScore ===
                            null
                              ? "—"
                              : row.deviationScore.toFixed(
                                  1
                                )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <style jsx global>{`
        .printHeader {
          display: none;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          body {
            background: #fff !important;
          }

          .noPrint {
            display: none !important;
          }

          .printHeader {
            display: block;
            margin-bottom: 10mm;
          }

          .printHeader h1 {
            margin: 0 0 3mm;
            font-size: 18pt;
          }

          .printHeader p {
            margin: 0;
            font-size: 9pt;
          }

          section {
            border: none !important;
            padding: 0 !important;
          }

          table {
            font-size: 8pt !important;
          }

          th,
          td {
            padding: 2.5mm !important;
          }
        }
      `}</style>
    </main>
  );
}

/* =========================================================
   Summary
   ========================================================= */

function Summary({
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
          16,

        border:
          "1px solid #eee",

        borderRadius:
          9,

        background:
          "#fafafa",
      }}
    >
      <div
        style={{
          color:
            "#777",

          fontSize:
            12,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display:
            "block",

          marginTop:
            5,

          fontSize:
            20,
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

function nullableNumber(
  value: unknown
) {
  return typeof value ===
    "number"
    ? value
    : null;
}

function csvEscape(
  value: string
) {
  return `"${value.replace(
    /"/g,
    '""'
  )}"`;
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
      return "成績データを取得できませんでした。";
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

const secondaryButton:
  React.CSSProperties = {
    padding:
      "10px 16px",

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
      "12px 10px",

    borderBottom:
      "1px solid #eee",

    fontSize:
      13,

    whiteSpace:
      "nowrap",
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
