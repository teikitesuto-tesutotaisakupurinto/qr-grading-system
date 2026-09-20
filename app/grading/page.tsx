"use client";

import { useState } from "react";
import Link from "next/link";

import SchoolHeader from "@/components/SchoolHeader";
import StepBar from "@/components/StepBar";

type GradingStatus = {
  step: number;
  name: string;
  status:
    | "完了"
    | "進行中"
    | "未開始"
    | "要確認";
  href: string;
};

const initialSteps: GradingStatus[] = [
  {
    step: 1,
    name: "解答登録",
    status: "完了",
    href: "/answers",
  },
  {
    step: 2,
    name: "採点設定",
    status: "完了",
    href: "/grading/setup",
  },
  {
    step: 3,
    name: "生徒答案",
    status: "進行中",
    href: "/answers",
  },
  {
    step: 4,
    name: "自動採点",
    status: "未開始",
    href: "/grading/auto",
  },
  {
    step: 5,
    name: "一次確認",
    status: "未開始",
    href: "/grading/first",
  },
  {
    step: 6,
    name: "二次確認",
    status: "未開始",
    href: "/grading/second",
  },
  {
    step: 7,
    name: "採点確定",
    status: "未開始",
    href: "/grading/confirm",
  },
  {
    step: 8,
    name: "公開",
    status: "未開始",
    href: "/answers",
  },
];

export default function GradingPage() {
  const [steps, setSteps] =
    useState(initialSteps);

  const currentStep =
    steps.find(
      (item) =>
        item.status === "進行中"
    )?.step ?? 1;

  function markStepComplete(
    stepNumber: number
  ) {
    setSteps((current) =>
      current.map((item) => {
        if (
          item.step === stepNumber
        ) {
          return {
            ...item,
            status: "完了",
          };
        }

        return item;
      })
    );
  }

  return (
    <main className="page">
      <SchoolHeader title="採点管理" />

      <section className="content">
        <StepBar
          currentStep={currentStep}
        />

        <div className="pageHeader">
          <div>
            <h1>採点管理</h1>

            <p>
              第1回確認テスト / 数学
            </p>
          </div>
        </div>

        <section className="listCard">
          {steps.map((item) => (
            <div
              key={item.step}
              className="listRow"
            >
              <strong>
                STEP {item.step}
              </strong>

              <span>
                {item.name}
              </span>

              <span>
                {item.status}
              </span>

              <Link
                href={item.href}
                className="secondaryButton"
              >
                開く
              </Link>
            </div>
          ))}
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 24,
          }}
        >
          <h2>
            採点進捗
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <div className="selectionPanel">
              <strong>
                答案
              </strong>

              <p>
                3,000 / 3,000
              </p>
            </div>

            <div className="selectionPanel">
              <strong>
                一次確認
              </strong>

              <p>
                0 / 3,000
              </p>
            </div>

            <div className="selectionPanel">
              <strong>
                二次確認
              </strong>

              <p>
                0 / 3,000
              </p>
            </div>
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 24,
          }}
        >
          <h2>
            採点担当
          </h2>

          <div className="listCard">
            <div className="listRow">
              <strong>
                講師A
              </strong>

              <span>
                一次確認
              </span>

              <span>
                300枚
              </span>

              <button
                className="secondaryButton"
                onClick={() =>
                  markStepComplete(5)
                }
              >
                担当確認
              </button>
            </div>

            <div className="listRow">
              <strong>
                講師B
              </strong>

              <span>
                一次確認
              </span>

              <span>
                300枚
              </span>

              <button
                className="secondaryButton"
                onClick={() =>
                  markStepComplete(5)
                }
              >
                担当確認
              </button>
            </div>

            <div className="listRow">
              <strong>
                確認者A
              </strong>

              <span>
                二次確認
              </span>

              <span>
                300枚
              </span>

              <button
                className="secondaryButton"
                onClick={() =>
                  markStepComplete(6)
                }
              >
                担当確認
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
