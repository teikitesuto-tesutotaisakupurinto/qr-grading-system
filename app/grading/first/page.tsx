"use client";

import { useEffect, useMemo, useState } from "react";

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
  autoResult: GradingResult;
  reviewResult?: GradingResult;
  internalNote: string;
  publicAnnotation: string;
};

const demoAnswers: ReviewAnswer[] = [
  {
    id: "answer-001",
    imageUrl: "/sample-answer.jpg",
    answerText: "25",
    autoResult: {
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
    autoResult: {
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
    autoResult: {
      mark: "×",
      score: 0,
      maxScore: 5,
    },
    internalNote: "",
    publicAnnotation: "",
  },
];

export default function FirstReviewPage() {
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

  const currentAnswer =
    answers[currentIndex];

  const currentResult =
    currentAnswer.reviewResult ??
    currentAnswer.autoResult;

  const completedCount =
    completedIds.length;

  const remainingCount =
    answers.length -
    completedCount;

  const progress = useMemo(() => {
    if (answers.length === 0) {
      return 0;
    }

    return Math.round(
      (completedCount /
        answers.length) *
        100
    );
  }, [
    answers.length,
    completedCount,
  ]);

  function updateCurrentResult(
    result: GradingResult
  ) {
    setAnswers((current) =>
      current.map(
        (answer, index) =>
          index === currentIndex
            ? {
                ...answer,
                reviewResult:
                  result,
              }
            : answer
      )
    );
  }

  function updateInternalNote(
    value: string
  ) {
    setAnswers((current) =>
      current.map(
        (answer, index) =>
          index === currentIndex
            ? {
                ...answer,
                internalNote:
                  value,
              }
            : answer
      )
    );
  }

  function updatePublicAnnotation(
    value: string
  ) {
    setAnswers((current) =>
      current.map(
        (answer, index) =>
          index === currentIndex
            ? {
                ...answer,
                publicAnnotation:
                  value,
              }
            : answer
      )
    );
  }

  async function saveCurrent() {
    if (!currentAnswer) {
      return;
    }

    setSaving(true);

    /*
      本番ではここでFirestoreへ一次チェック結果を保存します。
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
        (current) => current + 1
      );
    }
  }

  function previous() {
    setCurrentIndex((current) =>
      Math.max(current - 1, 0)
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
        <SchoolHeader title="一次確認" />

        <section className="content">
          <StepBar currentStep={5} />

          <div className="emptyState">
            確認対象の答案がありません。
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <SchoolHeader title="一次確認" />

      <section className="content">
        <StepBar currentStep={5} />

        <div className="pageHeader">
          <div>
            <h1>一次確認</h1>

            <p>
              自動採点された答案を確認・修正します。
            </p>
          </div>

          <div>
            {completedCount} /{" "}
            {answers.length} 確認済み
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
                生徒に見せる添削

                <textarea
                  value={
                    currentAnswer.publicAnnotation
                  }
                  onChange={(event) =>
                    updatePublicAnnotation(
                      event.target.value
                    )
                  }
                  placeholder="答案上に表示する添削を入力"
                />
              </label>

              <label>
                内部メモ

                <textarea
                  value={
                    currentAnswer.internalNote
                  }
                  onChange={(event) =>
                    updateInternalNote(
                      event.target.value
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
                採点確認
              </h2>

              <div className="selectionPanel">
                <div>
                  自動採点
                </div>

                <strong>
                  {currentAnswer.autoResult.mark ===
                  "△"
                    ? `△${currentAnswer.autoResult.score}`
                    : currentAnswer.autoResult.mark}
                  {" "}
                  {currentAnswer.autoResult.score}
                  /
                  {currentAnswer.autoResult.maxScore}
                </strong>
              </div>

              <GradingPanel
                maxScore={
                  currentAnswer
                    .autoResult
                    .maxScore
                }
                initialResult={
                  currentResult
                }
                onChange={
                  updateCurrentResult
                }
              />

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
                  : "確認して次へ"}
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
                answer.reviewResult ??
                answer.autoResult;

              const completed =
                completedIds.includes(
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
                    {completed
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
            一次確認の状況
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

          {remainingCount === 0 && (
            <a
              href="/grading/second"
              className="primaryButton"
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
              }}
            >
              二次確認へ
            </a>
          )}
        </section>
      </section>
    </main>
  );
}
