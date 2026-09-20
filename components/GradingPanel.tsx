"use client";

import { useEffect, useState } from "react";

export type GradingMark =
  | "○"
  | "△"
  | "×";

export type GradingResult = {
  mark: GradingMark;
  score: number;
  maxScore: number;
};

type GradingPanelProps = {
  maxScore: number;
  initialResult: GradingResult;
  onChange: (
    result: GradingResult
  ) => void;
  disabled?: boolean;
};

export default function GradingPanel({
  maxScore,
  initialResult,
  onChange,
  disabled = false,
}: GradingPanelProps) {
  const [mark, setMark] =
    useState<GradingMark>(
      initialResult.mark
    );

  const [score, setScore] =
    useState(
      initialResult.score
    );

  useEffect(() => {
    setMark(
      initialResult.mark
    );

    setScore(
      Math.max(
        0,
        Math.min(
          maxScore,
          initialResult.score
        )
      )
    );
  }, [
    initialResult,
    maxScore,
  ]);

  function update(
    nextMark: GradingMark,
    nextScore: number
  ) {
    const safeScore =
      Math.max(
        0,
        Math.min(
          maxScore,
          Number.isFinite(
            nextScore
          )
            ? nextScore
            : 0
        )
      );

    setMark(nextMark);
    setScore(safeScore);

    onChange({
      mark: nextMark,
      score: safeScore,
      maxScore,
    });
  }

  function setCorrect() {
    update(
      "○",
      maxScore
    );
  }

  function setIncorrect() {
    update(
      "×",
      0
    );
  }

  function setPartial() {
    const defaultPartial =
      Math.floor(
        maxScore / 2
      );

    update(
      "△",
      Math.max(
        0,
        Math.min(
          maxScore,
          defaultPartial
        )
      )
    );
  }

  function handleScoreChange(
    value: string
  ) {
    const nextScore =
      Number(value);

    update(
      "△",
      nextScore
    );
  }

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (disabled) {
        return;
      }

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

      const key =
        event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        setCorrect();
      }

      if (key === "l") {
        event.preventDefault();
        setIncorrect();
      }

      if (
        event.key ===
        "ArrowUp"
      ) {
        event.preventDefault();
        setCorrect();
      }

      if (
        event.key ===
        "ArrowDown"
      ) {
        event.preventDefault();
        setIncorrect();
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
    disabled,
    maxScore,
  ]);

  return (
    <div className="gradingPanel">
      <div className="gradingScore">
        <span>
          現在の判定
        </span>

        <strong>
          {mark}
        </strong>
      </div>

      <div className="gradingMark">
        <span>
          得点
        </span>

        <strong>
          {score} / {maxScore}
        </strong>
      </div>

      <div className="gradingButtons">
        <button
          type="button"
          disabled={disabled}
          onClick={
            setCorrect
          }
          style={{
            borderColor:
              mark === "○"
                ? "#222"
                : undefined,
            background:
              mark === "○"
                ? "#f0f0f0"
                : undefined,
          }}
        >
          ○
          <small>
            K
          </small>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={
            setPartial
          }
          style={{
            borderColor:
              mark === "△"
                ? "#222"
                : undefined,
            background:
              mark === "△"
                ? "#f0f0f0"
                : undefined,
          }}
        >
          △
          <small>
            部分点
          </small>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={
            setIncorrect
          }
          style={{
            borderColor:
              mark === "×"
                ? "#222"
                : undefined,
            background:
              mark === "×"
                ? "#f0f0f0"
                : undefined,
          }}
        >
          ×
          <small>
            L
          </small>
        </button>
      </div>

      {mark === "△" && (
        <div
          style={{
            marginTop: 18,
          }}
        >
          <label
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            部分点

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 8,
                marginTop: 7,
              }}
            >
              <input
                type="number"
                min={0}
                max={maxScore}
                step={1}
                value={score}
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  handleScoreChange(
                    event.target
                      .value
                  )
                }
                style={{
                  width: 100,
                  height: 42,
                  padding:
                    "0 10px",
                  border:
                    "1px solid #ccc",
                  borderRadius: 6,
                }}
              />

              <span>
                / {maxScore}点
              </span>
            </div>
          </label>
        </div>
      )}

      <div className="gradingHint">
        K：○　L：×　
        △：部分点を入力
      </div>
    </div>
  );
}
