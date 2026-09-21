"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import QRCode from "qrcode";

import {
  auth,
  db,
} from "@/lib/firebase";

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type CurrentUser = {
  uid: string;
  organizationId: string | null;
  role: UserRole | null;
  schoolIds: string[];
};

type Test = {
  id: string;
  organizationId: string;
  schoolId: string;
  testId: string;
  name: string;
  subject: string;
  grade: string;
  className: string;
  examDate: string;
  totalScore: number;
  active: boolean;
};

export default function TestQRPage() {
  const searchParams =
    useSearchParams();

  const initialTestId =
    searchParams.get(
      "testId"
    );

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<CurrentUser | null>(
      null
    );

  const [
    tests,
    setTests,
  ] =
    useState<Test[]>([]);

  const [
    selectedTestId,
    setSelectedTestId,
  ] =
    useState(
      initialTestId ?? ""
    );

  const [
    qrDataUrl,
    setQrDataUrl,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    generating,
    setGenerating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  /*
   * ========================================================
   * 認証
   * ========================================================
   */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          if (!firebaseUser) {
            setLoading(false);

            setError(
              "ログイン状態を確認できません。"
            );

            return;
          }

          try {
            const snapshot =
              await getDocs(
                query(
                  collection(
                    db,
                    "users"
                  ),
                  where(
                    "__name__",
                    "==",
                    firebaseUser.uid
                  )
                )
              );

            if (
              snapshot.empty
            ) {
              setLoading(false);

              setError(
                "システムのユーザー情報が登録されていません。"
              );

              return;
            }

            const data =
              snapshot.docs[0].data();

            const role =
              isUserRole(
                data.role
              )
                ? data.role
                : null;

            setCurrentUser({
              uid:
                firebaseUser.uid,

              organizationId:
                typeof data.organizationId ===
                "string"
                  ? data.organizationId
                  : null,

              role,

              schoolIds:
                Array.isArray(
                  data.schoolIds
                )
                  ? data.schoolIds.filter(
                      (
                        value
                      ): value is string =>
                        typeof value ===
                        "string"
                    )
                  : [],
            });
          } catch (err) {
            console.error(
              "Test QR auth error:",
              err
            );

            setError(
              getSafeErrorMessage(
                err
              )
            );

            setLoading(false);
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /*
   * ========================================================
   * テスト取得
   * ========================================================
   */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadTests(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadTests(
    organizationId: string
  ) {
    try {
      setLoading(true);
      setError("");

      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              "tests"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            )
          )
        );

      const loadedTests =
        snapshot.docs
          .map(
            (
              item
            ): Test => {
              const data =
                item.data();

              return {
                id:
                  item.id,

                organizationId,

                schoolId:
                  typeof data.schoolId ===
                  "string"
                    ? data.schoolId
                    : "",

                testId:
                  typeof data.testId ===
                  "string"
                    ? data.testId
                    : "",

                name:
                  typeof data.name ===
                  "string"
                    ? data.name
                    : "",

                subject:
                  typeof data.subject ===
                  "string"
                    ? data.subject
                    : "",

                grade:
                  typeof data.grade ===
                  "string"
                    ? data.grade
                    : "",

                className:
                  typeof data.className ===
                  "string"
                    ? data.className
                    : "",

                examDate:
                  typeof data.examDate ===
                  "string"
                    ? data.examDate
                    : "",

                totalScore:
                  typeof data.totalScore ===
                  "number"
                    ? data.totalScore
                    : 0,

                active:
                  data.active !==
                  false,
              };
            }
          )
          .filter(
            (
              test
            ) =>
              test.active
          );

      setTests(
        loadedTests
      );

      /*
       * URLから指定されたテストIDが
       * 実在する場合だけ選択。
       */

      if (
        initialTestId &&
        loadedTests.some(
          (
            test
          ) =>
            test.testId ===
            initialTestId
        )
      ) {
        setSelectedTestId(
          initialTestId
        );
      }
    } catch (err) {
      console.error(
        "Test QR load error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ========================================================
   * 選択テスト
   * ========================================================
   */

  const selectedTest =
    tests.find(
      (
        test
      ) =>
        test.testId ===
        selectedTestId
    );

  /*
   * ========================================================
   * QR生成
   * ========================================================
   */

  async function generateQR() {
    if (
      !selectedTest
    ) {
      setError(
        "テストを選択してください。"
      );

      return;
    }

    try {
      setGenerating(true);

      setError("");
      setMessage("");

      /*
       * QRにはテストIDだけを入れる。
       */
      const dataUrl =
        await QRCode.toDataURL(
          selectedTest.testId,
          {
            errorCorrectionLevel:
              "M",

            margin:
              1,

            width:
              600,
          }
        );

      setQrDataUrl(
        dataUrl
      );

      setMessage(
        "テストID QRを作成しました。"
      );
    } catch (err) {
      console.error(
        "Test QR generation error:",
        err
      );

      setError(
        "テストID QRの生成に失敗しました。"
      );
    } finally {
      setGenerating(false);
    }
  }

  /*
   * ========================================================
   * 印刷
   * ========================================================
   */

  function printQR() {
    if (
      !qrDataUrl ||
      !selectedTest
    ) {
      setError(
        "先にテストID QRを作成してください。"
      );

      return;
    }

    setError("");

    window.print();
  }

  /*
   * ========================================================
   * 権限
   * ========================================================
   */

  if (
    currentUser &&
    currentUser.role !==
      "本部管理者" &&
    currentUser.role !==
      "校舎管理者" &&
    currentUser.role !==
      "講師"
  ) {
    return (
      <main
        style={
          pageStyle
        }
      >
        <section
          style={
            cardStyle
          }
        >
          <h1>
            テストID QR
          </h1>

          <p>
            この機能を利用する権限がありません。
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      style={
        pageStyle
      }
    >
      {/* ==================================================
          操作画面
          ================================================== */}

      <section className="noPrint">
        <div
          style={{
            maxWidth:
              900,

            margin:
              "0 auto",
          }}
        >
          <header
            style={{
              marginBottom:
                24,
            }}
          >
            <h1
              style={{
                margin:
                  "0 0 8px",
              }}
            >
              テストID QR
            </h1>

            <p
              style={{
                margin: 0,

                color:
                  "#666",

                lineHeight:
                  1.7,
              }}
            >
              既存答案用紙の上部・名前欄横などに配置するテスト識別用QRを作成します。
            </p>
          </header>

          {error && (
            <div
              style={
                errorStyle
              }
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={
                successStyle
              }
            >
              {message}
            </div>
          )}

          <section
            style={
              cardStyle
            }
          >
            <label
              style={
                labelStyle
              }
            >
              テスト

              <select
                value={
                  selectedTestId
                }
                onChange={(
                  event
                ) => {
                  setSelectedTestId(
                    event.target
                      .value
                  );

                  setQrDataUrl(
                    ""
                  );

                  setMessage(
                    ""
                  );
                }}
                style={
                  inputStyle
                }
              >
                <option value="">
                  テストを選択してください
                </option>

                {tests.map(
                  (
                    test
                  ) => (
                    <option
                      key={
                        test.id
                      }
                      value={
                        test.testId
                      }
                    >
                      {
                        test.testId
                      }
                      {" — "}
                      {
                        test.name
                      }
                      {" / "}
                      {
                        test.subject
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {selectedTest && (
              <div
                style={{
                  marginTop:
                    24,

                  padding:
                    18,

                  background:
                    "#f7f7f7",

                  borderRadius:
                    10,
                }}
              >
                <InfoRow
                  label="テストID"
                  value={
                    selectedTest.testId
                  }
                />

                <InfoRow
                  label="テスト名"
                  value={
                    selectedTest.name
                  }
                />

                <InfoRow
                  label="教科"
                  value={
                    selectedTest.subject
                  }
                />

                <InfoRow
                  label="学年"
                  value={
                    selectedTest.grade
                  }
                />

                <InfoRow
                  label="実施日"
                  value={
                    selectedTest.examDate ||
                    "未設定"
                  }
                />
              </div>
            )}

            <div
              style={{
                display:
                  "flex",

                gap:
                  10,

                marginTop:
                  24,

                flexWrap:
                  "wrap",
              }}
            >
              <button
                type="button"
                disabled={
                  generating ||
                  !selectedTest
                }
                onClick={
                  generateQR
                }
                style={
                  primaryButton
                }
              >
                {generating
                  ? "QR作成中..."
                  : "テストID QRを作成"}
              </button>

              <button
                type="button"
                disabled={
                  !qrDataUrl
                }
                onClick={
                  printQR
                }
                style={
                  secondaryButton
                }
              >
                印刷
              </button>
            </div>
          </section>

          {/* ==================================================
              注意事項
              ================================================== */}

          <section
            style={{
              ...cardStyle,

              marginTop:
                20,
            }}
          >
            <h2>
              使用方法
            </h2>

            <ol
              style={{
                margin:
                  "14px 0 0",

                paddingLeft:
                  22,

                lineHeight:
                  1.9,

                color:
                  "#555",
              }}
            >
              <li>
                テストを選択します。
              </li>

              <li>
                テストID QRを作成します。
              </li>

              <li>
                QRを印刷します。
              </li>

              <li>
                既存の答案用紙の上部・名前欄横など、システムで指定した位置に配置します。
              </li>

              <li>
                採点時にこのQRを読み取り、テストを特定します。
              </li>
            </ol>

            <p
              style={{
                marginTop:
                  16,

                color:
                  "#a00000",

                fontSize:
                  13,

                lineHeight:
                  1.7,
              }}
            >
              生徒用QRシールにはテストIDを入れません。
              生徒用QRには生徒番号だけを格納します。
            </p>
          </section>
        </div>
      </section>

      {/* ==================================================
          印刷
          ================================================== */}

      {selectedTest &&
        qrDataUrl && (
          <section
            className="printArea"
          >
            <div className="testQrPrint">
              <div className="testQrHeader">
                <strong>
                  {selectedTest.name}
                </strong>

                <span>
                  {
                    selectedTest.subject
                  }
                </span>
              </div>

              <div className="testQrContent">
                <img
                  src={
                    qrDataUrl
                  }
                  alt=""
                  className="testQrImage"
                />

                <div className="testQrText">
                  <div>
                    テストID
                  </div>

                  <strong>
                    {
                      selectedTest.testId
                    }
                  </strong>
                </div>
              </div>
            </div>
          </section>
        )}

      <style jsx global>{`
        .printArea {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .noPrint {
            display: none !important;
          }

          .printArea {
            display: block !important;
          }

          .testQrPrint {
            width: 80mm;
            min-height: 35mm;
            box-sizing: border-box;
            border: 0.3mm solid #000;
            padding: 4mm;
          }

          .testQrHeader {
            display: flex;
            justify-content: space-between;
            gap: 5mm;
            font-size: 10pt;
            margin-bottom: 3mm;
          }

          .testQrContent {
            display: flex;
            align-items: center;
            gap: 5mm;
          }

          .testQrImage {
            width: 25mm;
            height: 25mm;
            object-fit: contain;
          }

          .testQrText {
            display: flex;
            flex-direction: column;
            gap: 2mm;
            font-size: 10pt;
          }

          .testQrText strong {
            font-size: 14pt;
          }
        }
      `}</style>
    </main>
  );
}

/* =========================================================
   InfoRow
   ========================================================= */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display:
          "grid",

        gridTemplateColumns:
          "100px 1fr",

        gap:
          12,

        padding:
          "7px 0",

        borderBottom:
          "1px solid #e5e5e5",

        fontSize:
          14,
      }}
    >
      <strong>
        {label}
      </strong>

      <span>
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function isUserRole(
  value: unknown
): value is UserRole {
  return (
    value ===
      "本部管理者" ||
    value ===
      "校舎管理者" ||
    value ===
      "講師" ||
    value ===
      "生徒"
  );
}

function getSafeErrorMessage(
  error: unknown
) {
  const value =
    error as {
      code?: string;
    };

  switch (
    value?.code
  ) {
    case "permission-denied":
      return "この操作を行う権限がありません。";

    case "unauthenticated":
      return "ログイン状態を確認できません。";

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからお試しください。";

    default:
      return "テストID QRを取得できませんでした。";
  }
}

/* =========================================================
   Styles
   ========================================================= */

const pageStyle:
  React.CSSProperties = {
    minHeight:
      "100vh",

    padding:
      32,

    background:
      "#f5f6f8",
  };

const cardStyle:
  React.CSSProperties = {
    padding:
      24,

    background:
      "#fff",

    border:
      "1px solid #e1e4e8",

    borderRadius:
      12,
  };

const labelStyle:
  React.CSSProperties = {
    display:
      "block",

    fontWeight:
      600,
  };

const inputStyle:
  React.CSSProperties = {
    display:
      "block",

    width:
      "100%",

    marginTop:
      8,

    padding:
      "11px 12px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",
  };

const primaryButton:
  React.CSSProperties = {
    padding:
      "11px 20px",

    border:
      "none",

    borderRadius:
      7,

    background:
      "#111",

    color:
      "#fff",

    fontWeight:
      600,

    cursor:
      "pointer",
  };

const secondaryButton:
  React.CSSProperties = {
    padding:
      "11px 20px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",

    color:
      "#222",

    fontWeight:
      600,

    cursor:
      "pointer",
  };

const errorStyle:
  React.CSSProperties = {
    marginBottom:
      16,

    padding:
      14,

    border:
      "1px solid #efb5b5",

    borderRadius:
      8,

    background:
      "#fff4f4",

    color:
      "#9b1c1c",

    lineHeight:
      1.6,
  };

const successStyle:
  React.CSSProperties = {
    marginBottom:
      16,

    padding:
      14,

    border:
      "1px solid #b8d9c0",

    borderRadius:
      8,

    background:
      "#f2faf4",

    color:
      "#25633a",

    lineHeight:
      1.6,
  };
