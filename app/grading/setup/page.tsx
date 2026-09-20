"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";
import StepBar from "@/components/StepBar";
import RegionEditor, {
  Region,
} from "@/components/RegionEditor";

type Question = {
  id: string;
  number: string;
  answer: string;
  score: number;
  gradingMethod:
    | "auto"
    | "manual"
    | "both";
  rubric: string;
};

type Section = {
  id: string;
  name: string;
  startQuestion: string;
  endQuestion: string;
};

const initialQuestions: Question[] = [
  {
    id: "q1",
    number: "1",
    answer: "③",
    score: 2,
    gradingMethod: "auto",
    rubric: "",
  },
  {
    id: "q2",
    number: "2",
    answer: "25",
    score: 3,
    gradingMethod: "auto",
    rubric: "",
  },
  {
    id: "q3",
    number: "3",
    answer: "○",
    score: 5,
    gradingMethod: "both",
    rubric: "思考・判断・表現",
  },
];

const initialSections: Section[] = [
  {
    id: "section-1",
    name: "大問1",
    startQuestion: "1",
    endQuestion: "3",
  },
];

export default function GradingSetupPage() {
  const [regions, setRegions] =
    useState<Region[]>([]);

  const [questions, setQuestions] =
    useState<Question[]>(
      initialQuestions
    );

  const [sections, setSections] =
    useState<Section[]>(
      initialSections
    );

  const [selectedQuestionId, setSelectedQuestionId] =
    useState("q1");

  const [selectedSectionId, setSelectedSectionId] =
    useState("section-1");

  const [answerImage] =
    useState(
      "/sample-answer.jpg"
    );

  const selectedQuestion =
    questions.find(
      (question) =>
        question.id ===
        selectedQuestionId
    );

  const selectedSection =
    sections.find(
      (section) =>
        section.id ===
        selectedSectionId
    );

  const totalScore = useMemo(
    () =>
      questions.reduce(
        (sum, question) =>
          sum + question.score,
        0
      ),
    [questions]
  );

  const sectionScore = useMemo(() => {
    if (!selectedSection) {
      return 0;
    }

    const start =
      Number(
        selectedSection.startQuestion
      );

    const end =
      Number(
        selectedSection.endQuestion
      );

    return questions
      .filter((question) => {
        const number =
          Number(question.number);

        return (
          number >= start &&
          number <= end
        );
      })
      .reduce(
        (sum, question) =>
          sum + question.score,
        0
      );
  }, [
    questions,
    selectedSection,
  ]);

  function updateQuestion(
    id: string,
    patch: Partial<Question>
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id
          ? {
              ...question,
              ...patch,
            }
          : question
      )
    );
  }

  function addQuestion() {
    const nextNumber =
      questions.length + 1;

    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      number: String(nextNumber),
      answer: "",
      score: 1,
      gradingMethod: "manual",
      rubric: "",
    };

    setQuestions((current) => [
      ...current,
      newQuestion,
    ]);

    setSelectedQuestionId(
      newQuestion.id
    );
  }

  function addSection() {
    const newSection: Section = {
      id: `section-${Date.now()}`,
      name: `大問${
        sections.length + 1
      }`,
      startQuestion: "1",
      endQuestion: String(
        questions.length
      ),
    };

    setSections((current) => [
      ...current,
      newSection,
    ]);

    setSelectedSectionId(
      newSection.id
    );
  }

  function updateSection(
    id: string,
    patch: Partial<Section>
  ) {
    setSections((current) =>
      current.map((section) =>
        section.id === id
          ? {
              ...section,
              ...patch,
            }
          : section
      )
    );
  }

  function deleteSection(id: string) {
    setSections((current) =>
      current.filter(
        (section) =>
          section.id !== id
      )
    );

    if (
      selectedSectionId === id
    ) {
      setSelectedSectionId("");
    }
  }

  function saveSettings() {
    console.log({
      regions,
      questions,
      sections,
    });

    alert(
      "採点設定を保存しました。"
    );
  }

  return (
    <main className="page">
      <SchoolHeader
        title="採点設定"
      />

      <section className="content">
        <StepBar
          currentStep={2}
        />

        <div className="pageHeader">
          <div>
            <h1>
              解答・採点設定
            </h1>

            <p>
              解答画像を見ながら枠・配点・大問・観点を設定します。
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.6fr) minmax(360px, 1fr)",
            gap: 20,
          }}
        >
          {/* 左：解答画像 */}
          <section className="stepCard">
            <h2>
              解答画像
            </h2>

            <RegionEditor
              imageUrl={answerImage}
              regions={regions}
              onChange={setRegions}
            />
          </section>

          {/* 右：設定 */}
          <section className="stepCard">
            <h2>
              採点設定
            </h2>

            {/* 大問 */}
            <section>
              <div
                className="pageHeader"
                style={{
                  marginBottom: 10,
                }}
              >
                <h3>
                  大問設定
                </h3>

                <button
                  type="button"
                  className="secondaryButton"
                  onClick={addSection}
                >
                  ＋ 大問
                </button>
              </div>

              {sections.map(
                (section) => (
                  <div
                    key={section.id}
                    className="selectionPanel"
                    style={{
                      cursor: "pointer",
                      borderColor:
                        selectedSectionId ===
                        section.id
                          ? "#222"
                          : undefined,
                    }}
                    onClick={() =>
                      setSelectedSectionId(
                        section.id
                      )
                    }
                  >
                    <div>
                      <input
                        value={
                          section.name
                        }
                        onChange={(
                          event
                        ) =>
                          updateSection(
                            section.id,
                            {
                              name: event
                                .target
                                .value,
                            }
                          )
                        }
                      />
                    </div>

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1fr 1fr",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <input
                        value={
                          section.startQuestion
                        }
                        onChange={(
                          event
                        ) =>
                          updateSection(
                            section.id,
                            {
                              startQuestion:
                                event
                                  .target
                                  .value,
                            }
                          )
                        }
                        placeholder="開始"
                      />

                      <input
                        value={
                          section.endQuestion
                        }
                        onChange={(
                          event
                        ) =>
                          updateSection(
                            section.id,
                            {
                              endQuestion:
                                event
                                  .target
                                  .value,
                            }
                          )
                        }
                        placeholder="終了"
                      />
                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        marginTop: 8,
                      }}
                    >
                      <span>
                        小計：
                        {
                          selectedSectionId ===
                          section.id
                            ? sectionScore
                            : 0
                        }
                        点
                      </span>

                      <button
                        type="button"
                        className="textButton"
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();
                          deleteSection(
                            section.id
                          );
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )
              )}
            </section>

            {/* 小問 */}
            <section
              style={{
                marginTop: 26,
              }}
            >
              <div
                className="pageHeader"
                style={{
                  marginBottom: 10,
                }}
              >
                <h3>
                  問題設定
                </h3>

                <button
                  type="button"
                  className="secondaryButton"
                  onClick={addQuestion}
                >
                  ＋ 問題
                </button>
              </div>

              <div
                className="listCard"
                style={{
                  maxHeight: 500,
                  overflowY:
                    "auto",
                }}
              >
                {questions.map(
                  (question) => (
                    <button
                      type="button"
                      key={question.id}
                      className="listRow"
                      style={{
                        width: "100%",
                        textAlign:
                          "left",
                        cursor:
                          "pointer",
                        border: 0,
                        borderBottom:
                          "1px solid #eee",
                        background:
                          selectedQuestionId ===
                          question.id
                            ? "#f3f3f3"
                            : "#fff",
                      }}
                      onClick={() =>
                        setSelectedQuestionId(
                          question.id
                        )
                      }
                    >
                      <strong>
                        問
                        {
                          question.number
                        }
                      </strong>

                      <span>
                        正解：
                        {
                          question.answer ||
                          "未設定"
                        }
                      </span>

                      <span>
                        {
                          question.score
                        }
                        点
                      </span>
                    </button>
                  )
                )}
              </div>
            </section>

            {/* 選択中の問題 */}
            {selectedQuestion && (
              <section
                style={{
                  marginTop: 24,
                }}
              >
                <h3>
                  問
                  {
                    selectedQuestion.number
                  }
                  の設定
                </h3>

                <label>
                  問題番号

                  <input
                    value={
                      selectedQuestion.number
                    }
                    onChange={(event) =>
                      updateQuestion(
                        selectedQuestion.id,
                        {
                          number:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                  />
                </label>

                <label>
                  正解

                  <input
                    value={
                      selectedQuestion.answer
                    }
                    onChange={(event) =>
                      updateQuestion(
                        selectedQuestion.id,
                        {
                          answer:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                  />
                </label>

                <label>
                  配点

                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={
                      selectedQuestion.score
                    }
                    onChange={(event) =>
                      updateQuestion(
                        selectedQuestion.id,
                        {
                          score:
                            Number(
                              event
                                .target
                                .value
                            ),
                        }
                      )
                    }
                  />
                </label>

                <label>
                  採点方式

                  <select
                    value={
                      selectedQuestion.gradingMethod
                    }
                    onChange={(event) =>
                      updateQuestion(
                        selectedQuestion.id,
                        {
                          gradingMethod:
                            event
                              .target
                              .value as Question["gradingMethod"],
                        }
                      )
                    }
                  >
                    <option value="auto">
                      自動採点
                    </option>

                    <option value="manual">
                      手動採点
                    </option>

                    <option value="both">
                      自動＋人確認
                    </option>
                  </select>
                </label>

                <label>
                  観点

                  <select
                    value={
                      selectedQuestion.rubric
                    }
                    onChange={(event) =>
                      updateQuestion(
                        selectedQuestion.id,
                        {
                          rubric:
                            event
                              .target
                              .value,
                        }
                      )
                    }
                  >
                    <option value="">
                      設定なし
                    </option>

                    <option>
                      知識・技能
                    </option>

                    <option>
                      思考・判断・表現
                    </option>

                    <option>
                      その他
                    </option>
                  </select>
                </label>
              </section>
            )}

            <div
              className="selectionPanel"
              style={{
                marginTop: 24,
              }}
            >
              <strong>
                合計配点
              </strong>

              <strong>
                {totalScore}点
              </strong>
            </div>

            <button
              type="button"
              className="primaryButton"
              onClick={
                saveSettings
              }
            >
              採点設定を保存
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}
