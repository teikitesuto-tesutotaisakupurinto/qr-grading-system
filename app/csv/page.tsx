"use client";

import {
  ChangeEvent,
  useState,
} from "react";

import SchoolHeader from "@/components/SchoolHeader";
import {
  createCsv,
  downloadCsv,
  parseCsv,
} from "@/lib/csv";

type ImportType =
  | "students"
  | "scores"
  | "retests";

type PreviewRow = {
  [key: string]: string;
};

const templates: Record<
  ImportType,
  {
    name: string;
    headers: string[];
    sample: string[];
  }
> = {
  students: {
    name: "生徒CSV",
    headers: [
      "生徒番号",
      "氏名",
      "校舎",
      "学年",
      "クラス",
      "在籍状況",
    ],
    sample: [
      "",
      "山田 太郎",
      "○○校",
      "中学2年",
      "2TZ",
      "在籍",
    ],
  },

  scores: {
    name: "成績CSV",
    headers: [
      "生徒番号",
      "テストID",
      "教科",
      "得点",
      "満点",
      "得点率",
      "偏差値",
      "順位",
    ],
    sample: [
      "583214",
      "test-001",
      "数学",
      "42",
      "50",
      "84.0",
      "58.7",
      "21",
    ],
  },

  retests: {
    name: "追試CSV",
    headers: [
      "生徒番号",
      "テストID",
      "教科",
      "追試点数",
      "満点",
    ],
    sample: [
      "583214",
      "test-001",
      "数学",
      "45",
      "50",
    ],
  },
};

export default function CsvPage() {
  const [importType, setImportType] =
    useState<ImportType>(
      "students"
    );

  const [preview, setPreview] =
    useState<PreviewRow[]>([]);

  const [fileName, setFileName] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [processing, setProcessing] =
    useState(false);

  function downloadTemplate() {
    const template =
      templates[importType];

    const csv = createCsv(
      template.headers,
      [template.sample]
    );

    downloadCsv(
      `${template.name}_テンプレート.csv`,
      csv
    );

    setMessage(
      `${template.name}のテンプレートをダウンロードしました。`
    );
    setError("");
  }

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setError("");
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

      const requiredHeaders =
        templates[
          importType
        ].headers;

      const firstRow =
        rows[0];

      const missingHeaders =
        requiredHeaders.filter(
          (header) =>
            !(header in firstRow)
        );

      if (
        missingHeaders.length > 0
      ) {
        throw new Error(
          `必要な列がありません：${missingHeaders.join(
            "、"
          )}`
        );
      }

      setPreview(
        rows.slice(0, 100)
      );

      setMessage(
        `${rows.length}件を読み込みました。最大100件をプレビュー表示しています。`
      );
    } catch (err) {
      setPreview([]);

      setError(
        err instanceof Error
          ? err.message
          : "CSVを読み込めませんでした。"
      );
    }

    event.target.value = "";
  }

  async function executeImport() {
    if (preview.length === 0) {
      setError(
        "アップロードするデータがありません。"
      );
      return;
    }

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      /*
        本番ではここで、

        students → Firestore students
        scores   → Firestore scores
        retests  → Firestore retests

        へCloud Functions経由で
        一括反映します。
      */

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 500)
      );

      setMessage(
        `${fileName}のCSVを登録処理しました。`
      );
    } catch {
      setError(
        "CSVの登録に失敗しました。"
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="page">
      <SchoolHeader title="CSV管理" />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>CSV管理</h1>

            <p>
              生徒・成績・追試などのデータをCSVで管理します。
            </p>
          </div>
        </div>

        <section className="formCard">
          <h2>
            CSV種類
          </h2>

          <div className="actionBar">
            {Object.entries(
              templates
            ).map(
              ([key, template]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    importType ===
                    key
                      ? "primaryButton"
                      : "secondaryButton"
                  }
                  onClick={() => {
                    setImportType(
                      key as ImportType
                    );
                    setPreview([]);
                    setError("");
                    setMessage("");
                  }}
                >
                  {template.name}
                </button>
              )
            )}
          </div>

          <div
            className="actionBar"
            style={{
              marginTop: 20,
            }}
          >
            <button
              type="button"
              className="primaryButton"
              onClick={
                downloadTemplate
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
                  handleUpload
                }
              />
            </label>
          </div>
        </section>

        {message && (
          <div
            className="selectionPanel"
            style={{
              marginTop: 20,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="formError"
            style={{
              marginTop: 20,
            }}
          >
            {error}
          </div>
        )}

        {fileName && (
          <section
            className="stepCard"
            style={{
              marginTop: 20,
            }}
          >
            <h2>
              アップロード確認
            </h2>

            <p>
              ファイル：
              <strong>
                {fileName}
              </strong>
            </p>

            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              {preview.length >
              0 && (
                <table>
                  <thead>
                    <tr>
                      {Object.keys(
                        preview[0]
                      ).map(
                        (header) => (
                          <th key={header}>
                            {header}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {preview.map(
                      (
                        row,
                        index
                      ) => (
                        <tr
                          key={
                            index
                          }
                        >
                          {Object.keys(
                            preview[0]
                          ).map(
                            (
                              header
                            ) => (
                              <td
                                key={
                                  header
                                }
                              >
                                {
                                  row[
                                    header
                                  ]
                                }
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div
              className="actionBar"
              style={{
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="secondaryButton"
                onClick={() => {
                  setPreview([]);
                  setFileName("");
                  setMessage("");
                }}
              >
                キャンセル
              </button>

              <button
                type="button"
                className="primaryButton"
                disabled={
                  processing ||
                  preview.length ===
                    0
                }
                onClick={
                  executeImport
                }
              >
                {processing
                  ? "反映中..."
                  : "確認して反映"}
              </button>
            </div>
          </section>
        )}

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            CSV運用
          </h2>

          <div className="listCard">
            <div className="listRow">
              <strong>
                生徒情報
              </strong>

              <span>
                テンプレート →
                編集 →
                アップロード
              </span>

              <span>
                6桁番号自動発行
              </span>
            </div>

            <div className="listRow">
              <strong>
                成績
              </strong>

              <span>
                得点・得点率・偏差値・順位
              </span>

              <span>
                CSV入出力
              </span>
            </div>

            <div className="listRow">
              <strong>
                追試
              </strong>

              <span>
                追試点数
              </span>

              <span>
                CSV入出力
              </span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
