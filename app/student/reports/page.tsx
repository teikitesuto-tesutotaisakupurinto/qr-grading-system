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
} from "@/lib/types";

/* =========================================================
   Page
   ========================================================= */

export default function StudentReportsPage() {
  const [
    reports,
    setReports,
  ] = useState<GradeReport[]>(
    []
  );

  const [
    selectedId,
    setSelectedId,
  ] = useState<
    string | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

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

      if (!user) {
        throw new Error(
          "ログインしてください。"
        );
      }

      if (
        user.role !==
        "生徒"
      ) {
        throw new Error(
          "この画面は生徒用です。"
        );
      }

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織が設定されていません。"
        );
      }

      if (
        !user.studentId
      ) {
        throw new Error(
          "生徒情報がアカウントに紐付いていません。"
        );
      }

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
          .filter(
            (
              report
            ) =>
              report.studentId ===
              user.studentId
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
        "Student reports error:",
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
          <div
            style={{
              minHeight:
                400,

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",
            }}
          >
            成績表を読み込んでいます...
          </div>
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
              あなた自身の確定済み成績表です。
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
              href="/dashboard/student"
              className="button"
            >
              ホーム
            </Link>

            <Link
              href="/student/results"
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
            No reports
            ================================================== */}

        {reports.length ===
        0 ? (
          <section className="card">
            <div
              style={{
                minHeight:
                  300,

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
                  成績表はありません。
                </strong>

                <p
                  style={{
                    marginTop:
                      7,

                    fontSize:
                      12,
                  }}
                >
                  採点確定後、成績表が作成されるとここに表示されます。
                </p>
              </div>
            </div>
          </section>
        ) : (
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "minmax(300px, .55fr) minmax(0, 1.7fr)",

              gap:
                18,

              marginTop:
                16,

              alignItems:
                "start",
            }}
          >

            {/* ==============================================
                Report list
                ============================================== */}

            <section className="card">
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                テスト
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 12px",

                  fontSize:
                    11,
                }}
              >
                成績表を選択してください。
              </p>

              {reports.map(
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
                    <strong>
                      {
                        report.testName
                      }
                    </strong>

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
                        report.examDate ||
                        "実施日未設定"
                      }
                    </div>

                    <div
                      style={{
                        display:
                          "flex",

                        gap:
                          7,

                        marginTop:
                          9,
                      }}
                    >
                      <MiniStat
                        label="得点"
                        value={`${report.totalScore}/${report.totalMaxScore}`}
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
              )}
            </section>

            {/* ==============================================
                Report
                ============================================== */}

            <section className="card">
              {!selected ? (
                <EmptyDetail />
              ) : (
                <StudentReportSheet
                  report={
                    selected
                  }
                />
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

/* =========================================================
   Student report sheet
   ========================================================= */

function StudentReportSheet({
  report,
}: {
  report: GradeReport;
}) {
  return (
    <article>

      {/* ==================================================
          Title
          ================================================== */}

      <header
        style={{
          textAlign:
            "center",

          paddingBottom:
            18,

          borderBottom:
            "2px solid #222",
        }}
      >
        <div
          style={{
            fontSize:
              11,

            color:
              "#777",
          }}
        >
          テストシステム
        </div>

        <h2
          style={{
            margin:
              "6px 0 0",

            fontSize:
              26,

            letterSpacing:
              ".08em",
          }}
        >
          成績表
        </h2>

        <div
          style={{
            marginTop:
              7,

            fontSize:
              14,

            fontWeight:
              700,
          }}
        >
          {
            report.testName
          }
        </div>
      </header>

      {/* ==================================================
          Student info
          ================================================== */}

      <section
        style={{
          marginTop:
            18,

          border:
            "1px solid #222",
        }}
      >
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "1fr 1fr",
          }}
        >
          <InfoCell
            label="生徒番号"
            value={
              report.studentNumber
            }
          />

          <InfoCell
            label="氏名"
            value={
              report.studentName
            }
          />

          <InfoCell
            label="学年"
            value={
              report.grade
            }
          />

          <InfoCell
            label="クラス"
            value={
              report.className
            }
          />

          <InfoCell
            label="実施日"
            value={
              report.examDate
            }
          />

          <InfoCell
            label="校舎"
            value={
              report.schoolName ||
              report.enrolledSchool
            }
          />
        </div>
      </section>

      {/* ==================================================
          Overall
          ================================================== */}

      <section
        style={{
          marginTop:
            20,
        }}
      >
        <h3>
          総合成績
        </h3>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(4, 1fr)",

            border:
              "1px solid #222",
          }}
        >
          <ScoreCell
            label="総合得点"
            value={`${report.totalScore} / ${report.totalMaxScore}`}
          />

          <ScoreCell
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

          <ScoreCell
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

          <ScoreCell
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
        <h3>
          教科別成績
        </h3>

        {report.subjects.length ===
        0 ? (
          <div
            style={{
              padding:
                30,

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
            教科別成績はありません。
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
                  <Th>
                    教科
                  </Th>

                  <Th>
                    得点
                  </Th>

                  <Th>
                    平均
                  </Th>

                  <Th>
                    偏差値
                  </Th>

                  <Th>
                    順位
                  </Th>

                  <Th>
                    受験者数
                  </Th>
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
                      <Td strong>
                        {
                          subject.subject
                        }
                      </Td>

                      <Td>
                        {
                          subject.score
                        }
                        {" / "}
                        {
                          subject.maxScore
                        }
                      </Td>

                      <Td>
                        {
                          subject.average ===
                          null
                            ? "—"
                            : subject.average.toFixed(
                                1
                              )
                        }
                      </Td>

                      <Td>
                        {
                          subject.deviation ===
                          null
                            ? "—"
                            : subject.deviation.toFixed(
                                1
                              )
                        }
                      </Td>

                      <Td>
                        {formatRank(
                          subject.rank,
                          subject.population
                        )}
                      </Td>

                      <Td>
                        {
                          subject.population ??
                          "—"
                        }
                      </Td>
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

      {hasDistribution(
        report.subjects
      ) && (
        <section
          style={{
            marginTop:
              20,
          }}
        >
          <h3>
            得点分布
          </h3>

          <Distribution
            subjects={
              report.subjects
            }
          />
        </section>
      )}

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

function Distribution({
  subjects,
}: {
  subjects:
    GradeReportSubject[];
}) {
  const rows =
    subjects.flatMap(
      (
        subject
      ) =>
        subject.distribution.map(
          (
            item
          ) => ({
            subject:
              subject.subject,

            range:
              item.range,

            count:
              item.count,
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
            <Th>
              教科
            </Th>

            <Th>
              得点帯
            </Th>

            <Th>
              人数
            </Th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
              index
            ) => (
              <tr
                key={
                  `${row.subject}-${row.range}-${index}`
                }
              >
                <Td>
                  {
                    row.subject
                  }
                </Td>

                <Td>
                  {
                    row.range
                  }
                </Td>

                <Td>
                  {
                    row.count
                  }
                </Td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   Info cell
   ========================================================= */

function InfoCell({
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

        borderRight:
          "1px solid #222",

        borderBottom:
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
   Score cell
   ========================================================= */

function ScoreCell({
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
          13,

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
            17,
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
   Table
   ========================================================= */

function Th({
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

function Td({
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

function EmptyDetail() {
  return (
    <div
      style={{
        minHeight:
          650,

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
      成績表を選択してください。
    </div>
  );
}

/* =========================================================
   Distribution check
   ========================================================= */

function hasDistribution(
  subjects:
    GradeReportSubject[]
) {
  return subjects.some(
    (
      subject
    ) =>
      subject.distribution.length >
      0
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
   Normalize report
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
