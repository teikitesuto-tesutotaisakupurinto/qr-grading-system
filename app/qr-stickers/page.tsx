"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import QRCode from "qrcode";

import {
  getStudents,
  type Student,
} from "@/lib/students";

type StickerStudent = Student & {
  qrDataUrl?: string;
};

const STICKER_WIDTH_MM = 30;
const STICKER_HEIGHT_MM = 20;

const COLUMNS = 6;
const ROWS = 3;

const STICKERS_PER_STUDENT =
  COLUMNS * ROWS;

const STUDENTS_PER_PAGE = 2;

export default function QrStickersPage() {
  const [
    students,
    setStudents,
  ] = useState<Student[]>([]);

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<string[]>([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    logoUrl,
    setLogoUrl,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const data =
          await getStudents({
            status: "在籍",
          });

        if (!cancelled) {
          setStudents(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "生徒一覧を取得できませんでした。"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStudents =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return students;
      }

      return students.filter(
        (student) =>
          student.id
            .toLowerCase()
            .includes(keyword) ||
          student.name
            .toLowerCase()
            .includes(keyword) ||
          student.className
            .toLowerCase()
            .includes(keyword) ||
          student.grade
            .toLowerCase()
            .includes(keyword)
      );
    }, [
      students,
      search,
    ]);

  const selectedStudents =
    useMemo(
      () =>
        selectedIds
          .map((id) =>
            students.find(
              (student) =>
                student.id ===
                id
            )
          )
          .filter(
            (
              student
            ): student is Student =>
              Boolean(student)
          ),
      [
        selectedIds,
        students,
      ]
    );

  function toggleStudent(
    studentId: string
  ) {
    setSelectedIds(
      (current) =>
        current.includes(
          studentId
        )
          ? current.filter(
              (id) =>
                id !==
                studentId
            )
          : [
              ...current,
              studentId,
            ]
    );
  }

  function toggleAllVisible() {
    const visibleIds =
      filteredStudents.map(
        (student) =>
          student.id
      );

    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every(
        (id) =>
          selectedIds.includes(
            id
          )
      );

    if (allSelected) {
      setSelectedIds(
        (current) =>
          current.filter(
            (id) =>
              !visibleIds.includes(
                id
              )
          )
      );
      return;
    }

    setSelectedIds(
      (current) =>
        Array.from(
          new Set([
            ...current,
            ...visibleIds,
          ])
        )
    );
  }

  async function generateQr(
    studentNumber: string
  ) {
    return QRCode.toDataURL(
      studentNumber,
      {
        errorCorrectionLevel:
          "H",

        margin: 0,

        width: 180,

        color: {
          dark: "#000000",

          light: "#ffffff",
        },
      }
    );
  }

  async function printStickers() {
    if (
      selectedStudents.length ===
      0
    ) {
      setError(
        "生徒を1人以上選択してください。"
      );

      return;
    }

    try {
      setGenerating(true);
      setError("");

      const studentsWithQr: StickerStudent[] =
        await Promise.all(
          selectedStudents.map(
            async (
              student
            ) => ({
              ...student,

              qrDataUrl:
                await generateQr(
                  student.id
                ),
            })
          )
        );

      /*
       * 生成済みQRをDOMへ反映する。
       */
      setPrintStudents(
        studentsWithQr
      );

      /*
       * Reactの描画完了後に印刷。
       */
      window.setTimeout(
        () => {
          window.print();

          setGenerating(
            false
          );
        },
        300
      );
    } catch (err) {
      setGenerating(false);

      setError(
        err instanceof Error
          ? err.message
          : "QRコードの生成に失敗しました。"
      );
    }
  }

  const [
    printStudents,
    setPrintStudents,
  ] = useState<
    StickerStudent[]
  >([]);

  /*
   * 2人ずつA4ページに配置。
   */
  const pages =
    useMemo(() => {
      const result: StickerStudent[][] =
        [];

      for (
        let i = 0;
        i <
        printStudents.length;
        i +=
          STUDENTS_PER_PAGE
      ) {
        result.push(
          printStudents.slice(
            i,
            i +
              STUDENTS_PER_PAGE
          )
        );
      }

      return result;
    }, [
      printStudents,
    ]);

  return (
    <>
      <main className="screenOnly">
        <header
          style={{
            padding:
              "24px 32px",

            borderBottom:
              "1px solid #ddd",
          }}
        >
          <h1
            style={{
              margin: 0,
            }}
          >
            生徒QRシール発行
          </h1>

          <p
            style={{
              marginBottom: 0,
              color: "#666",
            }}
          >
            A4横・1ページ2人・
            1人18枚・1枚30mm×20mm
          </p>
        </header>

        <section
          style={{
            padding: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems:
                "center",
              marginBottom: 20,
            }}
          >
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="氏名・生徒番号・クラスで検索"
              style={{
                width: 360,
                padding:
                  "10px 12px",
                border:
                  "1px solid #ccc",
                borderRadius: 6,
              }}
            />

            <button
              type="button"
              onClick={
                toggleAllVisible
              }
            >
              表示中を全選択
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  []
                )
              }
            >
              選択解除
            </button>
          </div>

          <div
            style={{
              marginBottom: 20,
            }}
          >
            <label>
              塾ロゴURL
              <input
                type="text"
                value={logoUrl}
                onChange={(
                  event
                ) =>
                  setLogoUrl(
                    event.target
                      .value
                  )
                }
                placeholder="https://..."
                style={{
                  display:
                    "block",

                  width: 500,

                  marginTop: 6,

                  padding:
                    "10px 12px",

                  border:
                    "1px solid #ccc",

                  borderRadius: 6,
                }}
              />
            </label>

            <p
              style={{
                color: "#777",
                fontSize: 13,
              }}
            >
              後で管理者設定の塾ロゴに接続します。
            </p>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,

                padding: 12,

                background:
                  "#fff1f1",

                border:
                  "1px solid #e0aaaa",

                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              marginBottom: 16,
            }}
          >
            選択：
            <strong>
              {
                selectedIds.length
              }
            </strong>
            人
          </div>

          {loading ? (
            <p>
              生徒を読み込んでいます...
            </p>
          ) : (
            <div
              style={{
                border:
                  "1px solid #ddd",

                borderRadius: 8,

                overflow:
                  "hidden",
              }}
            >
              {filteredStudents.map(
                (
                  student
                ) => {
                  const selected =
                    selectedIds.includes(
                      student.id
                    );

                  return (
                    <label
                      key={
                        student.id
                      }
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "40px 110px 1fr 120px 120px",

                        alignItems:
                          "center",

                        gap: 12,

                        padding:
                          "12px 16px",

                        borderBottom:
                          "1px solid #eee",

                        background:
                          selected
                            ? "#f5f8ff"
                            : "#fff",

                        cursor:
                          "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selected
                        }
                        onChange={() =>
                          toggleStudent(
                            student.id
                          )
                        }
                      />

                      <strong>
                        {
                          student.id
                        }
                      </strong>

                      <span>
                        {
                          student.name
                        }
                      </span>

                      <span>
                        {
                          student.grade
                        }
                      </span>

                      <span>
                        {
                          student.className
                        }
                      </span>
                    </label>
                  );
                }
              )}
            </div>
          )}

          <div
            style={{
              marginTop: 24,
            }}
          >
            <button
              type="button"
              disabled={
                generating ||
                selectedStudents.length ===
                  0
              }
              onClick={
                printStickers
              }
              style={{
                padding:
                  "14px 28px",

                border: "none",

                borderRadius: 7,

                background:
                  "#111",

                color:
                  "#fff",

                fontSize: 16,

                cursor:
                  "pointer",
              }}
            >
              {generating
                ? "印刷データを作成中..."
                : "QRシールを印刷"}
            </button>
          </div>
        </section>
      </main>

      <main className="printArea">
        {pages.map(
          (
            pageStudents,
            pageIndex
          ) => (
            <section
              className="stickerPage"
              key={
                pageIndex
              }
            >
              {pageStudents.map(
                (
                  student
                ) => (
                  <StudentStickerSheet
                    key={
                      student.id
                    }
                    student={
                      student
                    }
                    logoUrl={
                      logoUrl
                    }
                  />
                )
              )}
            </section>
          )
        )}
      </main>

      <style jsx global>{`
        @media screen {
          .printArea {
            display: none;
          }
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .screenOnly {
            display: none !important;
          }

          .printArea {
            display: block !important;
          }

          .stickerPage {
            width: 297mm;
            height: 210mm;

            box-sizing: border-box;

            padding: 10mm 12mm;

            page-break-after: always;

            display: flex;

            flex-direction: column;

            gap: 10mm;

            overflow: hidden;
          }

          .stickerPage:last-child {
            page-break-after: auto;
          }

          .studentStickerSheet {
            width: 100%;

            height: 90mm;

            box-sizing: border-box;

            position: relative;

            overflow: hidden;
          }

          .studentHeader {
            height: 15mm;

            display: flex;

            align-items: flex-start;

            justify-content: space-between;

            box-sizing: border-box;

            padding:
              0 2mm 2mm 2mm;
          }

          .studentHeaderLogo {
            width: 42mm;

            height: 10mm;

            object-fit: contain;

            object-position: left
              center;
          }

          .studentHeaderText {
            font-size: 12pt;

            font-weight: 700;

            white-space: nowrap;

            padding-top: 1mm;
          }

          .stickerGrid {
            width: 180mm;

            height: 60mm;

            margin-left: auto;

            margin-right: auto;

            display: grid;

            grid-template-columns:
              repeat(6, 30mm);

            grid-template-rows:
              repeat(3, 20mm);
          }

          .sticker {
            width: 30mm;

            height: 20mm;

            box-sizing: border-box;

            border: 0.25mm solid #999;

            display: flex;

            align-items: center;

            padding:
              1.5mm;

            overflow: hidden;

            break-inside: avoid;
          }

          .stickerQr {
            width: 16mm;

            height: 16mm;

            flex: 0 0 16mm;

            object-fit: contain;
          }

          .stickerText {
            min-width: 0;

            flex: 1;

            height: 17mm;

            display: flex;

            flex-direction: column;

            justify-content: center;

            padding-left: 1.5mm;

            overflow: hidden;
          }

          .stickerName {
            font-size: 8pt;

            line-height: 1.25;

            font-weight: 700;

            white-space: nowrap;

            overflow: hidden;

            text-overflow: ellipsis;
          }

          .stickerNumber {
            font-size: 8pt;

            line-height: 1.25;

            font-weight: 600;

            margin-top: 1mm;

            white-space: nowrap;
          }
        }
      `}</style>
    </>
  );
}

/* =========================================================
   1人分のシート
   ========================================================= */

function StudentStickerSheet({
  student,
  logoUrl,
}: {
  student: StickerStudent;

  logoUrl: string;
}) {
  return (
    <div className="studentStickerSheet">
      <div className="studentHeader">
        {logoUrl ? (
          <img
            className="studentHeaderLogo"
            src={logoUrl}
            alt=""
          />
        ) : (
          <div
            style={{
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            塾ロゴ
          </div>
        )}

        <div className="studentHeaderText">
          {student.grade}{" "}
          {student.className}{" "}
          {student.name}
        </div>
      </div>

      <div className="stickerGrid">
        {Array.from({
          length:
            STICKERS_PER_STUDENT,
        }).map(
          (_, index) => (
            <div
              className="sticker"
              key={index}
            >
              {student.qrDataUrl && (
                <img
                  className="stickerQr"
                  src={
                    student.qrDataUrl
                  }
                  alt=""
                />
              )}

              <div className="stickerText">
                <div className="stickerName">
                  {
                    student.name
                  }
                </div>

                <div className="stickerNumber">
                  {
                    student.id
                  }
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
