"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import SchoolHeader from "@/components/SchoolHeader";
import StudentTable, {
  Student,
} from "@/components/StudentTable";

import {
  getStudents,
  updateStudentsFromCsv,
} from "@/lib/students";

import {
  downloadCsv,
  parseCsv,
} from "@/lib/csv";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");

  const [school, setSchool] =
    useState("すべて");

  const [grade, setGrade] =
    useState("すべて");

  const [className, setClassName] =
    useState("すべて");

  const [selectionMode, setSelectionMode] =
    useState(false);

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  async function loadStudents() {
    setLoading(true);
    setMessage("");

    try {
      const data = await getStudents();
      setStudents(data);
    } catch {
      setMessage(
        "生徒データを読み込めませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const schools = useMemo(
    () =>
      Array.from(
        new Set(
          students.map(
            (student) =>
              student.schoolName
          )
        )
      ).sort(),
    [students]
  );

  const grades = useMemo(
    () =>
      Array.from(
        new Set(
          students.map(
            (student) =>
              student.grade
          )
        )
      ).sort(),
    [students]
  );

  const classes = useMemo(
    () =>
      Array.from(
        new Set(
          students.map(
            (student) =>
              student.className
          )
        )
      ).sort(),
    [students]
  );

  const filteredStudents =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      return students.filter(
        (student) => {
          const matchesKeyword =
            keyword === "" ||
            student.name
              .toLowerCase()
              .includes(keyword) ||
            student.id
              .toLowerCase()
              .includes(keyword);

          const matchesSchool =
            school === "すべて" ||
            student.schoolName === school;

          const matchesGrade =
            grade === "すべて" ||
            student.grade === grade;

          const matchesClass =
            className === "すべて" ||
            student.className === className;

          return (
            matchesKeyword &&
            matchesSchool &&
            matchesGrade &&
            matchesClass
          );
        }
      );
    }, [
      students,
      search,
      school,
      grade,
      className,
    ]);

  function toggleStudent(
    studentId: string
  ) {
    setSelectedIds((current) =>
      current.includes(studentId)
        ? current.filter(
            (id) => id !== studentId
          )
        : [...current, studentId]
    );
  }

  function toggleAll() {
    const visibleIds =
      filteredStudents.map(
        (student) => student.id
      );

    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) =>
        selectedIds.includes(id)
      );

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) =>
            !visibleIds.includes(id)
        )
      );
    } else {
      setSelectedIds((current) =>
        Array.from(
          new Set([
            ...current,
            ...visibleIds,
          ])
        )
      );
    }
  }

  function downloadStudentTemplate() {
    const csv =
      "\uFEFF" +
      [
        [
          "生徒番号",
          "氏名",
          "校舎",
          "学年",
          "クラス",
          "在籍状況",
        ],
        [
          "",
          "山田 太郎",
          "○○校",
          "中学2年",
          "2TZ",
          "在籍",
        ],
      ]
        .map((row) =>
          row
            .map(
              (value) =>
                `"${value.replace(
                  /"/g,
                  '""'
                )}"`
            )
            .join(",")
        )
        .join("\n");

    downloadCsv(
      "生徒CSVテンプレート.csv",
      csv
    );
  }

  function downloadCurrentStudents() {
    const rows = students.map(
      (student) => [
        student.id,
        student.name,
        student.schoolName,
        student.grade,
        student.className,
        student.status,
      ]
    );

    const csv =
      "\uFEFF" +
      [
        [
          "生徒番号",
          "氏名",
          "校舎",
          "学年",
          "クラス",
          "在籍状況",
        ],
        ...rows,
      ]
        .map((row) =>
          row
            .map(
              (value) =>
                `"${String(value).replace(
                  /"/g,
                  '""'
                )}"`
            )
            .join(",")
        )
        .join("\n");

    downloadCsv(
      "生徒一覧.csv",
      csv
    );
  }

  async function handleCsvUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setLoading(true);
    setMessage("");

    try {
      const text =
        await file.text();

      const rows =
        parseCsv(text);

      if (rows.length === 0) {
        throw new Error(
          "CSVにデータがありません。"
        );
      }

      const imported =
        rows.map((row) => ({
          id:
            row["生徒番号"] ?? "",
          name:
            row["氏名"] ?? "",
          schoolId:
            row["校舎"] ?? "",
          schoolName:
            row["校舎"] ?? "",
          grade:
            row["学年"] ?? "",
          className:
            row["クラス"] ?? "",
          status:
            (row["在籍状況"] as Student["status"]) ||
            "在籍",
        }));

      const invalid =
        imported.filter(
          (student) =>
            !student.name ||
            !student.schoolName ||
            !student.grade ||
            !student.className
        );

      if (invalid.length > 0) {
        throw new Error(
          `${invalid.length}件の必須項目が不足しています。`
        );
      }

      const ids =
        await updateStudentsFromCsv(
          imported
        );

      await loadStudents();

      setMessage(
        `${ids.length}人の生徒情報を反映しました。`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "CSVの処理に失敗しました。"
      );
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  function startQrSelection() {
    setSelectionMode(true);
    setSelectedIds([]);
    setMessage("");
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function createQrSheets() {
    if (selectedIds.length === 0) {
      setMessage(
        "QRシートを発行する生徒を選択してください。"
      );
      return;
    }

    /*
      次のQR画面で、
      クラス全員・選択・個別の
      A4横18枚シート生成へ接続します。
    */

    setMessage(
      `${selectedIds.length}人分のQRシート発行対象を確定しました。`
    );
  }

  return (
    <main className="page">
      <SchoolHeader title="生徒一覧" />

      <section className="content">
        <h1>生徒一覧</h1>

        <div className="actionBar">
          <button
            type="button"
            className="primaryButton"
            onClick={
              downloadStudentTemplate
            }
          >
            テンプレートをダウンロード
          </button>

          <label className="secondaryButton">
            CSVをアップロード

            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={
                handleCsvUpload
              }
            />
          </label>

          <button
            type="button"
            className="secondaryButton"
            onClick={
              downloadCurrentStudents
            }
          >
            現在の生徒CSVをダウンロード
          </button>

          {!selectionMode ? (
            <button
              type="button"
              className="secondaryButton"
              onClick={
                startQrSelection
              }
            >
              QRシート発行
            </button>
          ) : (
            <button
              type="button"
              className="secondaryButton"
              onClick={
                cancelSelection
              }
            >
              選択を終了
            </button>
          )}
        </div>

        {message && (
          <div className="selectionPanel">
            {message}
          </div>
        )}

        <div className="filters">
          <input
            type="search"
            placeholder="氏名・生徒番号で検索"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          <select
            value={school}
            onChange={(event) =>
              setSchool(
                event.target.value
              )
            }
          >
            <option>すべて</option>

            {schools.map(
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
            value={grade}
            onChange={(event) =>
              setGrade(
                event.target.value
              )
            }
          >
            <option>すべて</option>

            {grades.map(
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
            value={className}
            onChange={(event) =>
              setClassName(
                event.target.value
              )
            }
          >
            <option>すべて</option>

            {classes.map(
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

        {selectionMode && (
          <div className="selectedBar">
            <button
              type="button"
              className="secondaryButton"
              onClick={toggleAll}
            >
              表示中を全員選択
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
              選択：{selectedIds.length}人
            </span>

            <button
              type="button"
              className="primaryButton"
              disabled={
                selectedIds.length === 0
              }
              onClick={
                createQrSheets
              }
            >
              選択した生徒のQRシートを発行
            </button>
          </div>
        )}

        {loading ? (
          <div className="emptyState">
            読み込み中...
          </div>
        ) : (
          <StudentTable
            students={
              filteredStudents
            }
            selectionMode={
              selectionMode
            }
            selectedIds={
              selectedIds
            }
            onToggle={
              toggleStudent
            }
            onToggleAll={
              toggleAll
            }
          />
        )}
      </section>
    </main>
  );
}
