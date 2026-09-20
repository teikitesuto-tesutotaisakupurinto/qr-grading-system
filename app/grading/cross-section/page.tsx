"use client";

import { useEffect, useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";
import StepBar from "@/components/StepBar";
import QuestionCrossSection, {
  CrossSectionAnswer,
} from "@/components/QuestionCrossSection";

type Question = {
  id: string;
  number: string;
  correctAnswer: string;
  maxScore: number;
};

const questions: Question[] = [
  {
    id: "q1",
    number: "1",
    correctAnswer: "③",
    maxScore: 2,
  },
  {
    id: "q2",
    number: "2",
    correctAnswer: "25",
    maxScore: 3,
  },
  {
    id: "q3",
    number: "3",
    correctAnswer: "25",
    maxScore: 5,
  },
];

const initialAnswers: CrossSectionAnswer[] =
  Array.from(
    { length: 30 },
    (_, index) => ({
      id: `answer-${index + 1}`,
      imageUrl: "/sample-answer.jpg",
      answerText:
        index % 5 === 0
          ? "24"
          : "25",
    })
  );

export default function CrossSectionPage() {
  const [questionIndex, setQuestionIndex] =
    useState(0);

  const [answers, setAnswers] =
    useState<CrossSectionAnswer[]>(
      initialAnswers
    );

  const currentQuestion =
    questions[questionIndex];

  const completedCount =
    answers.filter(
      (answer) =>
        answer.mark !== undefined
    ).length;

  const percentage =
    answers.length === 0
      ? 0
      : Math.round(
          (completedCount /
            answers.length) *
            100
        );

  const currentQuestionResults =
    useMemo(
      () =>
        answers.filter(
          (answer) =>
            answer.mark !== undefined
        ),
      [answers]
    );

  function updateAnswer(
    answerId: string,
    result: {
      mark: "○" | "△" | "×";
      score: number;
    }
  ) {
    setAnswers((current) =>
      current.map((answer) =>
        answer.id === answerId
          ? {
              ...answer,
              mark: result.mark,
              score: result.score,
            }
          : answer
      )
    );
  }

  function previousQuestion() {
    setQuestionIndex((current) =>
      Math.max(current - 1, 0)
    );
  }

  function nextQuestion() {
    setQuestionIndex((current) =>
      Math.min(
        current + 1,
        questions.length - 1
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
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      if (
        event.key === "ArrowUp"
      ) {
        previousQuestion();
      }

      if (
        event.key === "ArrowDown"
      ) {
        nextQuestion();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, []);

  return (
    <main className="page">
      <SchoolHeader
        title="問題別串刺し採点"
      />

      <section className="content">
        <StepBar currentStep={5} />

        <div className="pageHeader">
          <div>
            <h1>
              問題別串刺し採点
            </h1>

            <p>
              同じ問題の答案をまとめて確認・採点します。
            </p>
          </div>

          <div>
            採点済み：
            <strong>
              {completedCount}
              {" / "}
              {answers.length}
            </strong>
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
              width: `${percentage}%`,
              height: "100%",
              background: "#222",
              transition:
                "width .15s ease",
            }}
          />
        </div>

        <section
          className="stepCard"
          style={{
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: 12,
            }}
          >
            <button
              type="button"
              className="secondaryButton"
              disabled={
                questionIndex === 0
              }
              onClick={
                previousQuestion
              }
            >
              ← 前の問題
            </button>

            <div
              style={{
                textAlign:
                  "center",
              }}
            >
              <strong>
                第
                {
                  currentQuestion.number
                }
                問
              </strong>

              <div>
                正解：
                {
                  currentQuestion.correctAnswer
                }
                {"　"}
                配点：
                {
                  currentQuestion.maxScore
                }
                点
              </div>
            </div>

            <button
              type="button"
              className="secondaryButton"
              disabled={
                questionIndex ===
                questions.length - 1
              }
              onClick={
                nextQuestion
              }
            >
              次の問題 →
            </button>
          </div>
        </section>

        <QuestionCrossSection
          questionNumber={
            currentQuestion.number
          }
          correctAnswer={
            currentQuestion.correctAnswer
          }
          maxScore={
            currentQuestion.maxScore
          }
          answers={answers}
          onUpdate={
            updateAnswer
          }
        />

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            この問題の採点状況
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
                ○ 正解
              </strong>

              <p>
                {
                  currentQuestionResults.filter(
                    (answer) =>
                      answer.mark ===
                      "○"
                  ).length
                }
                件
              </p>
            </div>

            <div className="selectionPanel">
              <strong>
                △ 部分点
              </strong>

              <p>
                {
                  currentQuestionResults.filter(
                    (answer) =>
                      answer.mark ===
                      "△"
                  ).length
                }
                件
              </p>
            </div>

            <div className="selectionPanel">
              <strong>
                × 不正解
              </strong>

              <p>
                {
                  currentQuestionResults.filter(
                    (answer) =>
                      answer.mark ===
                      "×"
                  ).length
                }
                件
              </p>
            </div>
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            キーボード操作
          </h2>

          <p>
            K：○　L：×　△：画面から選択
          </p>

          <p>
            ↑：前の問題　↓：次の問題
          </p>
        </section>
      </section>
    </main>
  );
}
