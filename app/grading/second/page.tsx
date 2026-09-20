"use client";

import { useEffect, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";
import StepBar from "@/components/StepBar";
import AnswerViewer from "@/components/AnswerViewer";
import GradingPanel, {
  GradingResult,
} from "@/components/GradingPanel";

type ReviewAnswer = {
  id: string;
  imageUrl: string;
  answerText: string;
  firstResult: GradingResult;
  secondResult?: GradingResult;
  internalNote: string;
  publicAnnotation: string;
};

const demoAnswers: ReviewAnswer[] = [
  {
    id: "answer-001",
    imageUrl: "/sample-answer.jpg",
    answerText: "25",
    firstResult: {
      mark: "○",
      score: 5,
      maxScore: 5,
    },
    internalNote: "",
    publicAnnotation: "",
  },
  {
    id: "answer-002",
    imageUrl: "/sample-answer.jpg",
    answerText: "24",
    firstResult: {
      mark: "△",
      score: 3,
      maxScore: 5,
    },
    internalNote:
      "途中式を確認してください。",
    publicAnnotation: "",
  },
  {
    id: "answer-003",
    imageUrl: "/sample-answer.jpg",
    answerText: "23",
    firstResult: {
      mark: "×",
      score: 0,
      maxScore: 5,
    },
    internalNote: "",
    publicAnnotation: "",
  },
];

export default function SecondReviewPage() {
  const [answers, setAnswers] =
    useState<ReviewAnswer[]>(
      demoAnswers
    );

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [completedIds, setCompletedIds] =
    useState<string[]>([]);

  const [saving, setSaving] =
    useState(false);

  const [disagreements, setDisagreements] =
    useState<string[]>([]);

  const currentAnswer =
    answers[currentIndex];

  const currentResult =
    currentAnswer?.secondResult ??
    currentAnswer?.firstResult;

  const completedCount =
    completedIds.length;

  const remainingCount =
    answers.length -
    completedCount;

  const progress =
    answers.length === 0
      ? 0
      : Math.round(
          (completedCount /
            answers.length) *
            100
        );

  function updateCurrentResult(
    result: GradingResult
  ) {
    setAnswers((current) =>
      current.map(
        (answer, index) =>
          index === currentIndex
            ? {
                ...answer,
                secondResult:
                  result,
              }
            : answer
      )
    );

    const first =
      currentAnswer?.firstResult;

    if (
      first &&
      (
        first.mark !== result.mark ||
        first.score !== result.score
      )
    ) {
      setDisagreements(
        (current) =>
          current.includes(
            currentAnswer.id
          )
            ? current
            : [
                ...current,
                currentAnswer.id,
              ]
      );
    } else {
      setDisagreements(
        (current) =>
          current.filter(
            (id) =>
              id !==
              currentAnswer.id
          )
      );
    }
  }

  async function saveCurrent() {
    if (!currentAnswer) {
      return;
    }

    setSaving(true);

    /*
      本番ではここでFirestoreへ
      二次確認結果を保存します。
    */

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 150)
    );

    setCompletedIds(
      (current) =>
        current.includes(
          currentAnswer.id
        )
          ? current
          : [
              ...current,
              currentAnswer.id,
            ]
    );

    setSaving(false);
  }

  async function saveAndNext() {
    await saveCurrent();

    if (
      currentIndex <
      answers.length - 1
    ) {
      setCurrentIndex(
        (current) =>
          current + 1
      );
    }
  }

  function previous() {
    setCurrentIndex((current) =>
      Math.max(
        current - 1,
        0
      )
    );
  }

  function next() {
    setCurrentIndex((current) =>
      Math.min(
        current + 1,
        answers.length - 1
      )
    );
  }

  function returnToFirstReview() {
    if (!currentAnswer) {
      return;
    }

    setCompletedIds(
      (current) =>
        current.filter(
          (id) =>
            id !== currentAnswer.id
        )
    );
  }

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      const target =
        event.target as HTMLElement | null;

      if (
        target?.tagName ===
          "INPUT" ||
        target?.tagName ===
          "TEXTAREA" ||
        target?.tagName ===
          "SELECT"
      ) {
        return;
      }

      if (
        event.key === "ArrowLeft"
      ) {
        previous();
      }

      if (
        event.key === "ArrowRight"
      ) {
        next();
      }

      if (
        event.key === "Enter"
      ) {
        void saveAndNext();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    currentIndex,
    answers.length,
    currentAnswer,
  ]);

  if (!currentAnswer) {
    return (
      <main className="page">
        <SchoolHeader title="二次確認" />

        <section className="content">
          <StepBar currentStep={6} />

          <div className="emptyState">
            二次確認対象の答案がありません。
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <SchoolHeader title="二次確認" />

      <section className="content">
        <StepBar currentStep={6} />

        <div className="pageHeader">
          <div>
            <h1>二次確認</h1>

            <p>
              一次確認とは別の担当者が採点結果を再確認します。
            </p>
          </div>

          <div>
            {completedCount} /{" "}
            {answers.length}
            {" "}確認済み
          </div>
        </div>

        <div
          style={{
            height: 10,
            background: "#eee",
            borderRadius: 5,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "#222",
              transition:
                "width .15s ease",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.7fr) minmax(320px, 0.8fr)",
            gap: 20,
          }}
        >
          <section>
            <AnswerViewer
              imageUrl={
                currentAnswer.imageUrl
              }
            />

            <div
              className="formCard"
              style={{
                marginTop: 16,
              }}
            >
              <label>
                公開添削

                <textarea
                  value={
                    currentAnswer.publicAnnotation
                  }
                  onChange={(event) =>
                    setAnswers(
                      (current) =>
                        current.map(
                          (
                            answer,
                            index
                          ) =>
                            index ===
                            currentIndex
                              ? {
                                  ...answer,
                                  publicAnnotation:
                                    event
                                      .target
                                      .value,
                                }
                              : answer
                        )
                    )
                  }
                  placeholder="生徒に表示する添削"
                />
              </label>

              <label>
                内部メモ

                <textarea
                  value={
                    currentAnswer.internalNote
                  }
                  onChange={(event) =>
                    setAnswers(
                      (current) =>
                        current.map(
                          (
                            answer,
                            index
                          ) =>
                            index ===
                            currentIndex
                              ? {
                                  ...answer,
                                  internalNote:
                                    event
                                      .target
                                      .value,
                                }
                              : answer
                        )
                    )
                  }
                  placeholder="採点者だけが見るメモ"
                />
              </label>
            </div>
          </section>

          <aside>
            <div className="stepCard">
              <h2>
                二次確認
              </h2>

              <div className="selectionPanel">
                <div>
                  一次確認結果
                </div>

                <strong>
                  {currentAnswer.firstResult.mark ===
                  "△"
                    ? `△${currentAnswer.firstResult.score}`
                    : currentAnswer.firstResult.mark}
                  {" "}
                  {
                    currentAnswer.firstResult.score
                  }
                  /
                  {
                    currentAnswer.firstResult.maxScore
                  }
                </strong>
              </div>

              <GradingPanel
                maxScore={
                  currentAnswer
                    .firstResult
                    .maxScore
                }
                initialResult={
                  currentResult
                }
                onChange={
                  updateCurrentResult
                }
              />

              {disagreements.includes(
                currentAnswer.id
              ) && (
                <div
                  className="formError"
                  style={{
                    marginTop: 16,
                  }}
                >
                  一次確認結果と異なる判定です。
                  確認後、二次結果を確定してください。
                </div>
              )}

              <div
                className="actionBar"
                style={{
                  marginTop: 18,
                }}
              >
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={previous}
                  disabled={
                    currentIndex === 0
                  }
                >
                  ← 前
                </button>

                <button
                  type="button"
                  className="secondaryButton"
                  onClick={next}
                  disabled={
                    currentIndex ===
                    answers.length - 1
                  }
                >
                  次 →
                </button>
              </div>

              <button
                type="button"
                className="primaryButton"
                style={{
                  width: "100%",
                  marginTop: 10,
                }}
                disabled={saving}
                onClick={
                  saveAndNext
                }
              >
                {saving
                  ? "保存中..."
                  : "二次確認して次へ"}
              </button>

              <button
                type="button"
                className="textButton"
                style={{
                  width: "100%",
                  marginTop: 10,
                }}
                onClick={
                  returnToFirstReview
                }
              >
                一次確認へ差し戻す
              </button>
            </div>
          </aside>
        </div>

        <section
          className="listCard"
          style={{
            marginTop: 24,
          }}
        >
          {answers.map(
            (answer, index) => {
              const result =
                answer.secondResult ??
                answer.firstResult;

              const completed =
                completedIds.includes(
                  answer.id
                );

              const disagreement =
                disagreements.includes(
                  answer.id
                );

              return (
                <button
                  key={answer.id}
                  type="button"
                  className="listRow"
                  style={{
                    width: "100%",
                    textAlign:
                      "left",
                    border: 0,
                    borderBottom:
                      "1px solid #eee",
                    background:
                      index ===
                      currentIndex
                        ? "#f3f3f3"
                        : "#fff",
                  }}
                  onClick={() =>
                    setCurrentIndex(
                      index
                    )
                  }
                >
                  <strong>
                    {index + 1}
                  </strong>

                  <span>
                    {result.mark ===
                    "△"
                      ? `△${result.score}`
                      : result.mark}
                  </span>

                  <span>
                    {result.score}
                    /
                    {
                      result.maxScore
                    }
                  </span>

                  <span>
                    {disagreement
                      ? "判定差あり"
                      : completed
                      ? "確認済み"
                      : "未確認"}
                  </span>
                </button>
              );
            }
          )}
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 24,
          }}
        >
          <h2>
            二次確認の状況
          </h2>

          <div
            className="selectionPanel"
          >
            <strong>
              未確認
            </strong>

            <p>
              {remainingCount}枚
            </p>
          </div>

          {disagreements.length >
            0 && (
            <div className="formError">
              一次確認との判定差：
              {disagreements.length}
              件
            </div>
          )}

          {remainingCount ===
            0 && (
            <a
              href="/grading/confirm"
              className="primaryButton"
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
              }}
            >
              採点確定へ
            </a>
          )}
        </section>
      </section>
    </main>
  );
}
