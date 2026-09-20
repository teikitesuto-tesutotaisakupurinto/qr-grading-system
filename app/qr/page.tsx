"use client";

import {
  useMemo,
  useState,
} from "react";

import SchoolHeader from "@/components/SchoolHeader";
import QRSheet from "@/components/QRSheet";

type QRMode =
  | "class"
  | "select"
  | "individual";

type DemoStudent = {
  id: string;
  name: string;
  school: string;
  grade: string;
  className: string;
};

const demoStudents: DemoStudent[] = [
  {
    id: "583214",
    name: "山田 太郎",
    school: "○○校",
    grade: "中学2年",
    className: "2TZ",
  },
  {
    id: "741928",
    name: "佐藤 花子",
    school: "○○校",
    grade: "中学2年",
    className: "2TZ",
  },
  {
    id: "316507",
    name: "鈴木 一郎",
    school: "○○校",
    grade: "中学2年",
    className: "2TS",
  },
];

export default function QRPage() {
  const [mode, setMode] =
    useState<QRMode | null>(null);

  const [school, setSchool] =
    useState("○○校");

  const [grade, setGrade] =
    useState("中学2年");

  const [className, setClassName] =
    useState("2TZ");

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const [individualId, setIndividualId] =
    useState("");

  const [showPreview, setShowPreview] =
    useState(false);

  const classStudents =
    useMemo(() => {
      return demoStudents.filter(
        (student) =>
          student.school === school &&
          student.grade === grade &&
          student.className ===
            className
      );
    }, [
      school,
      grade,
      className,
    ]);

  const selectedStudents =
    demoStudents.filter((student) =>
      selectedIds.includes(student.id)
    );

  const individualStudent =
    demoStudents.find(
      (student) =>
        student.id === individualId
    );

  function toggleStudent(
    studentId: string
  ) {
    setSelectedIds((current) =>
      current.includes(studentId)
        ? current.filter(
            (id) =>
              id !== studentId
          )
        : [...current, studentId]
    );
  }

  function startPreview() {
    setShowPreview(true);
  }

  function resetPreview() {
    setShowPreview(false);
  }

  return (
    <main className="page">
      <SchoolHeader title="QRコード発行" />

      <section className="content">
        <h1>QRコード発行</h1>

        {!mode && (
          <div className="functionGrid">
            <button
              type="button"
              className="functionCard"
              onClick={() =>
                setMode("class")
              }
            >
              クラス全員
            </button>

            <button
              type="button"
              className="functionCard"
              onClick={() =>
                setMode("select")
              }
            >
              生徒を選択
            </button>

            <button
              type="button"
              className="functionCard"
              onClick={() =>
                setMode("individual")
              }
            >
              個別発行
            </button>
          </div>
        )}

        {mode && !showPreview && (
          <div className="formCard">
            <button
              type="button"
              className="textButton"
              onClick={() =>
                setMode(null)
              }
            >
              ← 発行方法を選択し直す
            </button>

            {mode === "class" && (
              <>
                <h2>
                  クラス全員
                </h2>

                <label>
                  校舎
                  <select
                    value={school}
                    onChange={(event) =>
                      setSchool(
                        event.target.value
                      )
                    }
                  >
                    <option>
                      ○○校
                    </option>
                    <option>
                      △△校
                    </option>
                  </select>
                </label>

                <label>
                  学年
                  <select
                    value={grade}
                    onChange={(event) =>
                      setGrade(
                        event.target.value
                      )
                    }
                  >
                    <option>
                      中学1年
                    </option>
                    <option>
                      中学2年
                    </option>
                    <option>
                      中学3年
                    </option>
                  </select>
                </label>

                <label>
                  クラス
                  <select
                    value={className}
                    onChange={(event) =>
                      setClassName(
                        event.target.value
                      )
                    }
                  >
                    <option>
                      2TZ
                    </option>
                    <option>
                      2TS
                    </option>
                  </select>
                </label>

                <p>
                  対象：
                  {classStudents.length}
                  人
                </p>

                <button
                  type="button"
                  className="primaryButton"
                  disabled={
                    classStudents.length ===
                    0
                  }
                  onClick={
                    startPreview
                  }
                >
                  QRシートを作成
                </button>
              </>
            )}

            {mode === "select" && (
              <>
                <h2>
                  生徒を選択
                </h2>

                <div className="studentTable">
                  {demoStudents.map(
                    (student) => (
                      <label
                        key={student.id}
                        className="studentRow"
                        style={{
                          cursor:
                            "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(
                            student.id
                          )}
                          onChange={() =>
                            toggleStudent(
                              student.id
                            )
                          }
                        />

                        <div>
                          {student.id}
                        </div>

                        <div>
                          {student.name}
                        </div>

                        <div>
                          {student.school}
                        </div>

                        <div>
                          {student.grade}
                        </div>

                        <div>
                          {student.className}
                        </div>
                      </label>
                    )
                  )}
                </div>

                <p>
                  選択：
                  {selectedIds.length}
                  人
                </p>

                <button
                  type="button"
                  className="primaryButton"
                  disabled={
                    selectedIds.length ===
                    0
                  }
                  onClick={
                    startPreview
                  }
                >
                  選択した生徒の
                  QRシートを作成
                </button>
              </>
            )}

            {mode === "individual" && (
              <>
                <h2>
                  個別発行
                </h2>

                <label>
                  生徒
                  <select
                    value={individualId}
                    onChange={(event) =>
                      setIndividualId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      生徒を選択
                    </option>

                    {demoStudents.map(
                      (student) => (
                        <option
                          key={
                            student.id
                          }
                          value={
                            student.id
                          }
                        >
                          {student.name}
                          {"　"}
                          {student.id}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <button
                  type="button"
                  className="primaryButton"
                  disabled={
                    !individualStudent
                  }
                  onClick={
                    startPreview
                  }
                >
                  QRシートを作成
                </button>
              </>
            )}
          </div>
        )}

        {showPreview && (
          <div>
            <div className="actionBar">
              <button
                type="button"
                className="secondaryButton"
                onClick={
                  resetPreview
                }
              >
                ← 戻る
              </button>

              <button
                type="button"
                className="primaryButton"
                onClick={() =>
                  window.print()
                }
              >
                印刷
              </button>
            </div>

            <div className="qrPreview">
              {mode === "class" &&
                classStudents.map(
                  (student) => (
                    <QRSheet
                      key={student.id}
                      studentName={
                        student.name
                      }
                      studentNumber={
                        student.id
                      }
                    />
                  )
                )}

              {mode === "select" &&
                selectedStudents.map(
                  (student) => (
                    <QRSheet
                      key={student.id}
                      studentName={
                        student.name
                      }
                      studentNumber={
                        student.id
                      }
                    />
                  )
                )}

              {mode ===
                "individual" &&
                individualStudent && (
                  <QRSheet
                    studentName={
                      individualStudent.name
                    }
                    studentNumber={
                      individualStudent.id
                    }
                  />
                )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
