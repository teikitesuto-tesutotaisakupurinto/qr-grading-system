"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";
import GradeReport, {
  GradeReportData,
} from "@/components/GradeReport";

type DeliveryStatus =
  | "未生成"
  | "生成済み"
  | "配信済み"
  | "紙のみ";

const reportData: GradeReportData = {
  studentName: "山田 太郎",
  studentNumber: "583214",
  testName: "第1回確認テスト",
  testDate: "2026/09/24",

  subjects: [
    {
      subject: "国語",
      score: 34,
      maxScore: 50,
      percentage: 68,
      deviationScore: 52.4,
      rank: 52,
    },
    {
      subject: "数学",
      score: 42,
      maxScore: 50,
      percentage: 84,
      deviationScore: 58.7,
      rank: 21,
    },
    {
      subject: "英語",
      score: 40,
      maxScore: 50,
      percentage: 80,
      deviationScore: 56.9,
      rank: 28,
    },
  ],

  sections: [
    {
      name: "大問1",
      score: 8,
      maxScore: 10,
    },
    {
      name: "大問2",
      score: 12,
      maxScore: 15,
    },
    {
      name: "大問3",
      score: 18,
      maxScore: 25,
    },
  ],

  totalScore: 116,
  totalMaxScore: 150,
  totalPercentage: 77.3,
  totalDeviationScore: 56.2,

  overallRank: 38,
  schoolRank: 7,
  gradeRank: 12,
  classRank: 3,

  isRetest: false,
};

export default function ReportsPage() {
  const [isRetest, setIsRetest] =
    useState(false);

  const [status, setStatus] =
    useState<DeliveryStatus>(
      "未生成"
    );

  const [template, setTemplate] =
    useState("通常テスト用");

  const [delivery, setDelivery] =
    useState<
      "データ配信" | "紙のみ"
    >("データ配信");

  const displayData =
    useMemo<GradeReportData>(() => {
      return {
        ...reportData,
        isRetest,
      };
    }, [isRetest]);

  function generateReport() {
    setStatus(
      isRetest
        ? "生成済み"
        : "生成済み"
    );
  }

  function deliverReport() {
    if (isRetest) {
      setDelivery("紙のみ");
      setStatus("紙のみ");
      return;
    }

    setDelivery("データ配信");
    setStatus("配信済み");
  }

  function printReport() {
    window.print();
  }

  return (
    <main className="page">
      <SchoolHeader title="成績表" />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>成績表</h1>

            <p>
              成績表の生成・確認・配信
            </p>
          </div>
        </div>

        <section className="formCard">
          <h2>
            成績表設定
          </h2>

          <label>
            成績表テンプレート

            <select
              value={template}
              onChange={(event) =>
                setTemplate(
                  event.target.value
                )
              }
            >
              <option>
                通常テスト用
              </option>

              <option>
                詳細成績表
              </option>

              <option>
                模試用
              </option>

              <option>
                追試用
              </option>
            </select>
          </label>

          <label>
            成績区分

            <select
              value={
                isRetest
                  ? "追試"
                  : "通常テスト"
              }
              onChange={(event) =>
                setIsRetest(
                  event.target.value ===
                    "追試"
                )
              }
            >
              <option>
                通常テスト
              </option>

              <option>
                追試
              </option>
            </select>
          </label>

          <div className="selectionPanel">
            <strong>
              配信方法
            </strong>

            <p>
              {isRetest
                ? "追試：紙のみ"
                : "通常テスト：データ配信"}
            </p>
          </div>

          <div className="actionBar">
            <button
              type="button"
              className="primaryButton"
              onClick={
                generateReport
              }
            >
              成績表を生成
            </button>

            <button
              type="button"
              className="secondaryButton"
              onClick={
                printReport
              }
            >
              印刷
            </button>

            <button
              type="button"
              className="secondaryButton"
              disabled={
                status === "未生成"
              }
              onClick={
                deliverReport
              }
            >
              {isRetest
                ? "紙返却用に確定"
                : "データ配信"}
            </button>
          </div>
        </section>

        <section
          className="selectionPanel"
          style={{
            marginTop: 20,
          }}
        >
          <strong>
            現在の状態
          </strong>

          <span>
            {status}
          </span>

          <span>
            テンプレート：
            {template}
          </span>

          <span>
            配信：
            {delivery}
          </span>
        </section>

        <section
          style={{
            marginTop: 24,
          }}
        >
          <GradeReport
            data={displayData}
          />
        </section>
      </section>
    </main>
  );
}
