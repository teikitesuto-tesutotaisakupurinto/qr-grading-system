"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

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

import {
  getAppUser,
} from "@/lib/auth";

import {
  answersQueries,
  getScopedDocs,
  testsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  AnswerStatus,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type TestRecord = {
  id: string;

  testId: string;

  name: string;

  subject: string;

  grade: string;

  className: string;

  schoolId: string;

  examDate: string;

  totalScore: number;

  isRetest: boolean;

  automaticGrading: boolean;
};

type AnswerRecord = {
  id: string;

  testId: string;

  subjectId: string;

  schoolId: string;

  studentId:
    | string
    | null;

  studentNumber:
    | string
    | null;

  status: AnswerStatus;

  reviewRequired: boolean;

  totalScore: number;

  totalMaxScore: number;

  createdAt?: unknown;
};

type TestProgress = {
  test: TestRecord;

  totalAnswers: number;

  uploaded: number;

  processing: number;

  graded: number;

  firstReview: number;

  secondReview: number;

  confirmed: number;

  published: number;

  manualGrading: number;

  automaticGrading: number;
};

/* =========================================================
   Page
   ========================================================= */

export default function GradingPage() {
  const [
    userRole,
    setUserRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    tests,
    setTests,
  ] =
    useState<TestRecord[]>(
      []
    );

  const [
    answers,
    setAnswers,
  ] =
    useState<AnswerRecord[]>(
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
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      | "all"
      | "waiting"
      | "review"
      | "completed"
    >(
      "all"
    );

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState<
      string | null
    >(
      null
    );

  /* =======================================================
     Load
     ======================================================= */

  useEffect(() => {
    void loadGradingPage();
  }, []);

  async function loadGradingPage() {
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
          "この画面は職員のみ利用できます。"
        );
      }

      setUserRole(
        user.role
      );

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織が設定されていません。"
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

      /*
       * テストと答案を実データから取得。
       *
       * ダミー件数は一切作らない。
       */
      const [
        testDocuments,
        answerDocuments,
      ] =
        await Promise.all([
          getScopedDocs(
            testsQueries(
              scopeUser
            )
          ),

          getScopedDocs(
            answersQueries(
              scopeUser
            )
          ),
        ]);

      const loadedTests =
        testDocuments
          .map(
            (
              document
            ): TestRecord => {
              const data =
                document.data;

              return {
                id:
                  document.id,

                testId:
                  stringValue(
                    data.testId
                  ) ||
                  document.id,

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
                  safeNumber(
                    data.totalScore
                  ),

                isRetest:
                  data.isRetest ===
                  true,

                automaticGrading:
                  data.automaticGrading ===
                  true,
              };
            }
          )
          /*
           * 追試は通常採点管理から除外。
           */
          .filter(
            (
              test
            ) =>
              !test.isRetest
          );

      const loadedAnswers =
        answerDocuments.map(
          (
            document
          ): AnswerRecord => {
            const data =
              document.data;

            return {
              id:
                document.id,

              testId:
                stringValue(
                  data.testId
                ),

              subjectId:
                stringValue(
                  data.subjectId
                ),

              schoolId:
                stringValue(
                  data.schoolId
                ),

              studentId:
                nullableString(
                  data.studentId
                ),

              studentNumber:
                nullableString(
                  data.studentNumber
                ),

              status:
                normalizeStatus(
                  data.status
                ),

              reviewRequired:
                data.reviewRequired ===
                true,

              totalScore:
                safeNumber(
                  data.totalScore
                ),

              totalMaxScore:
                safeNumber(
                  data.totalMaxScore
                ),

              createdAt:
                data.createdAt,
            };
          }
        );

      setTests(
        loadedTests
      );

      setAnswers(
        loadedAnswers
      );

      setSelectedTestId(
        (
          current
        ) => {
          if (
            current &&
            loadedTests.some(
              (
                test
              ) =>
                test.id ===
                current
            )
          ) {
            return current;
          }

          return (
            loadedTests[0]?.id ??
            null
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        "Grading page load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "採点管理データを取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Progress
     ======================================================= */

  const progressList =
    useMemo<
      TestProgress[]
    >(
      () =>
        tests.map(
          (
            test
          ) => {
            const testAnswers =
              answers.filter(
                (
                  answer
                ) =>
                  answer.testId ===
                  test.id
              );

            return {
              test,

              totalAnswers:
                testAnswers.length,

              uploaded:
                countStatus(
                  testAnswers,
                  "uploaded"
                ),

              processing:
                countStatus(
                  testAnswers,
                  "processing"
                ),

              graded:
                countStatus(
                  testAnswers,
                  "graded"
                ),

              firstReview:
                countStatus(
                  testAnswers,
                  "first_review"
                ),

              secondReview:
                countStatus(
                  testAnswers,
                  "second_review"
                ),

              confirmed:
                countStatus(
                  testAnswers,
                  "confirmed"
                ),

              published:
                countStatus(
                  testAnswers,
                  "published"
                ),

              manualGrading:
                testAnswers.filter(
                  (
                    answer
                  ) =>
                    answer.reviewRequired
                ).length,

              automaticGrading:
                testAnswers.filter(
                  (
                    answer
                  ) =>
                    !answer.reviewRequired &&
                    (
                      answer.status ===
                        "graded" ||
                      answer.status ===
                        "confirmed" ||
                      answer.status ===
                        "published"
                    )
                ).length,
            };
          }
        ),
      [
        tests,
        answers,
      ]
    );

  /* =======================================================
     Filter
     ======================================================= */

  const filteredProgress =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return progressList.filter(
        (
          progress
        ) => {
          const test =
            progress.test;

          const matchesSearch =
            !keyword ||
            test.name
              .toLowerCase()
              .includes(
                keyword
              ) ||
            test.subject
              .toLowerCase()
              .includes(
                keyword
              ) ||
            test.grade
              .toLowerCase()
              .includes(
                keyword
              ) ||
            test.className
              .toLowerCase()
              .includes(
                keyword
              );

          const matchesStatus =
            statusFilter ===
            "all"
              ? true
              : statusFilter ===
                "waiting"
              ? progress.uploaded >
                  0 ||
                progress.processing >
                  0
              : statusFilter ===
                "review"
              ? progress.firstReview >
                  0 ||
                progress.secondReview >
                  0 ||
                progress.manualGrading >
                  0
              : statusFilter ===
                "completed"
              ? progress.totalAnswers >
                  0 &&
                progress.confirmed ===
                  progress.totalAnswers
              : true;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      progressList,
      search,
      statusFilter,
    ]);

  /* =======================================================
     Selected
     ======================================================= */

  const selected =
    progressList.find(
      (
        item
      ) =>
        item.test.id ===
        selectedTestId
    ) ??
    null;

  /* =======================================================
     Overall statistics
     ======================================================= */

  const totalAnswers =
    answers.length;

  const totalFirstReview =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "first_review"
    ).length;

  const totalSecondReview =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
        "second_review"
    ).length;

  const totalConfirmed =
    answers.filter(
      (
        answer
      ) =>
        answer.status ===
          "confirmed" ||
        answer.status ===
          "published"
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
            採点管理
          </h1>

          <p>
            実際の答案データを読み込んでいます...
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
              採点管理
            </h1>

            <p className="muted">
              テストごとの答案受付・採点・確認・確定状況を管理します。
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
              href="/grading/review"
              className="button"
            >
              一次確認
            </Link>

            <Link
              href="/grading/second-review"
              className="button"
            >
              二次確認
            </Link>

            <Link
              href="/grading/confirm"
              className="button primary"
            >
              採点確定
            </Link>
          </div>
        </header>

        {/* ==================================================
            Error
            ================================================== */}

        {error && (
          <div className="errorMessage">
            {
              error
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
              20,
          }}
        >
          <SummaryCard
            label="答案"
            value={
              totalAnswers
            }
            description="現在登録されている答案"
          />

          <SummaryCard
            label="一次確認"
            value={
              totalFirstReview
            }
            description="一次確認が必要な答案"
          />

          <SummaryCard
            label="二次確認"
            value={
              totalSecondReview
            }
            description="二次確認が必要な答案"
          />

          <SummaryCard
            label="確定済み"
            value={
              totalConfirmed
            }
            description="確定または公開済み"
          />
        </div>

        {/* ==================================================
            Filter
            ================================================== */}

        <section
          className="card"
          style={{
            marginBottom:
              16,
          }}
        >
          <div
            style={{
              display:
                "flex",

              gap:
                10,

              flexWrap:
                "wrap",
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
              placeholder="テスト名・教科・学年・クラスで検索"
              style={{
                flex:
                  "1 1 280px",
              }}
            />

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event
                    .target
                    .value as
                    | "all"
                    | "waiting"
                    | "review"
                    | "completed"
                )
              }
            >
              <option value="all">
                すべて
              </option>

              <option value="waiting">
                答案受付・処理中
              </option>

              <option value="review">
                確認・手動採点待ち
              </option>

              <option value="completed">
                採点確定済み
              </option>
            </select>
          </div>
        </section>

        {/* ==================================================
            Test list
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "minmax(360px, 1fr) minmax(420px, 1.4fr)",

            gap:
              20,

            alignItems:
              "start",
          }}
        >

          {/* ================================================
              Tests
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
                  14,
              }}
            >
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                テスト
              </h2>

              <span className="muted">
                {
                  filteredProgress.length
                }
                件
              </span>
            </div>

            {filteredProgress.length ===
              0 && (
              <EmptyState
                title="テストがありません"
                message="登録された通常テストがここに表示されます。"
              />
            )}

            {filteredProgress.map(
              (
                progress
              ) => {
                const active =
                  progress.test.id ===
                  selectedTestId;

                return (
                  <button
                    key={
                      progress.test.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedTestId(
                        progress.test.id
                      )
                    }
                    style={{
                      display:
                        "block",

                      width:
                        "100%",

                      marginBottom:
                        10,

                      padding:
                        16,

                      textAlign:
                        "left",

                      border:
                        active
                          ? "2px solid #111"
                          : "1px solid #ddd",

                      borderRadius:
                        10,

                      background:
                        active
                          ? "#f7f7f7"
                          : "#fff",

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
                          12,
                      }}
                    >
                      <strong>
                        {
                          progress.test.name
                        }
                      </strong>

                      <span
                        style={{
                          fontSize:
                            12,

                          color:
                            "#666",
                        }}
                      >
                        {
                          progress.test.subject
                        }
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop:
                          6,

                        fontSize:
                          12,

                        color:
                          "#666",
                      }}
                    >
                      {
                        progress.test.grade
                      }

                      {progress.test.className &&
                        ` / ${progress.test.className}`}

                      {progress.test.examDate &&
                        ` / ${progress.test.examDate}`}
                    </div>

                    {/* ----------------------------------------
                        実データ件数
                        ---------------------------------------- */}

                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(3, 1fr)",

                        gap:
                          8,

                        marginTop:
                          14,
                      }}
                    >
                      <MiniStat
                        label="答案"
                        value={
                          progress.totalAnswers
                        }
                      />

                      <MiniStat
                        label="一次"
                        value={
                          progress.firstReview
                        }
                      />

                      <MiniStat
                        label="二次"
                        value={
                          progress.secondReview
                        }
                      />
                    </div>
                  </button>
                );
              }
            )}
          </section>

          {/* ================================================
              Detail
              ================================================ */}

          <section className="card">
            {!selected ? (
              <EmptyState
                title="テストを選択してください"
                message="左側から採点状況を確認するテストを選択してください。"
              />
            ) : (
              <TestProgressDetail
                progress={
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
   Detail
   ========================================================= */

function TestProgressDetail({
  progress,
}: {
  progress: TestProgress;
}) {
  const {
    test,
  } = progress;

  const total =
    progress.totalAnswers;

  const confirmed =
    progress.confirmed;

  const percentage =
    total === 0
      ? 0
      : Math.round(
          (confirmed /
            total) *
            100
        );

  /*
   * 実データに基づく現在ステップ。
   */
  const currentStep =
    getCurrentStep(
      progress
    );

  return (
    <div>
      <header
        style={{
          paddingBottom:
            18,

          borderBottom:
            "1px solid #eee",
        }}
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            gap:
              20,
          }}
        >
          <div>
            <h2
              style={{
                margin:
                  0,
              }}
            >
              {
                test.name
              }
            </h2>

            <p
              className="muted"
              style={{
                margin:
                  "6px 0 0",
              }}
            >
              {
                test.subject
              }

              {" / "}

              {
                test.grade
              }

              {test.className &&
                ` / ${test.className}`}
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
                  28,
              }}
            >
              {confirmed}
            </strong>

            <span
              className="muted"
            >
              {" / "}
              {total}
            </span>

            <div
              className="muted"
              style={{
                fontSize:
                  12,
              }}
            >
              確定済み
            </div>
          </div>
        </div>

        {/* Progress */}

        <div
          style={{
            marginTop:
              18,
          }}
        >
          <div
            style={{
              height:
                8,

              borderRadius:
                999,

              background:
                "#eee",

              overflow:
                "hidden",
            }}
          >
            <div
              style={{
                width:
                  `${percentage}%`,

                height:
                  "100%",

                background:
                  "#111",
              }}
            />
          </div>

          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              marginTop:
                6,

              fontSize:
                12,

              color:
                "#666",
            }}
          >
            <span>
              現在：
              {
                currentStep
              }
            </span>

            <span>
              {
                percentage
              }
              %
            </span>
          </div>
        </div>
      </header>

      {/* ====================================================
          Steps
          ==================================================== */}

      <div
        style={{
          marginTop:
            20,
        }}
      >
        <ProgressStep
          number={1}
          title="答案受付"
          description="実際に登録された答案"
          value={
            progress.totalAnswers
          }
          total={
            null
          }
          completed={
            progress.totalAnswers >
            0
          }
          href="/answers"
        />

        <ProgressStep
          number={2}
          title="自動・手動採点"
          description="採点方式に応じた採点"
          value={
            progress.graded
          }
          total={
            progress.totalAnswers
          }
          completed={
            progress.totalAnswers >
              0 &&
            progress.graded +
              progress.firstReview +
              progress.secondReview +
              progress.confirmed +
              progress.published ===
              progress.totalAnswers
          }
          href="/grading"
        />

        <ProgressStep
          number={3}
          title="一次確認"
          description="自動採点結果と手動採点結果を確認"
          value={
            progress.firstReview
          }
          total={
            progress.totalAnswers
          }
          completed={
            progress.totalAnswers >
              0 &&
            progress.firstReview ===
              0 &&
            (
              progress.secondReview >
                0 ||
              progress.confirmed >
                0 ||
              progress.published >
                0
            )
          }
          href="/grading/review"
        />

        <ProgressStep
          number={4}
          title="二次確認"
          description="二次確認・差異確認"
          value={
            progress.secondReview
          }
          total={
            progress.totalAnswers
          }
          completed={
            progress.totalAnswers >
              0 &&
            progress.secondReview ===
              0 &&
            (
              progress.confirmed >
                0 ||
              progress.published >
                0
            )
          }
          href="/grading/second-review"
        />

        <ProgressStep
          number={5}
          title="採点確定"
          description="確定した答案を成績へ反映"
          value={
            progress.confirmed
          }
          total={
            progress.totalAnswers
          }
          completed={
            progress.totalAnswers >
              0 &&
            progress.confirmed ===
              progress.totalAnswers
          }
          href="/grading/confirm"
        />
      </div>

      {/* ====================================================
          Grading method
          ==================================================== */}

      <div
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
          採点方式
        </h3>

        <p
          className="muted"
        >
          テスト全体を一律に自動採点するのではなく、問題ごとの採点方式に従って処理します。
        </p>

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
          <MethodCard
            title="自動採点"
            active={
              test.automaticGrading
            }
            description={
              test.automaticGrading
                ? "自動採点対象の問題があります。"
                : "自動採点対象として登録されていません。"
            }
          />

          <MethodCard
            title="手動採点"
            active={
              !test.automaticGrading
            }
            description={
              test.automaticGrading
                ? "手動採点問題を含めることができます。"
                : "講師による手動採点を行います。"
            }
          />
        </div>
      </div>

      {/* ====================================================
          Actions
          ==================================================== */}

      <div
        style={{
          display:
            "flex",

          flexWrap:
            "wrap",

          gap:
            8,

          marginTop:
            20,
        }}
      >
        {progress.firstReview >
          0 && (
          <Link
            href="/grading/review"
            className="button primary"
          >
            一次確認を見る
          </Link>
        )}

        {progress.secondReview >
          0 && (
          <Link
            href="/grading/second-review"
            className="button primary"
          >
            二次確認を見る
          </Link>
        )}

        {progress.totalAnswers >
            0 &&
          progress.confirmed <
            progress.totalAnswers && (
            <Link
              href="/grading/confirm"
              className="button"
            >
              採点確定へ
            </Link>
          )}

        <Link
          href="/answers"
          className="button"
        >
          答案を見る
        </Link>
      </div>
    </div>
  );
}

/* =========================================================
   Progress Step
   ========================================================= */

function ProgressStep({
  number,
  title,
  description,
  value,
  total,
  completed,
  href,
}: {
  number: number;

  title: string;

  description: string;

  value: number;

  total: number | null;

  completed: boolean;

  href: string;
}) {
  return (
    <div
      style={{
        display:
          "flex",

        gap:
          14,

        padding:
          "14px 0",

        borderBottom:
          "1px solid #eee",
      }}
    >
      <div
        style={{
          width:
            30,

          height:
            30,

          flex:
            "0 0 30px",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          borderRadius:
            "50%",

          background:
            completed
              ? "#111"
              : "#eee",

          color:
            completed
              ? "#fff"
              : "#555",

          fontSize:
            12,

          fontWeight:
            700,
        }}
      >
        {number}
      </div>

      <div
        style={{
          flex:
            1,
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
              title
            }
          </strong>

          <span
            style={{
              fontSize:
                12,

              color:
                completed
                  ? "#222"
                  : "#777",
            }}
          >
            {total ===
            null
              ? value
              : `${value} / ${total}`}
          </span>
        </div>

        <p
          className="muted"
          style={{
            margin:
              "4px 0 0",

            fontSize:
              12,
          }}
        >
          {
            description
          }
        </p>

        <Link
          href={href}
          style={{
            display:
              "inline-block",

            marginTop:
              7,

            fontSize:
              12,
          }}
        >
          画面を開く
        </Link>
      </div>
    </div>
  );
}

/* =========================================================
   Summary
   ========================================================= */

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;

  value: number;

  description: string;
}) {
  return (
    <div className="card">
      <div
        className="muted"
        style={{
          fontSize:
            12,
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
            26,
        }}
      >
        {
          value
        }
      </strong>

      <div
        className="muted"
        style={{
          marginTop:
            3,

          fontSize:
            11,
        }}
      >
        {
          description
        }
      </div>
    </div>
  );
}

/* =========================================================
   Mini statistic
   ========================================================= */

function MiniStat({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <div
      style={{
        padding:
          "8px 10px",

        background:
          "#f7f7f7",

        borderRadius:
          6,
      }}
    >
      <div
        style={{
          fontSize:
            10,

          color:
            "#777",
        }}
      >
        {
          label
        }
      </div>

      <strong>
        {
          value
        }
      </strong>
    </div>
  );
}

/* =========================================================
   Method
   ========================================================= */

function MethodCard({
  title,
  active,
  description,
}: {
  title: string;

  active: boolean;

  description: string;
}) {
  return (
    <div
      style={{
        padding:
          14,

        border:
          "1px solid #ddd",

        borderRadius:
          8,

        background:
          active
            ? "#f7f7f7"
            : "#fff",
      }}
    >
      <strong>
        {
          title
        }
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
        {
          description
        }
      </p>
    </div>
  );
}

/* =========================================================
   Empty
   ========================================================= */

function EmptyState({
  title,
  message,
}: {
  title: string;

  message: string;
}) {
  return (
    <div
      style={{
        padding:
          50,

        textAlign:
          "center",
      }}
    >
      <strong>
        {
          title
        }
      </strong>

      <p
        className="muted"
      >
        {
          message
        }
      </p>
    </div>
  );
}

/* =========================================================
   Current step
   ========================================================= */

function getCurrentStep(
  progress: TestProgress
) {
  if (
    progress.totalAnswers ===
    0
  ) {
    return "答案待ち";
  }

  if (
    progress.uploaded >
      0 ||
    progress.processing >
      0
  ) {
    return "答案受付・処理中";
  }

  if (
    progress.manualGrading >
      0
  ) {
    return "手動採点待ち";
  }

  if (
    progress.firstReview >
      0
  ) {
    return "一次確認";
  }

  if (
    progress.secondReview >
      0
  ) {
    return "二次確認";
  }

  if (
    progress.confirmed <
    progress.totalAnswers
  ) {
    return "採点確定";
  }

  return "完了";
}

/* =========================================================
   Status
   ========================================================= */

function countStatus(
  answers: AnswerRecord[],
  status: AnswerStatus
) {
  return answers.filter(
    (
      answer
    ) =>
      answer.status ===
      status
  ).length;
}

function normalizeStatus(
  value: unknown
): AnswerStatus {
  switch (
    value
  ) {
    case "uploaded":
    case "processing":
    case "graded":
    case "first_review":
    case "second_review":
    case "confirmed":
    case "published":
    case "error":
      return value;

    default:
      return "uploaded";
  }
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

function safeNumber(
  value: unknown
) {
  const number =
    Number(
      value ?? 0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
