"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

export type CrossSectionAnswer = {
  id: string;
  imageUrl: string;
  answerText: string;

  mark?: "○" | "△" | "×";
  score?: number;

  studentNumber?: string;
};

type QuestionCrossSectionProps = {
  questionNumber: string;
  correctAnswer: string;
  maxScore: number;

  answers: CrossSectionAnswer[];

  onUpdate: (
    answerId: string,
    result: {
      mark: "○" | "△" | "×";
      score: number;
    }
  ) => void;

  disabled?: boolean;
};

export default function QuestionCrossSection({
  questionNumber,
  correctAnswer,
  maxScore,
  answers,
  onUpdate,
  disabled = false,
}: QuestionCrossSectionProps) {
  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [showOnlyUngraded, setShowOnlyUngraded] =
    useState(false);

  const visibleAnswers =
    useMemo(() => {
      if (!showOnlyUngraded) {
        return answers;
      }

      return answers.filter(
        (answer) =>
          answer.mark === undefined
      );
    }, [
      answers,
      showOnlyUngraded,
    ]);

  const currentAnswer =
    visibleAnswers[
      currentIndex
    ];

  const gradedCount =
    answers.filter(
      (answer) =>
        answer.mark !== undefined
    ).length;

  const correctCount =
    answers.filter(
      (answer) =>
        answer.mark === "○"
    ).length;

  const partialCount =
    answers.filter(
      (answer) =>
        answer.mark === "△"
    ).length;

  const incorrectCount =
    answers.filter(
      (answer) =>
        answer.mark === "×"
    ).length;

  useEffect(() => {
    if (
      currentIndex >=
      visibleAnswers.length
    ) {
      setCurrentIndex(
        Math.max(
          0,
          visibleAnswers.length - 1
        )
      );
    }
  }, [
    currentIndex,
    visibleAnswers.length,
  ]);

  function setResult(
    mark: "○" | "△" | "×",
    score: number
  ) {
    if (
      disabled ||
      !currentAnswer
    ) {
      return;
    }

    onUpdate(
      currentAnswer.id,
      {
        mark,
        score:
          Math.max(
            0,
            Math.min(
              maxScore,
              score
            )
          ),
      }
    );
  }

  function setCorrect() {
    setResult(
      "○",
      maxScore
    );

    moveNext();
  }

  function setIncorrect() {
    setResult(
      "×",
      0
    );

    moveNext();
  }

  function setPartial() {
    if (!currentAnswer) {
      return;
    }

    const defaultScore =
      Math.floor(
        maxScore / 2
      );

    setResult(
      "△",
      defaultScore
    );
  }

  function moveNext() {
    setCurrentIndex(
      (current) =>
        Math.min(
          current + 1,
          visibleAnswers.length -
            1
        )
    );
  }

  function movePrevious() {
    setCurrentIndex(
      (current) =>
        Math.max(
          current - 1,
          0
        )
    );
  }

  function jumpTo(
    index: number
  ) {
    setCurrentIndex(index);
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
        "ArrowLeft"
      ) {
        event.preventDefault();
        movePrevious();
      }

      if (
        event.key ===
        "ArrowRight"
      ) {
        event.preventDefault();
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
  }, [
    disabled,
    currentAnswer,
    visibleAnswers.length,
    maxScore,
  ]);

  if (
    visibleAnswers.length ===
    0
  ) {
    return (
      <div className="emptyState">
        表示できる答案がありません。
      </div>
    );
  }

  return (
    <div className="crossSection">
      <div className="crossSectionHeader">
        <div>
          <h2>
            第
            {questionNumber}
            問
          </h2>

          <p>
            正解：
            <strong>
              {correctAnswer}
            </strong>
            {"　"}
            配点：
            <strong>
              {maxScore}点
            </strong>
          </p>
        </div>

        <div className="crossSectionStats">
          <span>
            全{answers.length}枚
          </span>

          <span>
            採点済み：
            {gradedCount}
          </span>

          <span>
            ○：
            {correctCount}
          </span>

          <span>
            △：
            {partialCount}
          </span>

          <span>
            ×：
            {incorrectCount}
          </span>
        </div>
      </div>

      <div className="crossSectionToolbar">
        <button
          type="button"
          className="secondaryButton"
          disabled={
            currentIndex === 0
          }
          onClick={
            movePrevious
          }
        >
          ← 前
        </button>

        <span>
          {currentIndex + 1}
          {" / "}
          {visibleAnswers.length}
        </span>

        <button
          type="button"
          className="secondaryButton"
          disabled={
            currentIndex ===
            visibleAnswers.length -
              1
          }
          onClick={
            moveNext
          }
        >
          次 →
        </button>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginLeft: "auto",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={
              showOnlyUngraded
            }
            onChange={(event) => {
              setShowOnlyUngraded(
                event.target.checked
              );
              setCurrentIndex(0);
            }}
          />

          未採点のみ
        </label>
      </div>

      <div className="crossSectionMain">
        <div className="crossSectionImage">
          <img
            src={
              currentAnswer.imageUrl
            }
            alt={`第${questionNumber}問の答案`}
            draggable={false}
          />

          <div className="crossSectionAnswer">
            {currentAnswer.answerText ||
              "OCR結果なし"}
          </div>
        </div>

        <div className="crossSectionGrading">
          <div className="selectionPanel">
            <span>
              生徒番号
            </span>

            <strong>
              {currentAnswer.studentNumber ??
                "非表示"}
            </strong>
          </div>

          <div
            className="crossSectionButtons"
          >
            <button
              type="button"
              disabled={disabled}
              onClick={
                setCorrect
              }
              className={
                currentAnswer.mark ===
                "○"
                  ? "crossButton selected"
                  : "crossButton"
              }
            >
              <strong>
                ○
              </strong>

              <span>
                {maxScore}点
              </span>

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
              className={
                currentAnswer.mark ===
                "△"
                  ? "crossButton selected"
                  : "crossButton"
              }
            >
              <strong>
                △
              </strong>

              <span>
                部分点
              </span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={
                setIncorrect
              }
              className={
                currentAnswer.mark ===
                "×"
                  ? "crossButton selected"
                  : "crossButton"
              }
            >
              <strong>
                ×
              </strong>

              <span>
                0点
              </span>

              <small>
                L
              </small>
            </button>
          </div>

          {currentAnswer.mark ===
            "△" && (
            <label>
              部分点

              <input
                type="number"
                min={0}
                max={maxScore}
                step={1}
                value={
                  currentAnswer.score ??
                  0
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) =>
                  setResult(
                    "△",
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />
            </label>
          )}

          <div
            className="selectionPanel"
            style={{
              marginTop: 16,
            }}
          >
            <span>
              現在の採点
            </span>

            <strong>
              {currentAnswer.mark ??
                "未採点"}
              {"　"}
              {currentAnswer.score ??
                0}
              /
              {maxScore}
            </strong>
          </div>
        </div>
      </div>

      <div className="crossSectionList">
        {visibleAnswers.map(
          (answer, index) => (
            <button
              type="button"
              key={answer.id}
              className={
                index ===
                currentIndex
                  ? "crossThumb active"
                  : "crossThumb"
              }
              onClick={() =>
                jumpTo(index)
              }
            >
              <img
                src={
                  answer.imageUrl
                }
                alt=""
                draggable={false}
              />

              <span>
                {answer.mark ??
                  "・"}
              </span>

              <small>
                {answer.score ??
                  0}
                /
                {maxScore}
              </small>
            </button>
          )
        )}
      </div>
    </div>
  );
}
