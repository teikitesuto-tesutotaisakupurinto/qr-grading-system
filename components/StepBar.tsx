"use client";

type Step = {
  number: number;
  label: string;
};

type StepBarProps = {
  currentStep: number;
};

const steps: Step[] = [
  { number: 1, label: "解答登録" },
  { number: 2, label: "採点設定" },
  { number: 3, label: "生徒答案" },
  { number: 4, label: "自動採点" },
  { number: 5, label: "一次確認" },
  { number: 6, label: "二次確認" },
  { number: 7, label: "採点確定" },
  { number: 8, label: "公開" },
];

export default function StepBar({
  currentStep,
}: StepBarProps) {
  const current = steps.find(
    (step) => step.number === currentStep
  );

  const next = steps.find(
    (step) => step.number === currentStep + 1
  );

  return (
    <section className="stepArea">
      <div className="stepScroll">
        <div className="stepBar">
          {steps.map((step, index) => {
            const completed =
              step.number < currentStep;

            const active =
              step.number === currentStep;

            return (
              <div
                key={step.number}
                className="stepItem"
              >
                <div
                  className={[
                    "stepCircle",
                    completed
                      ? "stepCompleted"
                      : "",
                    active
                      ? "stepActive"
                      : "",
                  ].join(" ")}
                >
                  {completed
                    ? "✓"
                    : step.number}
                </div>

                <span
                  className={
                    active
                      ? "stepLabel stepLabelActive"
                      : "stepLabel"
                  }
                >
                  {step.label}
                </span>

                {index < steps.length - 1 && (
                  <div
                    className={
                      step.number < currentStep
                        ? "stepLine stepLineCompleted"
                        : "stepLine"
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="stepInformation">
        <div>
          <span className="stepInformationLabel">
            現在
          </span>

          <strong>
            STEP {current?.number}{" "}
            {current?.label}
          </strong>
        </div>

        {next && (
          <div>
            <span className="stepInformationLabel">
              次のステップ
            </span>

            <strong>
              STEP {next.number}{" "}
              {next.label}
            </strong>
          </div>
        )}
      </div>
    </section>
  );
}
