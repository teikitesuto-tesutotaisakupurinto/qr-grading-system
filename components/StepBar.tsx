"use client";

import Link from "next/link";

type StepBarProps = {
  currentStep: number;
};

type Step = {
  number: number;
  label: string;
  href: string;
};

const steps: Step[] = [
  {
    number: 1,
    label: "解答登録",
    href: "/answers",
  },
  {
    number: 2,
    label: "採点設定",
    href: "/grading/setup",
  },
  {
    number: 3,
    label: "生徒答案",
    href: "/answers",
  },
  {
    number: 4,
    label: "自動採点",
    href: "/grading/auto",
  },
  {
    number: 5,
    label: "一次確認",
    href: "/grading/first",
  },
  {
    number: 6,
    label: "二次確認",
    href: "/grading/second",
  },
  {
    number: 7,
    label: "採点確定",
    href: "/grading/confirm",
  },
  {
    number: 8,
    label: "公開",
    href: "/answers",
  },
];

export default function StepBar({
  currentStep,
}: StepBarProps) {
  return (
    <div className="stepArea">
      <div className="stepScroll">
        <div className="stepBar">
          {steps.map(
            (step, index) => {
              const completed =
                step.number <
                currentStep;

              const active =
                step.number ===
                currentStep;

              const isLast =
                index ===
                steps.length - 1;

              return (
                <div
                  key={step.number}
                  className="stepItem"
                >
                  <Link
                    href={step.href}
                    className="stepLink"
                    aria-current={
                      active
                        ? "step"
                        : undefined
                    }
                  >
                    <span
                      className={[
                        "stepCircle",
                        active
                          ? "stepActive"
                          : "",
                        completed
                          ? "stepCompleted"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {completed
                        ? "✓"
                        : step.number}
                    </span>

                    <span
                      className={[
                        "stepLabel",
                        active
                          ? "stepLabelActive"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {step.label}
                    </span>
                  </Link>

                  {!isLast && (
                    <span
                      className={[
                        "stepLine",
                        completed
                          ? "stepLineCompleted"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}
