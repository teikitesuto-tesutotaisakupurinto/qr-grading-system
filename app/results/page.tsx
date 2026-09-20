"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";

type SubjectResult = {
  subject: string;
  score: number;
  maxScore: number;
  deviationScore: number;
  overallRank: number;
  schoolRank: number;
  gradeRank: number;
  classRank: number;
};

type SectionResult = {
  subject: string;
  section: string;
  score: number;
  maxScore: number;
};

type RubricResult = {
  subject: string;
  rubric: string;
  score: number;
  maxScore: number;
};

const subjectResults: SubjectResult[] = [
  {
    subject: "国語",
    score: 34,
    maxScore: 50,
    deviationScore: 52.4,
    overallRank: 52,
    schoolRank: 8,
    gradeRank: 16,
    classRank: 3,
  },
  {
    subject: "数学",
    score: 42,
    maxScore: 50,
    deviationScore: 58.7,
    overallRank: 21,
    schoolRank: 4,
    gradeRank: 8,
    classRank: 2,
  },
  {
    subject: "英語",
    score: 40,
    maxScore: 50,
    deviationScore: 56.9,
    overallRank: 28,
    schoolRank: 5,
    gradeRank: 11,
    classRank: 2,
  },
];

const sectionResults: SectionResult[] = [
  {
    subject: "数学",
    section: "大問1",
    score: 8,
    maxScore: 10,
  },
  {
    subject: "数学",
    section: "大問2",
    score: 12,
    maxScore: 15,
  },
  {
    subject: "数学",
    section: "大問3",
    score: 22,
    maxScore: 25,
  },
];

const rubricResults: RubricResult[] = [
  {
    subject: "数学",
    rubric: "知識・技能",
    score: 18,
    maxScore: 25,
  },
  {
    subject: "数学",
    rubric: "思考・判断・表現",
    score: 16,
    maxScore: 20,
  },
  {
    subject: "数学",
    rubric: "その他",
    score: 8,
    maxScore: 5,
  },
];

function percentage(
  score: number,
  maxScore: number
) {
  if (maxScore <= 0) return 0;

  return (score / maxScore) * 100;
}

export default function ResultsPage() {
  const [subject, setSubject] =
    useState("すべて");

  const filteredSections =
    useMemo(
      () =>
        subject === "すべて"
          ? sectionResults
          : sectionResults.filter(
              (item) =>
                item.subject ===
                subject
            ),
      [subject]
    );

  const filteredRubrics =
    useMemo(
      () =>
        subject === "すべて"
          ? rubricResults
          : rubricResults.filter(
              (item) =>
                item.subject ===
                subject
            ),
      [subject]
    );

  const totalScore =
    subjectResults.reduce(
      (sum, item) =>
        sum + item.score,
      0
    );

  const totalMaxScore =
    subjectResults.reduce(
      (sum, item) =>
        sum + item.maxScore,
      0
    );

  const totalPercentage =
    percentage(
      totalScore,
      totalMaxScore
    );

  const deviationScore = 56.2;

  return (
    <main className="page">
      <SchoolHeader title="成績管理" />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>成績管理</h1>

            <p>
              第1回確認テスト / 2026年9月24日
            </p>
          </div>

          <select
            value={subject}
            onChange={(event) =>
              setSubject(
                event.target.value
              )
            }
            style={{
              minHeight: 42,
              padding: "0 12px",
              border:
                "1px solid #ccc",
              borderRadius: 7,
              background: "#fff",
            }}
          >
            <option>
              すべて
            </option>

            {subjectResults.map(
              (item) => (
                <option
                  key={item.subject}
                >
                  {item.subject}
                </option>
              )
            )}
          </select>
        </div>

        <section className="stepCard">
          <h2>
            教科別成績
          </h2>

          <div className="listCard">
            {subjectResults.map(
              (item) => (
                <div
                  className="listRow"
                  key={item.subject}
                >
                  <strong>
                    {item.subject}
                  </strong>

                  <span>
                    {item.score} /{" "}
                    {item.maxScore}
                  </span>

                  <span>
                    {percentage(
                      item.score,
                      item.maxScore
                    ).toFixed(1)}
                    %
                  </span>

                  <span>
                    偏差値{" "}
                    {item.deviationScore.toFixed(
                      1
                    )}
                  </span>

                  <span>
                    {item.overallRank}
                    位
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            総合成績
          </h2>

          <div className="totalGrid">
            <div>
              <span>
                合計
              </span>

              <strong>
                {totalScore} /{" "}
                {totalMaxScore}
              </strong>
            </div>

            <div>
              <span>
                得点率
              </span>

              <strong>
                {totalPercentage.toFixed(
                  1
                )}
                %
              </strong>
            </div>

            <div>
              <span>
                偏差値
              </span>

              <strong>
                {deviationScore.toFixed(
                  1
                )}
              </strong>
            </div>

            <div>
              <span>
                全校順位
              </span>

              <strong>
                38位
              </strong>
            </div>
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            順位
          </h2>

          <div className="rankGrid">
            <div>
              <span>
                全校
              </span>

              <strong>
                38位
              </strong>
            </div>

            <div>
              <span>
                校舎
              </span>

              <strong>
                7位
              </strong>
            </div>

            <div>
              <span>
                学年
              </span>

              <strong>
                12位
              </strong>
            </div>

            <div>
              <span>
                クラス
              </span>

              <strong>
                3位
              </strong>
            </div>
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            大問別成績
          </h2>

          <div className="listCard">
            {filteredSections.map(
              (item) => (
                <div
                  className="listRow"
                  key={`${item.subject}-${item.section}`}
                >
                  <strong>
                    {item.subject}
                  </strong>

                  <span>
                    {item.section}
                  </span>

                  <span>
                    {item.score} /{" "}
                    {item.maxScore}
                  </span>

                  <span>
                    {percentage(
                      item.score,
                      item.maxScore
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            観点別成績
          </h2>

          <div className="listCard">
            {filteredRubrics.map(
              (item) => (
                <div
                  className="listRow"
                  key={`${item.subject}-${item.rubric}`}
                >
                  <strong>
                    {item.subject}
                  </strong>

                  <span>
                    {item.rubric}
                  </span>

                  <span>
                    {item.score} /{" "}
                    {item.maxScore}
                  </span>

                  <span>
                    {percentage(
                      item.score,
                      item.maxScore
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            成績表
          </h2>

          <p>
            登録された成績表テンプレートから成績表を生成できます。
          </p>

          <div className="actionBar">
            <a
              href="/reports"
              className="primaryButton"
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
              }}
            >
              成績表を確認
            </a>

            <button
              type="button"
              className="secondaryButton"
              onClick={() =>
                alert(
                  "成績データCSVを生成します。"
                )
              }
            >
              CSV出力
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
