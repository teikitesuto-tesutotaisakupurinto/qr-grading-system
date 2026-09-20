"use client";

import { useEffect, useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";

import {
  createTest,
  getTests,
  type Test,
} from "@/lib/tests";

type TargetMode =
  | "all"
  | "specific";

type TargetClass = {
  id: string;
  school: string;
  grade: string;
  className: string;
};

const availableClasses: TargetClass[] = [
  {
    id: "tokyo-n2-tz",
    school: "○○校",
    grade: "中学2年",
    className: "2TZ",
  },
  {
    id: "tokyo-n2-ts",
    school: "○○校",
    grade: "中学2年",
    className: "2TS",
  },
  {
    id: "tokyo-n2-s",
    school: "○○校",
    grade: "中学2年",
    className: "2S",
  },
  {
    id: "chiba-n2-tz",
    school: "△△校",
    grade: "中学2年",
    className: "2TZ",
  },
  {
    id: "chiba-n2-ts",
    school: "△△校",
    grade: "中学2年",
    className: "2TS",
  },
  {
    id: "chiba-n3-tz",
    school: "△△校",
    grade: "中学3年",
    className: "3TZ",
  },
];

const subjects = [
  "国語",
  "数学",
  "英語",
  "理科",
  "社会",
];

export default function TestsPage() {
  const [tests, setTests] =
    useState<Test[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [showCreate, setShowCreate] =
    useState(false);

  const [name, setName] =
    useState("");

  const [date, setDate] =
    useState("");

  const [targetMode, setTargetMode] =
    useState<TargetMode>("all");

  const [selectedClasses, setSelectedClasses] =
    useState<string[]>([]);

  const [selectedSubjects, setSelectedSubjects] =
    useState<string[]>([]);

  const [message, setMessage] =
    useState("");

  async function loadTests() {
    setLoading(true);

    try {
      const data = await getTests();
      setTests(data);
    } catch {
      setMessage(
        "テスト情報を読み込めませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTests();
  }, []);

  const schools = useMemo(
    () =>
      Array.from(
        new Set(
          availableClasses.map(
            (item) => item.school
          )
        )
      ),
    []
  );

  function toggleClass(id: string) {
    setSelectedClasses((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  }

  function toggleSubject(
    subject: string
  ) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter(
            (item) => item !== subject
          )
        : [...current, subject]
    );
  }

  function selectSchool(
    school: string
  ) {
    const schoolIds =
      availableClasses
        .filter(
          (item) =>
            item.school === school
        )
        .map((item) => item.id);

    setSelectedClasses((current) =>
      Array.from(
        new Set([
          ...current,
          ...schoolIds,
        ])
      )
    );
  }

  function selectGrade(
    school: string,
    grade: string
  ) {
    const ids =
      availableClasses
        .filter(
          (item) =>
            item.school === school &&
            item.grade === grade
        )
        .map((item) => item.id);

    setSelectedClasses((current) =>
      Array.from(
        new Set([
          ...current,
          ...ids,
        ])
      )
    );
  }

  async function handleCreate() {
    setMessage("");

    if (!name.trim()) {
      setMessage(
        "テスト名を入力してください。"
      );
      return;
    }

    if (!date) {
      setMessage(
        "実施日を選択してください。"
      );
      return;
    }

    if (
      targetMode === "specific" &&
      selectedClasses.length === 0
    ) {
      setMessage(
        "対象クラスを選択してください。"
      );
      return;
    }

    if (
      selectedSubjects.length === 0
    ) {
      setMessage(
        "教科を1つ以上選択してください。"
      );
      return;
    }

    const schoolIds =
      targetMode === "all"
        ? schools
        : Array.from(
            new Set(
              availableClasses
                .filter((item) =>
                  selectedClasses.includes(
                    item.id
                  )
                )
                .map(
                  (item) => item.school
                )
            )
          );

    await createTest({
      name: name.trim(),
      date,
      targetSchoolIds:
        schoolIds,
      targetClassIds:
        targetMode === "all"
          ? []
          : selectedClasses,
      subjectIds:
        selectedSubjects,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setMessage(
      "テストを作成しました。"
    );

    setName("");
    setDate("");
    setTargetMode("all");
    setSelectedClasses([]);
    setSelectedSubjects([]);
    setShowCreate(false);

    await loadTests();
  }

  return (
    <main className="page">
      <SchoolHeader title="テスト管理" />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>テスト管理</h1>
            <p>
              全校統一テストを基本として、対象クラスを指定できます。
            </p>
          </div>

          <button
            type="button"
            className="primaryButton"
            onClick={() =>
              setShowCreate(true)
            }
          >
            ＋ テスト作成
          </button>
        </div>

        {message && (
          <div className="selectionPanel">
            {message}
          </div>
        )}

        {showCreate && (
          <section className="formCard">
            <h2>テスト作成</h2>

            <label>
              テスト名

              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="第1回確認テスト"
              />
            </label>

            <label>
              実施日

              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(
                    event.target.value
                  )
                }
              />
            </label>

            <h3>対象</h3>

            <div className="actionBar">
              <button
                type="button"
                className={
                  targetMode === "all"
                    ? "primaryButton"
                    : "secondaryButton"
                }
                onClick={() => {
                  setTargetMode("all");
                  setSelectedClasses([]);
                }}
              >
                全校
              </button>

              <button
                type="button"
                className={
                  targetMode === "specific"
                    ? "primaryButton"
                    : "secondaryButton"
                }
                onClick={() =>
                  setTargetMode(
                    "specific"
                  )
                }
              >
                指定する
              </button>
            </div>

            {targetMode === "all" && (
              <div className="selectionPanel">
                <strong>
                  全校統一テスト
                </strong>

                <p>
                  登録されている全校舎を対象にします。
                </p>
              </div>
            )}

            {targetMode ===
              "specific" && (
              <div>
                <h3>
                  校舎・学年・クラス
                </h3>

                {schools.map(
                  (schoolName) => {
                    const grades =
                      Array.from(
                        new Set(
                          availableClasses
                            .filter(
                              (item) =>
                                item.school ===
                                schoolName
                            )
                            .map(
                              (item) =>
                                item.grade
                            )
                        )
                      );

                    return (
                      <div
                        key={schoolName}
                        className="formCard"
                        style={{
                          marginBottom:
                            12,
                        }}
                      >
                        <strong>
                          {schoolName}
                        </strong>

                        <div
                          className="actionBar"
                          style={{
                            marginTop:
                              10,
                          }}
                        >
                          <button
                            type="button"
                            className="secondaryButton"
                            onClick={() =>
                              selectSchool(
                                schoolName
                              )
                            }
                          >
                            {schoolName}
                            全体
                          </button>

                          {grades.map(
                            (gradeName) => (
                              <button
                                key={
                                  gradeName
                                }
                                type="button"
                                className="secondaryButton"
                                onClick={() =>
                                  selectGrade(
                                    schoolName,
                                    gradeName
                                  )
                                }
                              >
                                {schoolName}
                                {" "}
                                {gradeName}
                              </button>
                            )
                          )}
                        </div>

                        <div>
                          {availableClasses
                            .filter(
                              (item) =>
                                item.school ===
                                schoolName
                            )
                            .map(
                              (item) => (
                                <label
                                  key={
                                    item.id
                                  }
                                  style={{
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    gap: 8,
                                    marginBottom:
                                      8,
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedClasses.includes(
                                      item.id
                                    )}
                                    onChange={() =>
                                      toggleClass(
                                        item.id
                                      )
                                    }
                                  />

                                  <span>
                                    {item.school}
                                    {" "}
                                    {item.grade}
                                    {" "}
                                    {item.className}
                                  </span>
                                </label>
                              )
                            )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            <h3>
              教科
            </h3>

            <div className="actionBar">
              {subjects.map(
                (subject) => (
                  <button
                    key={subject}
                    type="button"
                    className={
                      selectedSubjects.includes(
                        subject
                      )
                        ? "primaryButton"
                        : "secondaryButton"
                    }
                    onClick={() =>
                      toggleSubject(
                        subject
                      )
                    }
                  >
                    {selectedSubjects.includes(
                      subject
                    )
                      ? "✓ "
                      : ""}
                    {subject}
                  </button>
                )
              )}
            </div>

            <div className="actionBar">
              <button
                type="button"
                className="secondaryButton"
                onClick={() =>
                  setShowCreate(false)
                }
              >
                キャンセル
              </button>

              <button
                type="button"
                className="primaryButton"
                onClick={
                  handleCreate
                }
              >
                テストを作成
              </button>
            </div>
          </section>
        )}

        <section className="listCard">
          {loading ? (
            <div className="emptyState">
              読み込み中...
            </div>
          ) : tests.length === 0 ? (
            <div className="emptyState">
              テストがありません。
            </div>
          ) : (
            tests.map((test) => (
              <div
                key={test.id}
                className="listRow"
              >
                <strong>
                  {test.name}
                </strong>

                <span>
                  {test.date}
                </span>

                <span>
                  {test.status}
                </span>
              </div>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
