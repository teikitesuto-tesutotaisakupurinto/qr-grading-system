"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getAppUser,
} from "@/lib/auth";

import {
  getScopedDocs,
  studentsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  Student,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type StudentRow =
  Student & {
    schoolName: string;
  };

type CSVRow = {
  studentNumber: string;
  name: string;
  grade: string;
  className: string;
  schoolId: string;
  schoolName: string;
};

type ImportResult = {
  total: number;
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
};

/* =========================================================
   Page
   ========================================================= */

export default function StudentsPage() {
  const [
    role,
    setRole,
  ] = useState<UserRole | null>(
    null
  );

  const [
    students,
    setStudents,
  ] = useState<StudentRow[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    gradeFilter,
    setGradeFilter,
  ] = useState("");

  const [
    classFilter,
    setClassFilter,
  ] = useState("");

  const [
    csvPreview,
    setCsvPreview,
  ] = useState<CSVRow[]>(
    []
  );

  const [
    csvErrors,
    setCsvErrors,
  ] = useState<string[]>(
    []
  );

  const [
    importing,
    setImporting,
  ] = useState(false);

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  /* =======================================================
     Permission
     ======================================================= */

  const canManage =
    role ===
      "本部管理者" ||
    role ===
      "校舎管理者";

  /* =======================================================
     Load
     ======================================================= */

  useEffect(() => {
    void loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);

      setError("");

      const user =
        await getAppUser(
          auth.currentUser
        );

      if (!user) {
        throw new Error(
          "ログインしてください。"
        );
      }

      if (
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者"
      ) {
        throw new Error(
          "生徒管理を利用する権限がありません。"
        );
      }

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織が設定されていません。"
        );
      }

      setRole(
        user.role
      );

      const scopeUser:
        FirestoreUser = {
        uid:
          user.uid,

        organizationId:
          user.organizationId,

        role:
          user.role,

        schoolIds:
          user.schoolIds,

        studentId:
          user.studentId,
      };

      const documents =
        await getScopedDocs(
          studentsQueries(
            scopeUser
          )
        );

      const loaded =
        documents.map(
          (
            item
          ) =>
            normalizeStudent(
              item.id,
              item.data
            )
        );

      setStudents(
        loaded
      );
    } catch (
      error
    ) {
      console.error(
        "Student load error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "生徒情報を取得できませんでした。"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     Filters
     ======================================================= */

  const grades =
    useMemo(
      () =>
        Array.from(
          new Set(
            students.map(
              (
                student
              ) =>
                student.grade
            )
          )
        )
          .filter(
            Boolean
          )
          .sort(),
      [
        students,
      ]
    );

  const classes =
    useMemo(
      () =>
        Array.from(
          new Set(
            students
              .filter(
                (
                  student
                ) =>
                  !gradeFilter ||
                  student.grade ===
                    gradeFilter
              )
              .map(
                (
                  student
                ) =>
                  student.className
              )
          )
        )
          .filter(
            Boolean
          )
          .sort(),
      [
        students,
        gradeFilter,
      ]
    );

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
          const gradeMatch =
            !gradeFilter ||
            student.grade ===
              gradeFilter;

          const classMatch =
            !classFilter ||
            student.className ===
              classFilter;

          const searchMatch =
            !keyword ||
            student.name
              .toLowerCase()
              .includes(
                keyword
              ) ||
            student.studentNumber
              .toLowerCase()
              .includes(
                keyword
              );

          return (
            gradeMatch &&
            classMatch &&
            searchMatch
          );
        }
      );
    }, [
      students,
      search,
      gradeFilter,
      classFilter,
    ]);

  /* =======================================================
     CSV download
     ======================================================= */

  function downloadCSV() {
    if (
      students.length ===
      0
    ) {
      setError(
        "ダウンロードする生徒がありません。"
      );

      return;
    }

    const header = [
      "生徒番号",
      "氏名",
      "学年",
      "クラス",
      "校舎ID",
      "校舎名",
    ];

    const rows =
      students.map(
        (
          student
        ) => [
          student.studentNumber,
          student.name,
          student.grade,
          student.className,
          student.schoolId,
          student.schoolName,
        ]
      );

    const csv = [
      header,
      ...rows,
    ]
      .map(
        (
          row
        ) =>
          row
            .map(
              (
                value
              ) =>
                csvEscape(
                  value
                )
            )
            .join(",")
      )
      .join("\r\n");

    const blob =
      new Blob(
        [
          "\uFEFF" +
            csv,
        ],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    anchor.download =
      `生徒一覧_${formatDate(
        new Date()
      )}.csv`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url
    );
  }

  /* =======================================================
     CSV select
     ======================================================= */

  function handleCSVChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (
      !file
    ) {
      return;
    }

    void parseCSV(
      file
    );
  }

  /* =======================================================
     Parse CSV
     ======================================================= */

  async function parseCSV(
    file: File
  ) {
    try {
      setCsvPreview([]);

      setCsvErrors([]);

      setError("");

      setMessage("");

      const text =
        await file.text();

      const rows =
        parseCSVText(
          text
        );

      const resultRows:
        CSVRow[] = [];

      const errors:
        string[] = [];

      rows.forEach(
        (
          row,
          index
        ) => {
          const rowNumber =
            index + 2;

          const studentNumber =
            clean(
              row[
                "生徒番号"
              ] ??
                row[
                  "studentNumber"
                ] ??
                ""
            );

          const name =
            clean(
              row[
                "氏名"
              ] ??
                row[
                  "name"
                ] ??
                ""
            );

          const grade =
            clean(
              row[
                "学年"
              ] ??
                row[
                  "grade"
                ] ??
                ""
            );

          const className =
            clean(
              row[
                "クラス"
              ] ??
                row[
                  "className"
                ] ??
                ""
            );

          const schoolId =
            clean(
              row[
                "校舎ID"
              ] ??
                row[
                  "schoolId"
                ] ??
                ""
            );

          const schoolName =
            clean(
              row[
                "校舎名"
              ] ??
                row[
                  "schoolName"
                ] ??
                ""
            );

          if (
            !studentNumber
          ) {
            errors.push(
              `${rowNumber}行目：生徒番号がありません。`
            );

            return;
          }

          if (
            !/^\d{6}$/.test(
              studentNumber
            )
          ) {
            errors.push(
              `${rowNumber}行目：生徒番号は6桁で入力してください。`
            );

            return;
          }

          if (
            !name
          ) {
            errors.push(
              `${rowNumber}行目：氏名がありません。`
            );

            return;
          }

          if (
            !grade
          ) {
            errors.push(
              `${rowNumber}行目：学年がありません。`
            );

            return;
          }

          if (
            !className
          ) {
            errors.push(
              `${rowNumber}行目：クラスがありません。`
            );

            return;
          }

          resultRows.push({
            studentNumber,
            name,
            grade,
            className,
            schoolId,
            schoolName,
          });
        }
      );

      /*
       * CSV内の生徒番号重複を確認。
       */
      const numbers =
        new Set<string>();

      const duplicates:
        string[] = [];

      for (
        const row of
          resultRows
      ) {
        if (
          numbers.has(
            row.studentNumber
          )
        ) {
          duplicates.push(
            `生徒番号 ${row.studentNumber} がCSV内で重複しています。`
          );
        }

        numbers.add(
          row.studentNumber
        );
      }

      errors.push(
        ...duplicates
      );

      setCsvPreview(
        resultRows
      );

      setCsvErrors(
        errors
      );
    } catch (
      error
    ) {
      console.error(
        "CSV parse error:",
        error
      );

      setError(
        "CSVを読み込めませんでした。"
      );
    }
  }

  /* =======================================================
     CSV import
     ======================================================= */

  async function importCSV() {
    if (
      importing
    ) {
      return;
    }

    if (
      csvPreview.length ===
      0
    ) {
      setError(
        "登録するCSVデータがありません。"
      );

      return;
    }

    if (
      csvErrors.length >
      0
    ) {
      setError(
        "CSVのエラーを修正してから登録してください。"
      );

      return;
    }

    try {
      setImporting(
        true
      );

      setError("");

      setMessage("");

      const user =
        await getAppUser();

      if (
        !user
      ) {
        throw new Error(
          "ログインしてください。"
        );
      }

      if (
        user.role !==
          "本部管理者" &&
        user.role !==
          "校舎管理者"
      ) {
        throw new Error(
          "生徒を登録・更新する権限がありません。"
        );
      }

      if (
        !user.organizationId
      ) {
        throw new Error(
          "所属組織がありません。"
        );
      }

      /*
       * 既存生徒を生徒番号で取得。
       *
       * ここが重要。
       *
       * studentNumberが同じなら
       * 新規studentIdを作らない。
       */
      const existingSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "students"
            ),

            where(
              "organizationId",
              "==",
              user.organizationId
            )
          )
        );

      const existing =
        new Map<
          string,
          {
            id: string;
            data: Record<
              string,
              unknown
            >;
          }
        >();

      existingSnapshot.docs.forEach(
        (
          item
        ) => {
          const data =
            item.data();

          const number =
            stringValue(
              data.studentNumber
            );

          if (
            number
          ) {
            existing.set(
              number,
              {
                id:
                  item.id,

                data,
              }
            );
          }
        }
      );

      const result:
        ImportResult = {
        total:
          csvPreview.length,

        added:
          0,

        updated:
          0,

        unchanged:
          0,

        errors: [],
      };

      /*
       * Firestore batchは500件以下。
       */
      const chunks =
        chunk(
          csvPreview,
          400
        );

      for (
        const currentChunk of
          chunks
      ) {
        const batch =
          writeBatch(
            db
          );

        for (
          const row of
            currentChunk
        ) {
          /*
           * 校舎管理者は所属校舎以外を
           * CSVから変更できない。
           */
          if (
            user.role ===
              "校舎管理者" &&
            row.schoolId &&
            !user.schoolIds.includes(
              row.schoolId
            )
          ) {
            result.errors.push(
              `生徒番号 ${row.studentNumber}：所属していない校舎です。`
            );

            continue;
          }

          const current =
            existing.get(
              row.studentNumber
            );

          if (
            current
          ) {
            const currentData =
              current.data;

            const changed =
              hasStudentChanged(
                currentData,
                row
              );

            if (
              !changed
            ) {
              result.unchanged +=
                1;

              continue;
            }

            /*
             * 既存studentIdをそのまま使用。
             */
            batch.update(
              doc(
                db,
                "students",
                current.id
              ),
              {
                name:
                  row.name,

                grade:
                  row.grade,

                className:
                  row.className,

                ...(row.schoolId
                  ? {
                      schoolId:
                        row.schoolId,
                    }
                  : {}),

                updatedAt:
                  serverTimestamp(),
              }
            );

            /*
             * 変更履歴。
             */
            const historyRef =
              doc(
                collection(
                  db,
                  "studentHistory"
                )
              );

            batch.set(
              historyRef,
              {
                organizationId:
                  user.organizationId,

                studentId:
                  current.id,

                studentNumber:
                  row.studentNumber,

                previousName:
                  stringValue(
                    currentData.name
                  ),

                previousGrade:
                  stringValue(
                    currentData.grade
                  ),

                previousClassName:
                  stringValue(
                    currentData.className
                  ),

                previousSchoolId:
                  stringValue(
                    currentData.schoolId
                  ),

                newName:
                  row.name,

                newGrade:
                  row.grade,

                newClassName:
                  row.className,

                newSchoolId:
                  row.schoolId ||
                  stringValue(
                    currentData.schoolId
                  ),

                changeType:
                  "CSV更新",

                changedBy:
                  user.uid,

                changedAt:
                  serverTimestamp(),
              }
            );

            result.updated +=
              1;
          } else {
            /*
             * 新規生徒。
             */
            const studentRef =
              doc(
                collection(
                  db,
                  "students"
                )
              );

            batch.set(
              studentRef,
              {
                organizationId:
                  user.organizationId,

                studentNumber:
                  row.studentNumber,

                name:
                  row.name,

                grade:
                  row.grade,

                className:
                  row.className,

                schoolId:
                  row.schoolId,

                active:
                  true,

                createdAt:
                  serverTimestamp(),

                updatedAt:
                  serverTimestamp(),
              }
            );

            /*
             * 新規登録履歴。
             */
            const historyRef =
              doc(
                collection(
                  db,
                  "studentHistory"
                )
              );

            batch.set(
              historyRef,
              {
                organizationId:
                  user.organizationId,

                studentId:
                  studentRef.id,

                studentNumber:
                  row.studentNumber,

                previousName:
                  "",

                previousGrade:
                  "",

                previousClassName:
                  "",

                previousSchoolId:
                  "",

                newName:
                  row.name,

                newGrade:
                  row.grade,

                newClassName:
                  row.className,

                newSchoolId:
                  row.schoolId,

                changeType:
                  "新規登録",

                changedBy:
                  user.uid,

                changedAt:
                  serverTimestamp(),
              }
            );

            result.added +=
              1;
          }
        }

        await batch.commit();
      }

      setMessage(
        [
          `登録 ${result.added}件`,
          `更新 ${result.updated}件`,
          `変更なし ${result.unchanged}件`,
        ].join(
          " / "
        )
      );

      if (
        result.errors.length >
        0
      ) {
        setCsvErrors(
          result.errors
        );
      }

      setCsvPreview([]);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }

      await loadStudents();
    } catch (
      error
    ) {
      console.error(
        "Student CSV import error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "CSV登録に失敗しました。"
      );
    } finally {
      setImporting(
        false
      );
    }
  }

  /* =======================================================
     Loading
     ======================================================= */

  if (
    loading
  ) {
    return (
      <main className="page">
        <section className="content">
          <h1>
            生徒管理
          </h1>

          <p>
            生徒情報を読み込んでいます...
          </p>
        </section>
      </main>
    );
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <main className="page">
      <section className="content">

        <header className="pageHeader">
          <div>
            <h1>
              生徒管理
            </h1>

            <p className="muted">
              生徒番号を基準に生徒情報を管理します。
            </p>
          </div>

          <div
            style={{
              display:
                "flex",

              gap:
                8,
            }}
          >
            {canManage && (
              <button
                type="button"
                className="button"
                onClick={
                  downloadCSV
                }
              >
                現在の生徒をCSVダウンロード
              </button>
            )}
          </div>
        </header>

        {error && (
          <div
            className="errorMessage"
            role="alert"
          >
            {
              error
            }
          </div>
        )}

        {message && (
          <div
            className="successMessage"
            role="status"
          >
            {
              message
            }
          </div>
        )}

        {/* ==================================================
            CSV
            ================================================== */}

        {canManage && (
          <section className="card">
            <h2>
              生徒CSV一括登録・更新
            </h2>

            <p
              className="muted"
              style={{
                fontSize:
                  12,
              }}
            >
              現在の生徒一覧をダウンロードし、行を追加・変更して再アップロードできます。生徒番号が同じ生徒は新規登録せず、既存の生徒情報を更新します。
            </p>

            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  10,

                flexWrap:
                  "wrap",

                marginTop:
                  14,
              }}
            >
              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept=".csv,text/csv"
                onChange={
                  handleCSVChange
                }
              />

              <button
                type="button"
                className="button primary"
                disabled={
                  importing ||
                  csvPreview.length ===
                    0 ||
                  csvErrors.length >
                    0
                }
                onClick={
                  importCSV
                }
              >
                {importing
                  ? "登録中..."
                  : "CSVを登録・更新"}
              </button>
            </div>

            {csvPreview.length >
              0 && (
              <div
                style={{
                  marginTop:
                    14,
                }}
              >
                <strong>
                  プレビュー：
                  {
                    csvPreview.length
                  }
                  件
                </strong>

                {csvErrors.length >
                  0 && (
                  <div
                    className="errorMessage"
                    style={{
                      marginTop:
                        10,
                    }}
                  >
                    {csvErrors.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                        >
                          {
                            item
                          }
                        </div>
                      )
                    )}
                  </div>
                )}

                {csvErrors.length ===
                  0 && (
                  <div
                    style={{
                      marginTop:
                        10,

                      overflowX:
                        "auto",
                    }}
                  >
                    <table className="dataTable">
                      <thead>
                        <tr>
                          <th>
                            生徒番号
                          </th>

                          <th>
                            氏名
                          </th>

                          <th>
                            学年
                          </th>

                          <th>
                            クラス
                          </th>

                          <th>
                            校舎
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {csvPreview
                          .slice(
                            0,
                            20
                          )
                          .map(
                            (
                              row,
                              index
                            ) => (
                              <tr
                                key={
                                  `${row.studentNumber}-${index}`
                                }
                              >
                                <td>
                                  {
                                    row.studentNumber
                                  }
                                </td>

                                <td>
                                  {
                                    row.name
                                  }
                                </td>

                                <td>
                                  {
                                    row.grade
                                  }
                                </td>

                                <td>
                                  {
                                    row.className
                                  }
                                </td>

                                <td>
                                  {
                                    row.schoolName ||
                                    row.schoolId
                                  }
                                </td>
                              </tr>
                            )
                          )}
                      </tbody>
                    </table>

                    {csvPreview.length >
                      20 && (
                      <p
                        className="muted"
                        style={{
                          fontSize:
                            11,
                        }}
                      >
                        先頭20件のみ表示しています。登録時にはCSV全件を処理します。
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ==================================================
            Summary
            ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",

            gap:
              12,

            marginTop:
              18,

            marginBottom:
              18,
          }}
        >
          <SummaryCard
            label="生徒数"
            value={
              students.length
            }
          />

          <SummaryCard
            label="表示件数"
            value={
              filteredStudents.length
            }
          />

          <SummaryCard
            label="学年数"
            value={
              grades.length
            }
          />
        </div>

        {/* ==================================================
            Filters
            ================================================== */}

        <section className="card">
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 200px 200px",

              gap:
                10,
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
              placeholder="生徒番号・氏名で検索"
            />

            <select
              value={
                gradeFilter
              }
              onChange={(
                event
              ) => {
                setGradeFilter(
                  event.target
                    .value
                );

                setClassFilter(
                  ""
                );
              }}
            >
              <option value="">
                全学年
              </option>

              {grades.map(
                (
                  grade
                ) => (
                  <option
                    key={
                      grade
                    }
                    value={
                      grade
                    }
                  >
                    {
                      grade
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                classFilter
              }
              onChange={(
                event
              ) =>
                setClassFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                全クラス
              </option>

              {classes.map(
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
        </section>

        {/* ==================================================
            Student list
            ================================================== */}

        <section
          className="card"
          style={{
            marginTop:
              16,
          }}
        >
          {filteredStudents.length ===
          0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>
                      生徒番号
                    </th>

                    <th>
                      氏名
                    </th>

                    <th>
                      学年
                    </th>

                    <th>
                      クラス
                    </th>

                    <th>
                      校舎
                    </th>

                    <th>
                      状態
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
                        <td>
                          <strong>
                            {
                              student.studentNumber
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            student.name
                          }
                        </td>

                        <td>
                          {
                            student.grade
                          }
                        </td>

                        <td>
                          {
                            student.className
                          }
                        </td>

                        <td>
                          {
                            student.schoolName ||
                            student.schoolId
                          }
                        </td>

                        <td>
                          <span
                            style={{
                              padding:
                                "4px 8px",

                              borderRadius:
                                999,

                              background:
                                student.active
                                  ? "#e8f5e9"
                                  : "#eee",

                              fontSize:
                                11,
                            }}
                          >
                            {student.active
                              ? "在籍"
                              : "停止"}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Normalize
   ========================================================= */

function normalizeStudent(
  id: string,
  data: Record<
    string,
    unknown
  >
): StudentRow {
  return {
    id,

    organizationId:
      stringValue(
        data.organizationId
      ),

    studentNumber:
      stringValue(
        data.studentNumber
      ),

    name:
      stringValue(
        data.name
      ),

    grade:
      stringValue(
        data.grade
      ),

    className:
      stringValue(
        data.className
      ),

    schoolId:
      stringValue(
        data.schoolId
      ),

    active:
      data.active !==
      false,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    schoolName:
      stringValue(
        data.schoolName
      ),
  };
}

/* =========================================================
   Compare
   ========================================================= */

function hasStudentChanged(
  current: Record<
    string,
    unknown
  >,
  next: CSVRow
) {
  return (
    stringValue(
      current.name
    ) !==
      next.name ||
    stringValue(
      current.grade
    ) !==
      next.grade ||
    stringValue(
      current.className
    ) !==
      next.className ||
    (
      next.schoolId &&
      stringValue(
        current.schoolId
      ) !==
        next.schoolId
    )
  );
}

/* =========================================================
   CSV parser
   ========================================================= */

function parseCSVText(
  text: string
) {
  const rows: string[][] =
    [];

  let row: string[] =
    [];

  let cell = "";

  let quoted = false;

  for (
    let index = 0;
    index <
    text.length;
    index +=
      1
  ) {
    const char =
      text[index];

    const next =
      text[index + 1];

    if (
      char ===
      '"'
    ) {
      if (
        quoted &&
        next ===
          '"'
      ) {
        cell +=
          '"';

        index +=
          1;

        continue;
      }

      quoted =
        !quoted;

      continue;
    }

    if (
      char ===
        "," &&
      !quoted
    ) {
      row.push(
        cell
      );

      cell =
        "";

      continue;
    }

    if (
      (
        char ===
          "\n" ||
        char ===
          "\r"
      ) &&
      !quoted
    ) {
      if (
        char ===
          "\r" &&
        next ===
          "\n"
      ) {
        index +=
          1;
      }

      row.push(
        cell
      );

      rows.push(
        row
      );

      row =
        [];

      cell =
        "";

      continue;
    }

    cell +=
      char;
  }

  if (
    cell.length >
      0 ||
    row.length >
      0
  ) {
    row.push(
      cell
    );

    rows.push(
      row
    );
  }

  if (
    rows.length ===
    0
  ) {
    return [];
  }

  const headers =
    rows[0].map(
      (
        header
      ) =>
        clean(
          header
        )
    );

  return rows
    .slice(1)
    .filter(
      (
        row
      ) =>
        row.some(
          (
            value
          ) =>
            clean(
              value
            )
        )
    )
    .map(
      (
        row
      ) => {
        const result:
          Record<
            string,
            string
          > = {};

        headers.forEach(
          (
            header,
            index
          ) => {
            result[
              header
            ] =
              clean(
                row[
                  index
                ] ??
                  ""
              );
          }
        );

        return result;
      }
    );
}

/* =========================================================
   CSV escape
   ========================================================= */

function csvEscape(
  value: string
) {
  const normalized =
    String(
      value ??
        ""
    );

  if (
    /[",\r\n]/.test(
      normalized
    )
  ) {
    return `"${normalized.replace(
      /"/g,
      '""'
    )}"`;
  }

  return normalized;
}

/* =========================================================
   Chunk
   ========================================================= */

function chunk<T>(
  values: T[],
  size: number
) {
  const result:
    T[][] =
    [];

  for (
    let index = 0;
    index <
    values.length;
    index +=
      size
  ) {
    result.push(
      values.slice(
        index,
        index +
          size
      )
    );
  }

  return result;
}

/* =========================================================
   Summary
   ========================================================= */

function SummaryCard({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <div className="card">
      <div
        className="muted"
        style={{
          fontSize:
            11,
        }}
      >
        {
          label
        }
      </div>

      <strong
        style={{
          display:
            "block",

          marginTop:
            4,

          fontSize:
            24,
        }}
      >
        {
          value
        }
      </strong>
    </div>
  );
}

/* =========================================================
   Empty
   ========================================================= */

function EmptyState() {
  return (
    <div
      style={{
        padding:
          60,

        textAlign:
          "center",

        color:
          "#777",
      }}
    >
      <strong>
        生徒がありません。
      </strong>

      <p
        style={{
          fontSize:
            12,
        }}
      >
        CSVから生徒を登録すると、ここに表示されます。
      </p>
    </div>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function clean(
  value: string
) {
  return value
    .replace(
      /^\uFEFF/,
      ""
    )
    .trim();
}

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}

function formatDate(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}${month}${day}`;
}
