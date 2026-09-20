"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";

type AnswerFile = {
  id: string;
  testName: string;
  subject: string;
  studentNumber: string;
  fileName: string;
  status:
    | "採点前"
    | "採点中"
    | "採点済み"
    | "公開済み";
  uploadedAt: string;
};

const demoAnswers: AnswerFile[] = [
  {
    id: "answer-001",
    testName: "第1回確認テスト",
    subject: "数学",
    studentNumber: "583214",
    fileName: "583214_math.pdf",
    status: "公開済み",
    uploadedAt: "2026/09/24 10:15",
  },
  {
    id: "answer-002",
    testName: "第1回確認テスト",
    subject: "数学",
    studentNumber: "741928",
    fileName: "741928_math.pdf",
    status: "採点中",
    uploadedAt: "2026/09/24 10:16",
  },
];

export default function AnswerDownloadPage() {
  const [test, setTest] =
    useState("すべて");

  const [subject, setSubject] =
    useState("すべて");

  const [status, setStatus] =
    useState("すべて");

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const tests = useMemo(
    () =>
      Array.from(
        new Set(
          demoAnswers.map(
            (answer) =>
              answer.testName
          )
        )
      ),
    []
  );

  const subjects = useMemo(
    () =>
      Array.from(
        new Set(
          demoAnswers.map(
            (answer) =>
              answer.subject
          )
        )
      ),
    []
  );

  const statuses = [
    "採点前",
    "採点中",
    "採点済み",
    "公開済み",
  ];

  const filteredAnswers =
    demoAnswers.filter(
      (answer) =>
        (test === "すべて" ||
          answer.testName === test) &&
        (subject === "すべて" ||
          answer.subject === subject) &&
        (status === "すべて" ||
          answer.status === status)
    );

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  }

  function toggleAll() {
    const ids =
      filteredAnswers.map(
        (answer) => answer.id
      );

    const allSelected =
      ids.length > 0 &&
      ids.every((id) =>
        selectedIds.includes(id)
      );

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !ids.includes(id)
        )
      );
    } else {
      setSelectedIds((current) =>
        Array.from(
          new Set([
            ...current,
            ...ids,
          ])
        )
      );
    }
  }

  function downloadSelected() {
    if (selectedIds.length === 0) {
      alert(
        "ダウンロードする答案を選択してください。"
      );
      return;
    }

    alert(
      `${selectedIds.length}件の答案画像をダウンロードします。`
    );
  }

  return (
    <main className="page">
      <SchoolHeader
        title="答案画像ダウンロード"
      />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>
              答案画像ダウンロード
            </h1>

            <p>
              採点前・採点済みの答案を条件指定して管理できます。
            </p>
          </div>
        </div>

        <div className="filters">
          <select
            value={test}
            onChange={(event) =>
              setTest(
                event.target.value
              )
            }
          >
            <option>
              すべて
            </option>

            {tests.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>

          <select
            value={subject}
            onChange={(event) =>
              setSubject(
                event.target.value
              )
            }
          >
            <option>
              すべて
            </option>

            {subjects.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value
              )
            }
          >
            <option>
              すべて
            </option>

            {statuses.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        <div className="selectedBar">
          <button
            type="button"
            className="secondaryButton"
            onClick={toggleAll}
          >
            表示中を全選択
          </button>

          <button
            type="button"
            className="textButton"
            onClick={() =>
              setSelectedIds([])
            }
          >
            選択解除
          </button>

          <span>
            選択：
            {selectedIds.length}件
          </span>

          <button
            type="button"
            className="primaryButton"
            disabled={
              selectedIds.length === 0
            }
            onClick={
              downloadSelected
            }
          >
            選択した答案をダウンロード
          </button>
        </div>

        <div className="listCard">
          {filteredAnswers.length ===
          0 ? (
            <div className="emptyState">
              答案がありません。
            </div>
          ) : (
            filteredAnswers.map(
              (answer) => (
                <label
                  key={answer.id}
                  className="listRow"
                  style={{
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(
                      answer.id
                    )}
                    onChange={() =>
                      toggleSelected(
                        answer.id
                      )
                    }
                  />

                  <strong>
                    {answer.testName}
                    {" / "}
                    {answer.subject}
                  </strong>

                  <span>
                    {answer.fileName}
                  </span>

                  <span>
                    {answer.status}
                  </span>
                </label>
              )
            )
          )}
        </div>
      </section>
    </main>
  );
}
