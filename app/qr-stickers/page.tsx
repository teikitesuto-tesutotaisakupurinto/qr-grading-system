"use client";

import {
  useEffect,
  useMemo,
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

type School = {
  id: string;
  name: string;
  active: boolean;
};

type Student = {
  id: string;
  organizationId: string;
  schoolId: string;
  studentNumber: string;
  name: string;
  grade: string;
  className: string;
  active: boolean;
};

type StickerStudent = Student & {
  qrDataUrl: string;
};

export default function QRStickersPage() {
  const searchParams =
    useSearchParams();

  const initialStudentId =
    searchParams.get(
      "studentId"
    );

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<CurrentUser | null>(
      null
    );

  const [
    students,
    setStudents,
  ] =
    useState<Student[]>([]);

  const [
    schools,
    setSchools,
  ] =
    useState<School[]>([]);

  const [
    selectedStudentIds,
    setSelectedStudentIds,
  ] =
    useState<string[]>(
      initialStudentId
        ? [initialStudentId]
        : []
    );

  const [
    qrStudents,
    setQrStudents,
  ] =
    useState<StickerStudent[]>([]);

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
    search,
    setSearch,
  ] =
    useState("");

  const [
    selectedSchool,
    setSelectedSchool,
  ] =
    useState("");

  const [
    selectedClass,
    setSelectedClass,
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
              "QR sticker auth error:",
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
   * 生徒・校舎取得
   * ========================================================
   */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadData(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadData(
    organizationId: string
  ) {
    try {
      setLoading(true);
      setError("");

      const [
        studentSnapshot,
        schoolSnapshot,
      ] = await Promise.all([
        getDocs(
          query(
            collection(
              db,
              "students"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            )
          )
        ),

        getDocs(
          query(
            collection(
              db,
              "schools"
            ),
            where(
              "organizationId",
              "==",
              organizationId
            )
          )
        ),
      ]);

      const loadedStudents =
        studentSnapshot.docs.map(
          (
            item
          ): Student => {
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

              studentNumber:
                typeof data.studentNumber ===
                "string"
                  ? data.studentNumber
                  : "",

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : "",

              grade:
                typeof data.grade ===
                "string"
                  ? data.grade
                  : "未設定",

              className:
                typeof data.className ===
                "string"
                  ? data.className
                  : "",

              active:
                data.active !==
                false,
            };
          }
        );

      const loadedSchools =
        schoolSnapshot.docs.map(
          (
            item
          ): School => {
            const data =
              item.data();

            return {
              id:
                item.id,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : "",

              active:
                data.active !==
                false,
            };
          }
        );

      setStudents(
        loadedStudents
      );

      setSchools(
        loadedSchools
      );

      if (
        initialStudentId &&
        loadedStudents.some(
          (
            student
          ) =>
            student.id ===
            initialStudentId
        )
      ) {
        setSelectedStudentIds([
          initialStudentId,
        ]);
      }
    } catch (err) {
      console.error(
        "QR sticker data error:",
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
   * 利用可能校舎
   * ========================================================
   */

  const availableSchools =
    useMemo(() => {
      if (
        !currentUser
      ) {
        return [];
      }

      const activeSchools =
        schools.filter(
          (
            school
          ) =>
            school.active
        );

      if (
        currentUser.role ===
        "本部管理者"
      ) {
        return activeSchools;
      }

      return activeSchools.filter(
        (
          school
        ) =>
          currentUser.schoolIds.includes(
            school.id
          )
      );
    }, [
      schools,
      currentUser,
    ]);

  /*
   * ========================================================
   * クラス一覧
   * ========================================================
   */

  const classNames =
    useMemo(() => {
      return Array.from(
        new Set(
          students
            .map(
              (
                student
              ) =>
                student.className
            )
            .filter(
              Boolean
            )
        )
      ).sort();
    }, [
      students,
    ]);

  /*
   * ========================================================
   * 絞り込み
   * ========================================================
   */

  const filteredStudents =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return students.filter(
        (
          student
        ) => {
          if (
            !student.active
          ) {
            return false;
          }

          if (
            selectedSchool &&
            student.schoolId !==
              selectedSchool
          ) {
            return false;
          }

          if (
            selectedClass &&
            student.className !==
              selectedClass
          ) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          return (
            student.name
              .toLowerCase()
              .includes(
                keyword
              ) ||
            student.studentNumber.includes(
              keyword
            ) ||
            student.className
              .toLowerCase()
              .includes(
                keyword
              )
          );
        }
      );
    }, [
      students,
      search,
      selectedSchool,
      selectedClass,
    ]);

  /*
   * ========================================================
   * 生徒選択
   * ========================================================
   */

  function toggleStudent(
    studentId: string
  ) {
    setSelectedStudentIds(
      (
        current
      ) =>
        current.includes(
          studentId
        )
          ? current.filter(
              (
                id
              ) =>
                id !==
                studentId
            )
          : [
              ...current,
              studentId,
            ]
    );
  }

  function selectAllFiltered() {
    const ids =
      filteredStudents.map(
        (
          student
        ) =>
          student.id
      );

    setSelectedStudentIds(
      (
        current
      ) =>
        Array.from(
          new Set([
            ...current,
            ...ids,
          ])
        )
    );
  }

  function clearSelection() {
    setSelectedStudentIds(
      []
    );

    setQrStudents(
      []
    );
  }

  /*
   * ========================================================
   * QR生成
   * ========================================================
   */

  async function generateQRStickers() {
    if (
      selectedStudentIds.length ===
      0
    ) {
      setError(
        "QRシールを作成する生徒を1人以上選択してください。"
      );

      return;
    }

    try {
      setGenerating(true);
      setError("");

      const selected =
        selectedStudentIds
          .map(
            (
              id
            ) =>
              students.find(
                (
                  student
                ) =>
                  student.id ===
                  id
              )
          )
          .filter(
            (
              student
            ): student is Student =>
              Boolean(student)
          );

      const generated: StickerStudent[] =
        [];

      for (
        const student of selected
      ) {
        /*
         * QRには生徒番号だけを入れる。
         */
        const qrDataUrl =
          await QRCode.toDataURL(
            student.studentNumber,
            {
              errorCorrectionLevel:
                "M",

              margin:
                0,

              width:
                180,
            }
          );

        generated.push({
          ...student,
          qrDataUrl,
        });
      }

      setQrStudents(
        generated
      );

      /*
       * 印刷エリアへ移動。
       */
      window.setTimeout(
        () => {
          document
            .getElementById(
              "printArea"
            )
            ?.scrollIntoView({
              behavior:
                "smooth",
            });
        },
        100
      );
    } catch (err) {
      console.error(
        "QR generation error:",
        err
      );

      setError(
        "QRシールの生成に失敗しました。もう一度お試しください。"
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

  function printStickers() {
    if (
      qrStudents.length ===
      0
    ) {
      setError(
        "先にQRシールを作成してください。"
      );

      return;
    }

    setError("");

    window.print();
  }

  /*
   * ========================================================
   * 印刷用ページ
   * ========================================================
   */

  const printPages =
    [];

  for (
    let i = 0;
    i < qrStudents.length;
    i += 2
  ) {
    printPages.push(
      qrStudents.slice(
        i,
        i + 2
      )
    );
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
            QRシール
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

      <div className="noPrint">
        <div
          style={{
            maxWidth:
              1400,
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
              QRシール発行
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
              生徒番号だけをQRコードにして、生徒用QRシールを発行します。
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

          {/* ==================================================
              仕様
              ================================================== */}

          <section
            style={{
              ...cardStyle,
              marginBottom:
                20,
            }}
          >
            <h2
              style={{
                marginTop:
                  0,
              }}
            >
              シール仕様
            </h2>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap:
                  12,
              }}
            >
              <Spec
                label="シール"
                value="30mm × 20mm"
              />

              <Spec
                label="1人"
                value="18枚"
              />

              <Spec
                label="配置"
                value="横6 × 縦3"
              />

              <Spec
                label="A4"
                value="横向き・2人分"
              />

              <Spec
                label="QR内容"
                value="生徒番号のみ"
              />

              <Spec
                label="表示"
                value="氏名・生徒番号"
              />
            </div>
          </section>

          {/* ==================================================
              絞り込み
              ================================================== */}

          <section
            style={{
              ...cardStyle,
              marginBottom:
                20,
            }}
          >
            <h2
              style={{
                marginTop:
                  0,
              }}
            >
              生徒を選択
            </h2>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",
                gap:
                  12,
              }}
            >
              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="氏名・生徒番号・クラス"
                style={
                  inputStyle
                }
              />

              <select
                value={
                  selectedSchool
                }
                onChange={(
                  event
                ) =>
                  setSelectedSchool(
                    event.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="">
                  すべての校舎
                </option>

                {availableSchools.map(
                  (
                    school
                  ) => (
                    <option
                      key={
                        school.id
                      }
                      value={
                        school.id
                      }
                    >
                      {
                        school.name
                      }
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  selectedClass
                }
                onChange={(
                  event
                ) =>
                  setSelectedClass(
                    event.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="">
                  すべてのクラス
                </option>

                {classNames.map(
                  (
                    className
                  ) => (
                    <option
                      key={
                        className
                      }
                      value={
                        className
                      }
                    >
                      {
                        className
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              style={{
                display:
                  "flex",
                flexWrap:
                  "wrap",
                gap:
                  8,
                marginTop:
                  16,
              }}
            >
              <button
                type="button"
                onClick={
                  selectAllFiltered
                }
                style={
                  secondaryButton
                }
              >
                表示中をすべて選択
              </button>

              <button
                type="button"
                onClick={
                  clearSelection
                }
                style={
                  secondaryButton
                }
              >
                選択解除
              </button>

              <button
                type="button"
                disabled={
                  generating
                }
                onClick={
                  generateQRStickers
                }
                style={
                  primaryButton
                }
              >
                {generating
                  ? "QRを作成中..."
                  : "QRシールを作成"}
              </button>

              <button
                type="button"
                disabled={
                  qrStudents.length ===
                  0
                }
                onClick={
                  printStickers
                }
                style={
                  primaryButton
                }
              >
                印刷
              </button>
            </div>

            <p
              style={{
                margin:
                  "14px 0 0",
                color:
                  "#666",
                fontSize:
                  13,
              }}
            >
              選択：
              {
                selectedStudentIds.length
              }
              人
              {qrStudents.length >
                0 && (
                <>
                  {"　"}
                  QR生成済み：
                  {
                    qrStudents.length
                  }
                  人
                </>
              )}
            </p>
          </section>

          {/* ==================================================
              生徒一覧
              ================================================== */}

          <section
            style={
              cardStyle
            }
          >
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={
                  tableStyle
                }
              >
                <thead>
                  <tr>
                    <th
                      style={
                        thStyle
                      }
                    >
                      選択
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      生徒番号
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      氏名
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      学年
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      クラス
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      校舎
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map(
                    (
                      student
                    ) => (
                      <tr
                        key={
                          student.id
                        }
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(
                              student.id
                            )}
                            onChange={() =>
                              toggleStudent(
                                student.id
                              )
                            }
                          />
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            student.studentNumber
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            student.name
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            student.grade
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {student.className ||
                            "—"}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {getSchoolName(
                            student.schoolId,
                            schools
                          )}
                        </td>
                      </tr>
                    )
                  )}

                  {filteredStudents.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          6
                        }
                        style={{
                          ...tdStyle,
                          padding:
                            40,
                          textAlign:
                            "center",
                          color:
                            "#777",
                        }}
                      >
                        対象の生徒がありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* ==================================================
          印刷エリア
          ================================================== */}

      <div
        id="printArea"
        className="printArea"
      >
        {printPages.map(
          (
            pageStudents,
            pageIndex
          ) => (
            <section
              className="a4Page"
              key={
                pageIndex
              }
            >
              <div className="pageStudents">
                {pageStudents.map(
                  (
                    student
                  ) => {
                    const qr =
                      qrStudents.find(
                        (
                          item
                        ) =>
                          item.id ===
                          student.id
                      );

                    if (!qr) {
                      return null;
                    }

                    return (
                      <div
                        className="studentBlock"
                        key={
                          student.id
                        }
                      >
                        <div className="sheetHeader">
                          <div className="schoolLogo">
                            塾ロゴ
                          </div>

                          <div className="studentHeader">
                            <div>
                              {
                                student.className ||
                                student.grade
                              }
                            </div>

                            <div>
                              {
                                student.name
                              }
                            </div>
                          </div>
                        </div>

                        <div className="stickerGrid">
                          {Array.from(
                            {
                              length:
                                18,
                            },
                            (
                              _,
                              index
                            ) => (
                              <div
                                className="sticker"
                                key={
                                  `${student.id}-${index}`
                                }
                              >
                                <img
                                  src={
                                    qr.qrDataUrl
                                  }
                                  alt=""
                                  className="qrImage"
                                />

                                <div className="stickerText">
                                  <div className="stickerName">
                                    {
                                      student.name
                                    }
                                  </div>

                                  <div className="stickerNumber">
                                    {
                                      student.studentNumber
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
                )}
              </div>
            </section>
          )
        )}
      </div>

      <style jsx global>{`
        .printArea {
          display: none;
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
            background: #fff !important;
          }

          .noPrint {
            display: none !important;
          }

          .printArea {
            display: block !important;
          }

          .a4Page {
            width: 297mm;
            height: 210mm;
            box-sizing: border-box;
            padding: 7mm;
            page-break-after: always;
            background: #fff;
            overflow: hidden;
          }

          .a4Page:last-child {
            page-break-after: auto;
          }

          .pageStudents {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 8mm;
          }

          /*
           * 1人分
           *
           * A4横の中に2人分。
           */
          .studentBlock {
            width: 100%;
            height: 92mm;
            box-sizing: border-box;
            position: relative;
          }

          .studentBlock + .studentBlock {
            border-top: 0.25mm solid #ddd;
            padding-top: 4mm;
          }

          .sheetHeader {
            height: 13mm;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            box-sizing: border-box;
          }

          .schoolLogo {
            font-size: 10pt;
            font-weight: 700;
          }

          .studentHeader {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 1mm;
            font-size: 10pt;
            font-weight: 700;
          }

          /*
           * 6列 × 3行
           *
           * シールは必ず30mm × 20mm。
           */
          .stickerGrid {
            display: grid;
            grid-template-columns: repeat(6, 30mm);
            grid-template-rows: repeat(3, 20mm);
            column-gap: 4mm;
            row-gap: 4mm;
            justify-content: center;
            align-content: start;
          }

          .sticker {
            width: 30mm;
            height: 20mm;
            box-sizing: border-box;
            border: 0.25mm solid #000;
            display: flex;
            align-items: center;
            padding: 1.5mm;
            background: #fff;
            overflow: hidden;
          }

          .qrImage {
            width: 15mm;
            height: 15mm;
            object-fit: contain;
            display: block;
            flex-shrink: 0;
          }

          .stickerText {
            min-width: 0;
            flex: 1;
            margin-left: 1.5mm;
            overflow: hidden;
          }

          .stickerName {
            font-size: 6.5pt;
            font-weight: 700;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .stickerNumber {
            margin-top: 1mm;
            font-size: 6.5pt;
            line-height: 1.2;
            white-space: nowrap;
          }
        }
      `}</style>
    </main>
  );
}

/* =========================================================
   Spec
   ========================================================= */

function Spec({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          14,
        border:
          "1px solid #eee",
        borderRadius:
          8,
      }}
    >
      <div
        style={{
          color:
            "#777",
          fontSize:
            12,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display:
            "block",
          marginTop:
            5,
          fontSize:
            14,
        }}
      >
        {value}
      </strong>
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

function getSchoolName(
  schoolId: string,
  schools: School[]
) {
  return (
    schools.find(
      (
        school
      ) =>
        school.id ===
        schoolId
    )?.name ??
    "不明"
  );
}

function getSafeErrorMessage(
  error: unknown
): string {
  const firebaseError =
    error as {
      code?: string;
    };

  switch (
    firebaseError?.code
  ) {
    case "permission-denied":
      return "この操作を行う権限がありません。";

    case "unauthenticated":
      return "ログイン状態を確認できません。";

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからお試しください。";

    default:
      return "QRシールに必要なデータを取得できませんでした。";
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

const inputStyle:
  React.CSSProperties = {
    width:
      "100%",
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
      "10px 14px",
    border:
      "1px solid #ccc",
    borderRadius:
      7,
    background:
      "#fff",
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
  };

const tableStyle:
  React.CSSProperties = {
    width:
      "100%",
    borderCollapse:
      "collapse",
  };

const thStyle:
  React.CSSProperties = {
    padding:
      "11px 12px",
    textAlign:
      "left",
    borderBottom:
      "2px solid #ddd",
    whiteSpace:
      "nowrap",
  };

const tdStyle:
  React.CSSProperties = {
    padding:
      "12px",
    borderBottom:
      "1px solid #eee",
    fontSize:
      14,
    whiteSpace:
      "nowrap",
  };
