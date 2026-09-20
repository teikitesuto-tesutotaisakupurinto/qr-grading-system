"use client";

import { useEffect, useState } from "react";

export type GradingMark = "○" | "×" | "△";

export type GradingResult = {
  mark: GradingMark;
  score: number;
  maxScore: number;
};

type GradingPanelProps = {
  maxScore: number;
  initialResult?: GradingResult;
  onChange?: (result: GradingResult) => void;
};

export default function GradingPanel({
  maxScore,
  initialResult,
  onChange,
}: GradingPanelProps) {
  const [mark, setMark] = useState<GradingMark>(
    initialResult?.mark ?? "○"
  );

  const [score, setScore] = useState<number>(
    initialResult?.score ?? maxScore
  );

  function updateResult(
    nextMark: GradingMark,
    nextScore: number
  ) {
    setMark(nextMark);
    setScore(nextScore);

    onChange?.({
      mark: nextMark,
      score: nextScore,
      maxScore,
    });
  }

  function markCorrect() {
    updateResult("○", maxScore);
  }

  function markWrong() {
    updateResult("×", 0);
  }

  function selectTriangle() {
    const value = window.prompt(
      `部分点を入力してください（0〜${maxScore}）`,
      String(score)
    );

    if (value === null) {
      return;
    }

    const parsed = Number(value);

    if (
      !Number.isInteger(parsed) ||
      parsed < 0 ||
      parsed > maxScore
    ) {
      window.alert("正しい部分点を入力してください。");
      return;
    }

    updateResult("△", parsed);
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
        markCorrect();
      }

      if (key === "l") {
        markWrong();
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
  }, [maxScore]);

  return (
    <div className="gradingPanel">
      <div className="gradingScore">
        <span>得点</span>

        <strong>
          {score} / {maxScore}
        </strong>
      </div>

      <div className="gradingMark">
        <span>判定</span>

        <strong className="gradingMarkValue">
          {mark}
          {mark === "△" && score}
        </strong>
      </div>

      <div className="gradingButtons">
        <button
          type="button"
          onClick={markCorrect}
        >
          ○
          <small>K</small>
        </button>

        <button
          type="button"
          onClick={selectTriangle}
        >
          △
        </button>

        <button
          type="button"
          onClick={markWrong}
        >
          ×
          <small>L</small>
        </button>
      </div>

      <div className="gradingHint">
        K：○　L：×　△：画面から選択
      </div>
    </div>
  );
}
