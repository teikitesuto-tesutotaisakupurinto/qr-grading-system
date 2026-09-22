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
  getScopedDocs,
  gradeReportsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  GradeReport,
  GradeReportSubject,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type ReportRow =
  GradeReport;

/* =========================================================
   Page
   ========================================================= */

export default function ReportsManagementPage() {
  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    reports,
    setReports,
  ] =
    useState<ReportRow[]>(
      []
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(null);

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
    search,
    setSearch,
  ] =
    useState("");

  const [
    gradeFilter,
    setGradeFilter,
  ] =
    useState("");

  const [
    classFilter,
    setClassFilter,
  ] =
    useState("");

  /* =======================================================
     Load
     ======================================================= */

  useEffect(() => {
    void loadReports();
  }, []);

  async function loadReports() {
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
          "この画面は管理者・講師用です。"
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

      const documents =
        await getScopedDocs(
          gradeReportsQueries(
            scopeUser
          )
        );

      const loaded =
        documents
          .map(
            (
              item
            ) =>
              normalizeReport(
                item.id,
                item.data
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

      setReports(
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
                report
              ) =>
                report.id ===
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
        "Reports management load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "成績表を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Filters
     ======================================================= */

  const grades =
    useMemo(
      () =>
        Array.from(
          new Set(
            reports
              .map(
                (
                  report
                ) =>
                  report.grade
              )
              .filter(
                Boolean
              )
          )
        ).sort(),
      [
        reports,
      ]
    );

  const classes =
    useMemo(
      () =>
        Array.from(
          new Set(
            reports
              .filter(
                (
                  report
                ) =>
                  !gradeFilter ||
                  report.grade ===
                    gradeFilter
              )
              .map(
                (
                  report
                ) =>
                  report.className
              )
              .filter(
                Boolean
              )
          )
        ).sort(),
      [
        reports,
        gradeFilter,
      ]
    );

  const filtered =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return reports.filter(
        (
          report
        ) => {
          const searchMatch =
            !keyword ||
            report.studentName
              .toLowerCase()
              .includes(
                keyword
              ) ||
            report.studentNumber
              .toLowerCase()
              .includes(
                keyword
              ) ||
            report.testName
              .toLowerCase()
              .includes(
                keyword
              );

          const gradeMatch =
            !gradeFilter ||
            report.grade ===
              gradeFilter;

          const classMatch =
            !classFilter ||
            report.className ===
              classFilter;

          return (
            searchMatch &&
            gradeMatch &&
            classMatch
          );
        }
      );
    }, [
      reports,
      search,
      gradeFilter,
      classFilter,
    ]);

  /* =======================================================
     Selected
     ======================================================= */

  const selected =
    reports.find(
      (
        report
      ) =>
        report.id ===
        selectedId
    ) ??
    null;

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
            成績表
          </h1>

          <p>
            成績表を読み込んでいます...
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
              成績表
            </h1>

            <p className="muted">
              生徒ごとの確定済み成績を確認します。
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
              href="/results/management"
              className="button"
            >
              成績一覧
            </Link>
          </div>
        </header>

        {/* ==================================================
            Error
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

        {/* ==================================================
            Filters
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 180px 180px",

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
                gradeFilter
              }
              onChange={(
                event
              ) => {
                setGradeFilter(
                  event.target
                    .value
                );

                setClassFilter(
                  ""
                );
              }}
            >
              <option value="">
                全学年
              </option>

              {grades.map(
                (
                  grade
                ) => (
                  <option
                    key={
                      grade
                    }
                    value={
                      grade
                    }
                  >
                    {
                      grade
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                classFilter
              }
              onChange={(
                event
              ) =>
                setClassFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                全クラス
              </option>

              {classes.map(
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
              "minmax(350px, .75fr) minmax(0, 1.8fr)",

            gap:
              18,

            marginTop:
              16,

            alignItems:
              "start",
          }}
        >

          {/* ================================================
              Report list
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
                成績表一覧
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
                  report
                ) => (
                  <button
                    key={
                      report.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedId(
                        report.id
                      )
                    }
                    style={{
                      display:
                        "block",

                      width:
                        "100%",

                      marginBottom:
                        8,

                      padding:
                        13,

                      border:
                        selectedId ===
                        report.id
                          ? "2px solid #111"
                          : "1px solid #ddd",

                      borderRadius:
                        8,

                      background:
                        selectedId ===
                        report.id
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
                          8,
                      }}
                    >
                      <strong>
                        {
                          report.studentName
                        }
                      </strong>

                      <span
                        className="muted"
                        style={{
                          fontSize:
                            10,
                        }}
                      >
                        {
                          report.examDate ||
                          "日付未設定"
                        }
                      </span>
                    </div>

                    <div
                      className="muted"
                      style={{
                        marginTop:
                          4,

                        fontSize:
                          11,
                      }}
                    >
                      {
                        report.studentNumber
                      }

                      {" / "}

                      {
                        report.grade
                      }

                      {report.className &&
                        ` / ${report.className}`}
                    </div>

                    <div
                      style={{
                        marginTop:
                          8,

                        fontSize:
                          12,
                      }}
                    >
                      {
                        report.testName
                      }
                    </div>

                    <div
                      style={{
                        display:
                          "flex",

                        gap:
                          8,

                        marginTop:
                          9,
                      }}
                    >
                      <MiniStat
                        label="合計"
                        value={`${report.totalScore}/${report.totalMaxScore}`}
                      />

                      <MiniStat
                        label="偏差値"
                        value={
                          report.totalDeviation ===
                          null
                            ? "—"
                            : report.totalDeviation.toFixed(
                                1
                              )
                        }
                      />

                      <MiniStat
                        label="順位"
                        value={formatRank(
                          report.totalRank,
                          report.totalPopulation
                        )}
                      />
                    </div>
                  </button>
                )
              )
            )}
          </section>

          {/* ================================================
              Report
              ================================================ */}

          <section className="card">
            {!selected ? (
              <EmptyDetail />
            ) : (
              <ReportSheet
                report={
                  selected
                }
              />
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   Report sheet
   ========================================================= */

function ReportSheet({
  report,
}: {
  report: GradeReport;
}) {
  return (
    <article
      style={{
        background:
          "#fff",
      }}
    >
      {/* ==================================================
          Report header
          ================================================== */}

      <header
        style={{
          paddingBottom:
            18,

          borderBottom:
            "2px solid #222",
        }}
      >
        <div
          style={{
            textAlign:
              "center",
          }}
        >
          <div
            style={{
              fontSize:
                11,

              color:
                "#666",
            }}
          >
            テストシステム
          </div>

          <h2
            style={{
              margin:
                "5px 0 0",

              fontSize:
                25,

              letterSpacing:
                ".08em",
            }}
          >
            成績表
          </h2>

          <div
            style={{
              marginTop:
                5,

              fontSize:
                13,

              fontWeight:
                700,
            }}
          >
            {
              report.testName
            }
          </div>
        </div>

        {/* Student info */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "1fr 1fr 1fr",

            gap:
              0,

            marginTop:
              18,

            border:
              "1px solid #222",
          }}
        >
          <ReportInfo
            label="生徒番号"
            value={
              report.studentNumber
            }
          />

          <ReportInfo
            label="氏名"
            value={
              report.studentName
            }
          />

          <ReportInfo
            label="学年・クラス"
            value={[
              report.grade,
              report.className,
            ]
              .filter(
                Boolean
              )
              .join(
                " / "
              )}
          />

          <ReportInfo
            label="校舎"
            value={
              report.schoolName ||
              report.enrolledSchool
            }
          />

          <ReportInfo
            label="実施日"
            value={
              report.examDate ||
              "—"
            }
          />

          <ReportInfo
            label="総合順位"
            value={formatRank(
              report.totalRank,
              report.totalPopulation
            )}
          />
        </div>
      </header>

      {/* ==================================================
          Overall
          ================================================== */}

      <section
        style={{
          marginTop:
            18,
        }}
      >
        <h3
          style={{
            margin:
              "0 0 10px",
          }}
        >
          総合成績
        </h3>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",

            border:
              "1px solid #222",
          }}
        >
          <BigScore
            label="総合得点"
            value={`${report.totalScore} / ${report.totalMaxScore}`}
          />

          <BigScore
            label="平均点"
            value={
              report.totalAverage ===
              null
                ? "—"
                : report.totalAverage.toFixed(
                    1
                  )
            }
          />

          <BigScore
            label="偏差値"
            value={
              report.totalDeviation ===
              null
                ? "—"
                : report.totalDeviation.toFixed(
                    1
                  )
            }
          />

          <BigScore
            label="順位"
            value={formatRank(
              report.totalRank,
              report.totalPopulation
            )}
          />
        </div>
      </section>

      {/* ==================================================
          Subjects
          ================================================== */}

      <section
        style={{
          marginTop:
            20,
        }}
      >
        <h3
          style={{
            margin:
              "0 0 10px",
          }}
        >
          教科別成績
        </h3>

        {report.subjects.length ===
        0 ? (
          <div
            style={{
              padding:
                35,

              textAlign:
                "center",

              border:
                "1px solid #ddd",

              color:
                "#777",

              fontSize:
                12,
            }}
          >
            教科別成績がありません。
          </div>
        ) : (
          <div
            style={{
              overflowX:
                "auto",
            }}
          >
            <table
              style={{
                width:
                  "100%",

                borderCollapse:
                  "collapse",

                fontSize:
                  12,
              }}
            >
              <thead>
                <tr>
                  <ReportTh>
                    教科
                  </ReportTh>

                  <ReportTh>
                    得点
                  </ReportTh>

                  <ReportTh>
                    平均点
                  </ReportTh>

                  <ReportTh>
                    偏差値
                  </ReportTh>

                  <ReportTh>
                    順位
                  </ReportTh>

                  <ReportTh>
                    受験者数
                  </ReportTh>
                </tr>
              </thead>

              <tbody>
                {report.subjects.map(
                  (
                    subject
                  ) => (
                    <tr
                      key={
                        subject.subject
                      }
                    >
                      <ReportTd
                        strong
                      >
                        {
                          subject.subject
                        }
                      </ReportTd>

                      <ReportTd>
                        {
                          subject.score
                        }
                        {" / "}
                        {
                          subject.maxScore
                        }
                      </ReportTd>

                      <ReportTd>
                        {
                          subject.average ===
                          null
                            ? "—"
                            : subject.average.toFixed(
                                1
                              )
                        }
                      </ReportTd>

                      <ReportTd>
                        {
                          subject.deviation ===
                          null
                            ? "—"
                            : subject.deviation.toFixed(
                                1
                              )
                        }
                      </ReportTd>

                      <ReportTd>
                        {formatRank(
                          subject.rank,
                          subject.population
                        )}
                      </ReportTd>

                      <ReportTd>
                        {
                          subject.population ??
                          "—"
                        }
                      </ReportTd>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ==================================================
          Distribution
          ================================================== */}

      <section
        style={{
          marginTop:
            20,
        }}
      >
        <h3
          style={{
            margin:
              "0 0 10px",
          }}
        >
          得点分布
        </h3>

        {report.subjects.some(
          (
            subject
          ) =>
            subject.distribution.length >
            0
        ) ? (
          <DistributionTable
            subjects={
              report.subjects
            }
          />
        ) : (
          <div
            style={{
              padding:
                30,

              border:
                "1px solid #ddd",

              textAlign:
                "center",

              color:
                "#777",

              fontSize:
                12,
            }}
          >
            得点分布データはまだありません。
          </div>
        )}
      </section>

      {/* ==================================================
          Footer
          ================================================== */}

      <footer
        style={{
          marginTop:
            25,

          paddingTop:
            12,

          borderTop:
            "1px solid #ddd",

          color:
            "#777",

          fontSize:
            10,

          textAlign:
            "right",
        }}
      >
        テストシステム
      </footer>
    </article>
  );
}

/* =========================================================
   Distribution
   ========================================================= */

function DistributionTable({
  subjects,
}: {
  subjects:
    GradeReportSubject[];
}) {
  const distribution =
    subjects.flatMap(
      (
        subject
      ) =>
        subject.distribution.map(
          (
            item
          ) => ({
            ...item,

            subject:
              subject.subject,
          })
        )
    );

  return (
    <div
      style={{
        overflowX:
          "auto",
      }}
    >
      <table
        style={{
          width:
            "100%",

          borderCollapse:
            "collapse",

          fontSize:
            11,
        }}
      >
        <thead>
          <tr>
            <ReportTh>
              教科
            </ReportTh>

            <ReportTh>
              範囲
            </ReportTh>

            <ReportTh>
              人数
            </ReportTh>
          </tr>
        </thead>

        <tbody>
          {distribution.map(
            (
              item,
              index
            ) => (
              <tr
                key={
                  `${item.subject}-${item.range}-${index}`
                }
              >
                <ReportTd>
                  {
                    item.subject
                  }
                </ReportTd>

                <ReportTd>
                  {
                    item.range
                  }
                </ReportTd>

                <ReportTd>
                  {
                    item.count
                  }
                </ReportTd>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   Report info
   ========================================================= */

function ReportInfo({
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
          "9px 10px",

        borderRight:
          "1px solid #222",

        borderBottom:
          "1px solid #222",

        minHeight:
          45,
      }}
    >
      <div
        style={{
          fontSize:
            9,

          color:
            "#666",
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
            3,

          fontSize:
            12,
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
   Big score
   ========================================================= */

function BigScore({
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
          14,

        textAlign:
          "center",

        borderRight:
          "1px solid #222",
      }}
    >
      <div
        style={{
          fontSize:
            9,

          color:
            "#666",
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
            5,

          fontSize:
            18,
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

        background:
          "#f1f1f1",

        borderRadius:
          5,

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
   Table
   ========================================================= */

function ReportTh({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <th
      style={{
        padding:
          "8px 7px",

        border:
          "1px solid #222",

        background:
          "#f1f1f1",

        fontWeight:
          700,

        textAlign:
          "center",

        whiteSpace:
          "nowrap",
      }}
    >
      {
        children
      }
    </th>
  );
}

function ReportTd({
  children,
  strong = false,
}: {
  children:
    React.ReactNode;

  strong?: boolean;
}) {
  return (
    <td
      style={{
        padding:
          "8px 7px",

        border:
          "1px solid #222",

        textAlign:
          "center",

        fontWeight:
          strong
            ? 700
            : 400,
      }}
    >
      {
        children
      }
    </td>
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
        成績表はありません。
      </strong>

      <p
        style={{
          marginTop:
            6,

          fontSize:
            12,
        }}
      >
        成績表データが作成されると、ここに表示されます。
      </p>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div
      style={{
        minHeight:
          700,

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
          成績表を選択してください
        </strong>

        <p
          style={{
            marginTop:
              6,

            fontSize:
              12,
          }}
        >
          左側から生徒の成績表を選択してください。
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   Normalize
   ========================================================= */

function normalizeReport(
  id: string,
  data: Record<
    string,
    unknown
  >
): GradeReport {
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

    studentId:
      stringValue(
        data.studentId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    studentName:
      stringValue(
        data.studentName
      ),

    schoolName:
      stringValue(
        data.schoolName
      ),

    grade:
      stringValue(
        data.grade
      ),

    className:
      stringValue(
        data.className
      ),

    gender:
      stringValue(
        data.gender
      ),

    enrolledSchool:
      stringValue(
        data.enrolledSchool
      ),

    testId:
      stringValue(
        data.testId
      ),

    testName:
      stringValue(
        data.testName
      ),

    examDate:
      stringValue(
        data.examDate
      ),

    subjects:
      normalizeSubjects(
        data.subjects
      ),

    totalScore:
      safeNumber(
        data.totalScore
      ),

    totalMaxScore:
      safeNumber(
        data.totalMaxScore
      ),

    totalAverage:
      nullableNumber(
        data.totalAverage
      ),

    totalDeviation:
      nullableNumber(
        data.totalDeviation
      ),

    totalRank:
      nullableNumber(
        data.totalRank
      ),

    totalPopulation:
      nullableNumber(
        data.totalPopulation
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Subjects
   ========================================================= */

function normalizeSubjects(
  value: unknown
): GradeReportSubject[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value.map(
    (
      item
    ) => {
      const data =
        item &&
        typeof item ===
          "object"
          ? item as Record<
              string,
              unknown
            >
          : {};

      return {
        subject:
          stringValue(
            data.subject
          ),

        maxScore:
          safeNumber(
            data.maxScore
          ),

        score:
          safeNumber(
            data.score
          ),

        average:
          nullableNumber(
            data.average
          ),

        deviation:
          nullableNumber(
            data.deviation
          ),

        rank:
          nullableNumber(
            data.rank
          ),

        population:
          nullableNumber(
            data.population
          ),

        distribution:
          normalizeDistribution(
            data.distribution
          ),
      };
    }
  );
}

/* =========================================================
   Distribution
   ========================================================= */

function normalizeDistribution(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value.map(
    (
      item
    ) => {
      const data =
        item &&
        typeof item ===
          "object"
          ? item as Record<
              string,
              unknown
            >
          : {};

      return {
        range:
          stringValue(
            data.range
          ),

        minScore:
          safeNumber(
            data.minScore
          ),

        maxScore:
          safeNumber(
            data.maxScore
          ),

        count:
          safeNumber(
            data.count
          ),

        selected:
          data.selected ===
          true,
      };
    }
  );
}

/* =========================================================
   Rank
   ========================================================= */

function formatRank(
  rank:
    | number
    | null,

  population:
    | number
    | null
) {
  if (
    rank ===
    null
  ) {
    return "—";
  }

  if (
    population ===
    null
  ) {
    return String(
      rank
    );
  }

  return `${rank} / ${population}`;
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
