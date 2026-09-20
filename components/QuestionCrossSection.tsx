"use client";

import { useEffect, useState } from "react";

export type CrossSectionAnswer = {
  id: string;
  imageUrl: string;
  answerText?: string;
  mark?: "○" | "△" | "×";
  score?: number;
};

type QuestionCrossSectionProps = {
  questionNumber: string;
  correctAnswer: string;
  maxScore: number;
  answers: CrossSectionAnswer[];
  onUpdate?: (
    answerId: string,
    result: {
      mark: "○" | "△" | "×";
      score: number;
    }
  ) => void;
};

export default function QuestionCrossSection({
  questionNumber,
  correctAnswer,
  maxScore,
  answers,
  onUpdate,
}: QuestionCrossSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentAnswer = answers[currentIndex];

  function setCorrect() {
    if (!currentAnswer) return;

    onUpdate?.(currentAnswer.id, {
      mark: "○",
      score: maxScore,
    });

    moveNext();
  }

  function setWrong() {
    if (!currentAnswer) return;

    onUpdate?.(currentAnswer.id, {
      mark: "×",
      score: 0,
    });

    moveNext();
  }

  function setTriangle() {
    if (!currentAnswer) return;

    const input = window.prompt(
      `部分点を入力してください（0〜${maxScore}）`,
      String(currentAnswer.score ?? 0)
    );

    if (input === null) return;

    const score = Number(input);

    if (
      !Number.isInteger(score) ||
      score < 0 ||
      score > maxScore
    ) {
      window.alert(
        `0〜${maxScore}の整数を入力してください。`
      );
      return;
    }

    onUpdate?.(currentAnswer.id, {
      mark: "△",
      score,
    });

    moveNext();
  }

  function moveNext() {
    setCurrentIndex((current) =>
      Math.min(current + 1, answers.length - 1)
    );
  }

  function movePrevious() {
    setCurrentIndex((current) =>
      Math.max(current - 1, 0)
    );
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "k") {
        setCorrect();
      }

      if (key === "l") {
        setWrong();
      }

      if (event.key === "Enter") {
        moveNext();
      }

      if (event.key === "ArrowLeft") {
        movePrevious();
      }

      if (event.key === "ArrowRight") {
        moveNext();
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
  }, [currentAnswer, maxScore, answers.length]);

  if (!currentAnswer) {
    return (
      <section className="crossSection">
        <h2>問題別串刺し採点</h2>
        <p>採点対象の答案がありません。</p>
      </section>
    );
  }

  return (
    <section className="crossSection">
      <header className="crossSectionHeader">
        <div>
          <h2>
            第{questionNumber}問
          </h2>

          <div className="crossSectionAnswer">
            正解：
            <strong>{correctAnswer}</strong>
          </div>

          <div className="crossSectionScore">
            配点：{maxScore}点
          </div>
        </div>

        <div className="crossSectionProgress">
          {currentIndex + 1} / {answers.length}
        </div>
      </header>

      <div className="crossSectionBody">
        <div className="crossSectionImage">
          <img
            src={currentAnswer.imageUrl}
            alt="生徒答案"
          />
        </div>

        <div className="crossSectionAnswerArea">
          <div className="answerText">
            {currentAnswer.answerText || "答案"}
          </div>

          <div className="currentResult">
            {currentAnswer.mark === "△"
              ? `△${currentAnswer.score ?? 0}`
              : currentAnswer.mark ?? "未採点"}
          </div>

          <div className="crossSectionButtons">
            <button
              type="button"
              onClick={setCorrect}
            >
              ○
              <span>K</span>
            </button>

            <button
              type="button"
              onClick={setTriangle}
            >
              △
            </button>

            <button
              type="button"
              onClick={setWrong}
            >
              ×
              <span>L</span>
            </button>
          </div>

          <div className="crossSectionNavigation">
            <button
              type="button"
              onClick={movePrevious}
              disabled={currentIndex === 0}
            >
              ← 前
            </button>

            <button
              type="button"
              onClick={moveNext}
              disabled={
                currentIndex === answers.length - 1
              }
            >
              次 →
            </button>
          </div>
        </div>
      </div>

      <div className="crossSectionList">
        {answers.map((answer, index) => (
          <button
            key={answer.id}
            type="button"
            className={
              index === currentIndex
                ? "crossAnswerItem active"
                : "crossAnswerItem"
            }
            onClick={() =>
              setCurrentIndex(index)
            }
          >
            <img
              src={answer.imageUrl}
              alt=""
            />

            <span>
              {answer.mark === "△"
                ? `△${answer.score ?? 0}`
                : answer.mark ?? "未採点"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
