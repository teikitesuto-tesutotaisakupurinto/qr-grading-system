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

import type {
  UserProfile,
} from "@/lib/types";

type SubjectRow = {
  subject: string;

  score: number;

  maxScore: number;

  average: number | null;

  deviation: number | null;

  rank: number | null;

  count: number | null;

  distribution: Array<{
    range: string;
    count: number;
    selected: boolean;
  }>;
};

type Report = {
  id: string;

  testId: string;

  studentNumber: string;

  data: {
    studentName: string;

    studentNumber: string;

    testName: string;

    testDate: string;

    subjects: SubjectRow[];

    totalScore: number;

    totalMaxScore: number;

    totalPercentage: number;

    totalDeviationScore?: number;

    overallRank?: number;

    publicComment?: string;

    isRetest: boolean;
  };
};

export default function ReportsPage() {
  const [
    user,
    setUser,
  ] =
    useState<UserProfile | null>(
      null
    );

  const [
    reports,
    setReports,
  ] =
    useState<Report[]>([]);

  const [
    selectedId,
    setSelectedId,
  ] =
    useState("");

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
            setLoading(false);
            return;
          }

          try {
            const userSnapshot =
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
              userSnapshot.empty
            ) {
              setError(
                "ユーザー情報がありません。"
              );

              return;
            }

            const userData =
              userSnapshot
                .docs[0]
                .data();

            const appUser: UserProfile =
              {
                uid:
                  firebaseUser.uid,

                organizationId:
                  typeof userData.organizationId ===
                  "string"
                    ? userData.organizationId
                    : null,

                role:
                  normalizeRole(
                    userData.role
                  ),

                schoolIds:
                  Array.isArray(
                    userData.schoolIds
                  )
                    ? userData.schoolIds
                    : [],

                studentId:
                  typeof userData.studentId ===
                  "string"
                    ? userData.studentId
                    : null,

                name:
                  typeof userData.name ===
                  "string"
                    ? userData.name
                    : "",

                email:
                  firebaseUser.email,

                active:
                  userData.active !==
                  false,
              };

            setUser(
              appUser
            );

            if (
              !appUser.organizationId
            ) {
              return;
            }

            /*
             * 生徒は自分の成績表だけ。
             * 職員は担当範囲。
             */
            let reportQuery;

            if (
              appUser.role ===
                "生徒" &&
              appUser.studentId
            ) {
              reportQuery =
                query(
                  collection(
                    db,
                    "gradeReports"
                  ),

                  where(
                    "organizationId",
                    "==",
                    appUser.organizationId
                  ),

                  where(
                    "studentId",
                    "==",
                    appUser.studentId
                  )
                );
            } else {
              reportQuery =
                query(
                  collection(
                    db,
                    "gradeReports"
                  ),

                  where(
                    "organizationId",
                    "==",
                    appUser.organizationId
                  )
                );
            }

            const snapshot =
              await getDocs(
                reportQuery
              );

            const loaded =
              snapshot.docs.map(
                (
                  item
                ) =>
                  ({
                    id:
                      item.id,

                    ...item.data(),
                  }) as Report
              );

            setReports(
              loaded
            );

            if (
              loaded.length >
              0
            ) {
              setSelectedId(
                loaded[0].id
              );
            }
          } catch (
            err
          ) {
            console.error(
              err
            );

            setError(
              "成績表を取得できませんでした。"
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  const selected =
    useMemo(
      () =>
        reports.find(
          (
            report
          ) =>
            report.id ===
            selectedId
        ) ??
        reports[0] ??
        null,
      [
        reports,
        selectedId,
      ]
    );

  if (
    loading
  ) {
    return (
      <main className="reportPage">
        <div className="reportLoading">
          Tsystem
          <br />
          成績表を読み込んでいます...
        </div>
      </main>
    );
  }

  if (
    !selected
  ) {
    return (
      <main className="reportPage">
        <section className="reportEmpty">
          <h1>
            成績表
          </h1>

          <p>
            {error ||
              "表示できる成績表がありません。"}
          </p>
        </section>
      </main>
    );
  }

  const data =
    selected.data;

  return (
    <main className="reportPage">
      <div className="reportToolbar">
        <div>
          <h1>
            成績表
          </h1>
        </div>

        <button
          type="button"
          className="reportPrintButton"
          onClick={() =>
            window.print()
          }
        >
          印刷
        </button>
      </div>

      {reports.length >
        1 && (
        <div className="reportSelector">
          <label>
            成績表を選択

            <select
              value={
                selected.id
              }
              onChange={(
                event
              ) =>
                setSelectedId(
                  event.target
                    .value
                )
              }
            >
              {reports.map(
                (
                  report
                ) => (
                  <option
                    key={
                      report.id
                    }
                    value={
                      report.id
                    }
                  >
                    {
                      report.data
                        .testName
                    }
                    {" / "}
                    {
                      report.data
                        .testDate
                    }
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      )}

      <article className="gradeReportPaper">
        <header className="reportStudentHeader">
          <div className="reportStudentGrid">
            <div>
              <span>
                教場
              </span>

              <strong>
                —
              </strong>
            </div>

            <div>
              <span>
                学年
              </span>

              <strong>
                —
              </strong>
            </div>

            <div>
              <span>
                クラス
              </span>

              <strong>
                —
              </strong>
            </div>

            <div>
              <span>
                氏名
              </span>

              <strong>
                {
                  data.studentName
                }
                さん
              </strong>
            </div>

            <div>
              <span>
                性別
              </span>

              <strong>
                —
              </strong>
            </div>

            <div>
              <span>
                在学校
              </span>

              <strong>
                —
              </strong>
            </div>
          </div>

          <div className="reportDate">
            {data.testDate}
          </div>
        </header>

        <section>
          <div className="reportTestTitle">
            テスト名
          </div>

          <h2 className="reportExamName">
            {
              data.testName
            }
          </h2>

          <div className="reportExamDate">
            実施日　{data.testDate}
          </div>
        </section>

        <section className="reportSection">
          <h3>
            ●今回の成績
          </h3>

          <div className="reportTableWrap">
            <table className="reportTable">
              <thead>
                <tr>
                  <th>
                    科目
                  </th>

                  <th>
                    配点
                  </th>

                  <th>
                    得点
                  </th>

                  <th>
                    受験者平均点
                  </th>

                  <th>
                    偏差値
                  </th>

                  <th>
                    順位 / 受験者数
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.subjects.map(
                  (
                    subject
                  ) => (
                    <tr
                      key={
                        subject.subject
                      }
                    >
                      <td>
                        {
                          subject.subject
                        }
                      </td>

                      <td>
                        {
                          subject.maxScore
                        }
                      </td>

                      <td className="reportStrong">
                        {
                          subject.score
                        }
                      </td>

                      <td>
                        {formatNumber(
                          subject.average
                        )}
                      </td>

                      <td>
                        {formatNumber(
                          subject.deviation
                        )}
                      </td>

                      <td>
                        {formatRank(
                          subject.rank,
                          subject.count
                        )}
                      </td>
                    </tr>
                  )
                )}

                <tr className="reportTotalRow">
                  <td>
                    総合計
                  </td>

                  <td>
                    {
                      data.totalMaxScore
                    }
                  </td>

                  <td>
                    {
                      data.totalScore
                    }
                  </td>

                  <td>
                    —
                  </td>

                  <td>
                    {formatNumber(
                      data.totalDeviationScore
                    )}
                  </td>

                  <td>
                    {formatRank(
                      data.overallRank,
                      null
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="reportSection">
          <h3>
            ●度数分布表
          </h3>

          <div className="distributionGrid">
            {data.subjects.map(
              (
                subject
              ) => (
                <div
                  key={
                    subject.subject
                  }
                  className="distributionBlock"
                >
                  <h4>
                    【
                    {
                      subject.subject
                    }
                    】
                  </h4>

                  <div className="distributionHeader">
                    <span>
                      得点
                    </span>

                    <span>
                      人数
                    </span>
                  </div>

                  {subject.distribution.map(
                    (
                      row
                    ) => (
                      <div
                        key={
                          row.range
                        }
                        className={
                          row.selected
                            ? "distributionRow selected"
                            : "distributionRow"
                        }
                      >
                        <span>
                          {
                            row.range
                          }
                        </span>

                        <span>
                          {
                            row.count
                          }

                          {row.selected &&
                            " ★"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )
            )}
          </div>
        </section>

        <section className="reportSection">
          <h3>
            ◆過去の成績推移（偏差値）◆
          </h3>

          <p className="reportHint">
            あなたの得点の位置を★で表示しています。
          </p>

          <div className="reportTableWrap">
            <table className="reportTable">
              <thead>
                <tr>
                  <th>
                    実施日
                  </th>

                  <th>
                    テスト名称
                  </th>

                  {data.subjects.map(
                    (
                      subject
                    ) => (
                      <th
                        key={
                          subject.subject
                        }
                      >
                        {
                          subject.subject
                        }
                      </th>
                    )
                  )}

                  <th>
                    総合
                  </th>

                  <th>
                    位 / 人中
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>
                    {
                      data.testDate
                    }
                  </td>

                  <td>
                    {
                      data.testName
                    }
                  </td>

                  {data.subjects.map(
                    (
                      subject
                    ) => (
                      <td
                        key={
                          subject.subject
                        }
                      >
                        {formatNumber(
                          subject.deviation
                        )}
                      </td>
                    )
                  )}

                  <td>
                    {formatNumber(
                      data.totalDeviationScore
                    )}
                  </td>

                  <td>
                    {formatRank(
                      data.overallRank,
                      null
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {data.publicComment && (
          <section className="reportComment">
            <h3>
              コメント
            </h3>

            <p>
              {
                data.publicComment
              }
            </p>
          </section>
        )}
      </article>
    </main>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function normalizeRole(
  value: unknown
) {
  switch (
    value
  ) {
    case "本部管理者":
    case "hq":
      return "本部管理者" as const;

    case "校舎管理者":
    case "school_admin":
      return "校舎管理者" as const;

    case "講師":
    case "teacher":
      return "講師" as const;

    case "生徒":
    case "student":
      return "生徒" as const;

    default:
      return null;
  }
}

function formatNumber(
  value:
    | number
    | null
    | undefined
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return "—";
  }

  return Number(
    value
  ).toFixed(1);
}

function formatRank(
  rank:
    | number
    | null
    | undefined,
  count:
    | number
    | null
    | undefined
) {
  if (
    rank ===
      null ||
    rank ===
      undefined
  ) {
    return "—";
  }

  if (
    count ===
      null ||
    count ===
      undefined
  ) {
    return `${rank}`;
  }

  return `${rank} / ${count}`;
}
