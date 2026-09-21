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
  collection,
  getDocs,
  query,
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
  studentId: string | null;
  testId: string;
  totalScore: number;
  maxScore: number;
  finalized: boolean;
};

type RetestResult = {
  id: string;
  retestId: string;
  originalTestId: string;
  studentId: string;
  retestScore: number;
  appliedScore: number;
  appliedMaxScore: number;
  appliedPercentage: number | null;
};

type ReportRow = {
  testId: string;
  testCode: string;
  testName: string;
  subject: string;
  examDate: string;

  score: number;
  maxScore: number;
  percentage: number;

  average: number | null;
  rank: number | null;
  deviationScore: number | null;

  source:
    | "通常"
    | "追試";
};

export default function ReportCardsPage() {
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
    selectedStudentId,
    setSelectedStudentId,
  ] = useState("");

  const [
    selectedTestId,
    setSelectedTestId,
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

              testId:
                stringValue(
                  data.testId
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

              studentId:
                stringValue(
                  data.studentId
                ),

              retestScore:
                numberValue(
                  data.retestScore
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
        loadedRetests
      );

      /*
       * 初期生徒
       */

      if (
        !selectedStudentId
      ) {
        const availableStudents =
          getAvailableStudents(
            loadedStudents,
            currentUser
          );

        if (
          availableStudents.length >
          0
        ) {
          setSelectedStudentId(
            availableStudents[0].id
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
   * 生徒一覧
   * ========================================================
   */

  const availableStudents =
    useMemo(
      () =>
        getAvailableStudents(
          students,
          currentUser
        ),
      [
        students,
        currentUser,
      ]
    );

  const filteredStudents =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (
        !keyword
      ) {
        return availableStudents;
      }

      return availableStudents.filter(
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
    }, [
      availableStudents,
      search,
    ]);

  /*
   * ========================================================
   * 選択生徒
   * ========================================================
   */

  const selectedStudent =
    students.find(
      (
        student
      ) =>
        student.id ===
        selectedStudentId
    );

  /*
   * ========================================================
   * 追試結果Map
   * ========================================================
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
        map.set(
          `${result.originalTestId}:${result.studentId}`,
          result
        );
      }

      return map;
    }, [
      retestResults,
    ]);

  /*
   * ========================================================
   * 生徒の成績
   * ========================================================
   */

  const reportRows =
    useMemo(() => {
      if (
        !selectedStudent
      ) {
        return [];
      }

      const rows: ReportRow[] =
        [];

      for (
        const test of
          tests
      ) {
        if (
          !test.active
        ) {
          continue;
        }

        /*
         * 生徒の通常答案
         */

        const normalAnswers =
          answers.filter(
            (
              answer
            ) =>
              answer.testId ===
                test.id &&
              answer.studentId ===
                selectedStudent.id &&
              answer.finalized
          );

        const normal =
          normalAnswers[0];

        /*
         * 追試
         */

        const retest =
          retestMap.get(
            `${test.id}:${selectedStudent.id}`
          );

        /*
         * 追試が成績反映されていれば
         * 追試点を採用。
         */
        let score:
          | number
          | null =
          null;

        let maxScore =
          test.totalScore;

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
            test.totalScore;

          source =
            "追試";
        } else if (
          normal
        ) {
          score =
            normal.totalScore;

          maxScore =
            normal.maxScore ||
            test.totalScore;

          source =
            "通常";
        }

        /*
         * 成績がないテストは
         * 成績表に表示しない。
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

        /*
         * 全体母集団で
         * 平均・順位・偏差値を計算。
         */

        const population =
          buildPopulation(
            test,
            students,
            answers,
            retestResults
          );

        const statistics =
          calculateStatistics(
            score,
            population
          );

        rows.push({
          testId:
            test.id,

          testCode:
            test.testId,

          testName:
            test.name,

          subject:
            test.subject,

          examDate:
            test.examDate,

          score,

          maxScore,

          percentage,

          average:
            statistics.average,

          rank:
            statistics.rank,

          deviationScore:
            statistics.deviationScore,

          source,
        });
      }

      /*
       * 日付順
       */

      return rows.sort(
        (
          a,
          b
        ) =>
          a.examDate.localeCompare(
            b.examDate
          )
      );
    }, [
      selectedStudent,
      tests,
      answers,
      retestResults,
      retestMap,
      students,
    ]);

  /*
   * ========================================================
   * Summary
   * ========================================================
   */

  const summary =
    useMemo(() => {
      if (
        reportRows.length ===
        0
      ) {
        return {
          count: 0,
          average: 0,
          averagePercentage: 0,
        };
      }

      const scoreTotal =
        reportRows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            row.score,
          0
        );

      const percentageTotal =
        reportRows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            row.percentage,
          0
        );

      return {
        count:
          reportRows.length,

        average:
          scoreTotal /
          reportRows.length,

        averagePercentage:
          percentageTotal /
          reportRows.length,
      };
    }, [
      reportRows,
    ]);

  /*
   * ========================================================
   * CSV
   * ========================================================
   */

  function exportCSV() {
    if (
      !selectedStudent ||
      reportRows.length ===
        0
    ) {
      setError(
        "出力する成績データがありません。"
      );

      return;
    }

    const header = [
      "テストID",
      "テスト名",
      "教科",
      "実施日",
      "採用元",
      "得点",
      "満点",
      "得点率",
      "平均点",
      "順位",
      "偏差値",
    ];

    const lines =
      reportRows.map(
        (
          row
        ) =>
          [
            csvEscape(
              row.testCode
            ),

            csvEscape(
              row.testName
            ),

            csvEscape(
              row.subject
            ),

            row.examDate,

            row.source,

            row.score,

            row.maxScore,

            row.percentage.toFixed(
              1
            ),

            row.average ===
            null
              ? ""
              : row.average.toFixed(
                  1
                ),

            row.rank ===
            null
              ? ""
              : row.rank,

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
      `${selectedStudent.studentNumber}_${selectedStudent.name}_成績表.csv`;

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

  function printReport() {
    if (
      reportRows.length ===
      0
    ) {
      setError(
        "印刷する成績がありません。"
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
            成績表
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
            1200,

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
            成績表
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
            確定済みの成績を生徒ごとに一覧表示します。
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
            Selection
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
                "repeat(2, minmax(220px, 1fr))",

              gap:
                16,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              生徒

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
                placeholder="氏名・生徒番号・クラスで検索"
                style={
                  inputStyle
                }
              />

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

                {filteredStudents.map(
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
                  すべて
                </option>

                {tests
                  .filter(
                    (
                      test
                    ) =>
                      getAvailableTests(
                        [test],
                        currentUser
                      ).length >
                      0
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
                printReport
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
            Report
            ================================================== */}

        <section
          style={
            reportCardStyle
          }
        >
          {loading ? (
            <div
              style={
                emptyStyle
              }
            >
              成績表を読み込んでいます...
            </div>
          ) : !selectedStudent ? (
            <div
              style={
                emptyStyle
              }
            >
              生徒を選択してください。
            </div>
          ) : (
            <>
              {/* ============================================
                  Report Header
                  ============================================ */}

              <div
                className="reportHeader"
              >
                <div>
                  <h1
                    style={{
                      margin:
                        0,

                      fontSize:
                        26,
                    }}
                  >
                    成績表
                  </h1>

                  <p
                    style={{
                      margin:
                        "8px 0 0",

                      color:
                        "#666",
                    }}
                  >
                    {
                      selectedStudent.studentNumber
                    }
                  </p>
                </div>

                <div
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  <strong
                    style={{
                      fontSize:
                        20,
                    }}
                  >
                    {
                      selectedStudent.name
                    }
                  </strong>

                  <div
                    style={{
                      marginTop:
                        5,

                      color:
                        "#666",

                      fontSize:
                        13,
                    }}
                  >
                    {
                      selectedStudent.grade
                    }

                    {" / "}

                    {
                      selectedStudent.className ||
                      "—"
                    }
                  </div>
                </div>
              </div>

              {/* ============================================
                  Summary
                  ============================================ */}

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(3, 1fr)",

                  gap:
                    12,

                  marginTop:
                    24,

                  marginBottom:
                    24,
                }}
              >
                <Summary
                  label="受験テスト数"
                  value={`${summary.count}件`}
                />

                <Summary
                  label="平均得点"
                  value={`${summary.average.toFixed(
                    1
                  )}点`}
                />

                <Summary
                  label="平均得点率"
                  value={`${summary.averagePercentage.toFixed(
                    1
                  )}%`}
                />
              </div>

              {/* ============================================
                  Results table
                  ============================================ */}

              {reportRows.length ===
              0 ? (
                <div
                  style={
                    emptyStyle
                  }
                >
                  成績データがありません。
                </div>
              ) : (
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
                          実施日
                        </th>

                        <th
                          style={
                            thStyle
                          }
                        >
                          テスト
                        </th>

                        <th
                          style={
                            thStyle
                          }
                        >
                          教科
                        </th>

                        <th
                          style={
                            thStyle
                          }
                        >
                          得点
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
                          平均点
                        </th>

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
                          偏差値
                        </th>

                        <th
                          style={
                            thStyle
                          }
                        >
                          採用元
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {reportRows.map(
                        (
                          row
                        ) => (
                          <tr
                            key={
                              row.testId
                            }
                          >
                            <td
                              style={
                                tdStyle
                              }
                            >
                              {
                                row.examDate
                              }
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              <strong>
                                {
                                  row.testCode
                                }
                              </strong>

                              <div
                                style={{
                                  marginTop:
                                    3,

                                  color:
                                    "#666",

                                  fontSize:
                                    11,
                                }}
                              >
                                {
                                  row.testName
                                }
                              </div>
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {
                                row.subject
                              }
                            </td>

                            <td
                              style={{
                                ...tdStyle,

                                fontWeight:
                                  700,

                                fontSize:
                                  15,
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
                              {row.average ===
                              null
                                ? "—"
                                : `${row.average.toFixed(
                                    1
                                  )}点`}
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {row.rank ===
                              null
                                ? "—"
                                : `${row.rank}位`}
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
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ============================================
                  Footer
                  ============================================ */}

              <div
                style={{
                  marginTop:
                    30,

                  paddingTop:
                    16,

                  borderTop:
                    "1px solid #eee",

                  color:
                    "#777",

                  fontSize:
                    11,

                  lineHeight:
                    1.7,
                }}
              >
                ※ 成績は確定済みのデータを基に集計しています。
                追試で確定し成績へ反映された場合は、その追試得点を採用しています。
              </div>
            </>
          )}
        </section>
      </div>

      <style jsx global>{`
        .reportHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #111;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }

          body {
            background: #fff !important;
          }

          .noPrint {
            display: none !important;
          }

          .reportHeader {
            display: flex;
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
   Population
   ========================================================= */

function buildPopulation(
  test: Test,
  students: Student[],
  answers: Answer[],
  retestResults: RetestResult[]
) {
  const map =
    new Map<
      string,
      number
    >();

  /*
   * 通常答案
   */

  for (
    const answer of
      answers
  ) {
    if (
      answer.testId !==
      test.id
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

    map.set(
      answer.studentId,
      answer.totalScore
    );
  }

  /*
   * 追試結果
   *
   * 追試が存在する場合は
   * 通常点を置き換える。
   */

  for (
    const retest of
      retestResults
  ) {
    if (
      retest.originalTestId !==
      test.id
    ) {
      continue;
    }

    if (
      !retest.studentId
    ) {
      continue;
    }

    map.set(
      retest.studentId,
      retest.appliedScore
    );
  }

  /*
   * 現在有効な生徒だけを
   * 母集団にする。
   */

  return Array.from(
    map.entries()
  )
    .map(
      (
        [
          studentId,
          score,
        ]
      ) => ({
        studentId,
        score,
      })
    )
    .filter(
      (
        row
      ) =>
        students.some(
          (
            student
          ) =>
            student.id ===
              row.studentId &&
            student.active
        )
    );
}

/* =========================================================
   Statistics
   ========================================================= */

function calculateStatistics(
  score: number,
  population: Array<{
    studentId: string;
    score: number;
  }>
) {
  if (
    population.length ===
    0
  ) {
    return {
      average:
        null,

      rank:
        null,

      deviationScore:
        null,
    };
  }

  const scores =
    population.map(
      (
        row
      ) =>
        row.score
    );

  const average =
    scores.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    scores.length;

  /*
   * 順位
   */

  const sorted =
    [...scores].sort(
      (
        a,
        b
      ) =>
        b -
        a
    );

  let rank =
    sorted.findIndex(
      (
        value
      ) =>
        value ===
        score
    ) + 1;

  if (
    rank <=
    0
  ) {
    rank =
      null as unknown as number;
  }

  /*
   * 標準偏差
   */

  const variance =
    scores.reduce(
      (
        sum,
        value
      ) =>
        sum +
        Math.pow(
          value -
            average,
          2
        ),
      0
    ) /
    scores.length;

  const standardDeviation =
    Math.sqrt(
      variance
    );

  const deviationScore =
    standardDeviation ===
    0
      ? 50
      : 50 +
        10 *
          (
            score -
            average
          ) /
            standardDeviation;

  return {
    average,

    rank,

    deviationScore,
  };
}

/* =========================================================
   Students
   ========================================================= */

function getAvailableStudents(
  students: Student[],
  user: CurrentUser | null
) {
  if (
    !user
  ) {
    return [];
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return students;
  }

  return students.filter(
    (
      student
    ) =>
      user.schoolIds.includes(
        student.schoolId
      )
  );
}

/* =========================================================
   Tests
   ========================================================= */

function getAvailableTests(
  tests: Test[],
  user: CurrentUser | null
) {
  if (
    !user
  ) {
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
      return "成績表を取得できませんでした。";
  }
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

const reportCardStyle:
  React.CSSProperties = {
    ...cardStyle,

    maxWidth:
      1200,

    margin:
      "0 auto",
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

const emptyStyle:
  React.CSSProperties = {
    padding:
      60,

    textAlign:
      "center",

    color:
      "#777",
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
