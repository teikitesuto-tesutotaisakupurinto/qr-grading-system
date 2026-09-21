"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getScopedDocs,
  studentsQueries,
  type FirestoreUser,
} from "@/lib/firestore-scope";

import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

type CurrentUser =
  FirestoreUser & {
    name: string;
  };

type Student = {
  id: string;

  organizationId: string;

  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  schoolId: string;

  active: boolean;
};

type School = {
  id: string;

  organizationId: string;

  name: string;

  active: boolean;
};

type CSVRow = {
  rowNumber: number;

  studentId: string;

  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  schoolName: string;

  schoolId: string;

  error: string;

  isNew: boolean;

  isUpdate: boolean;

  isUnchanged: boolean;
};

type ImportSummary = {
  newCount: number;

  updateCount: number;

  unchangedCount: number;

  errorCount: number;
};

/* =========================================================
   Constants
   ========================================================= */

const CSV_HEADERS = [
  "生徒番号",
  "氏名",
  "学年",
  "クラス",
  "校舎",
];

const MAX_CSV_ROWS =
  5000;

/* =========================================================
   Page
   ========================================================= */

export default function StudentsPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(
    null
  );

  const [
    students,
    setStudents,
  ] = useState<Student[]>([]);

  const [
    schools,
    setSchools,
  ] = useState<School[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    importing,
    setImporting,
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
    csvRows,
    setCsvRows,
  ] = useState<CSVRow[]>([]);

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    previewReady,
    setPreviewReady,
  ] = useState(false);

  /* =======================================================
     Authentication
     ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (
            !firebaseUser
          ) {
            setCurrentUser(
              null
            );

            setLoading(
              false
            );

            setError(
              "ログイン状態を確認できません。"
            );

            return;
          }

          try {
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  firebaseUser.uid
                )
              );

            if (
              !snapshot.exists()
            ) {
              setCurrentUser(
                null
              );

              setError(
                "システムのユーザー情報が登録されていません。"
              );

              setLoading(
                false
              );

              return;
            }

            const data =
              snapshot.data();

            const role =
              isUserRole(
                data.role
              )
                ? data.role
                : null;

            const organizationId =
              typeof data.organizationId ===
              "string"
                ? data.organizationId
                : null;

            const schoolIds =
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
                : [];

            setCurrentUser({
              uid:
                firebaseUser.uid,

              organizationId,

              role,

              schoolIds,

              studentId:
                typeof data.studentId ===
                "string"
                  ? data.studentId
                  : null,

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : firebaseUser.displayName ??
                    "",
            });
          } catch (
            err
          ) {
            console.error(
              "User loading error:",
              err
            );

            setError(
              getSafeErrorMessage(
                err
              )
            );
          } finally {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================================
     Permission
     ======================================================= */

  const canManage =
    currentUser?.role ===
      "本部管理者" ||
    currentUser?.role ===
      "校舎管理者";

  /* =======================================================
     Data loading
     ======================================================= */

  useEffect(() => {
    if (
      !currentUser ||
      !currentUser.organizationId
    ) {
      return;
    }

    void loadData(
      currentUser
    );
  }, [
    currentUser,
  ]);

  async function loadData(
    user: CurrentUser
  ) {
    if (
      !user.organizationId
    ) {
      return;
    }

    try {
      setLoading(
        true
      );

      setError("");

      /*
       * -----------------------------------------------------
       * 生徒
       * -----------------------------------------------------
       *
       * 本部:
       *   organization全体
       *
       * 校舎管理者:
       *   schoolIds
       *
       * 講師:
       *   schoolIds
       *
       * 生徒:
       *   自分のみ
       */
      const studentQueries =
        studentsQueries(
          user
        );

      const studentData =
        await getScopedDocs(
          studentQueries
        );

      const loadedStudents =
        studentData
          .map(
            (
              data,
              index
            ): Student => {
              /*
               * getScopedDocsは
               * DocumentDataだけ返すため、
               * studentIdとしてdocument IDを
               * 保持する必要がある。
               *
               * 現在のscope実装ではIDが返らないため、
               * この部分はstudentNumberを一意キーとして
               * 利用する。
               */
              return {
                id:
                  stringValue(
                    data.id
                  ) ||
                  stringValue(
                    data.studentId
                  ) ||
                  `student-${index}`,

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
              };
            }
          )
          .filter(
            (
              student
            ) =>
              student.organizationId ===
                user.organizationId &&
              student.studentNumber
          );

      /*
       * -----------------------------------------------------
       * Schools
       * -----------------------------------------------------
       *
       * 生徒CSVの校舎名照合に必要。
       *
       * schoolsの取得は
       * 権限ごとに範囲を制限。
       */
      const schoolData =
        await loadAccessibleSchools(
          user
        );

      setStudents(
        loadedStudents
      );

      setSchools(
        schoolData
      );
    } catch (
      err
    ) {
      console.error(
        "Student loading error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /* =======================================================
     Accessible schools
     ======================================================= */

  async function loadAccessibleSchools(
    user: CurrentUser
  ): Promise<School[]> {
    if (
      !user.organizationId
    ) {
      return [];
    }

    /*
     * schoolsは本部管理者なら
     * organization全体。
     *
     * 校舎管理者・講師なら
     * 自校舎のみ。
     *
     * ただし学校数が10を超えるため、
     * firestore-scopeのschoolQueriesを
     * 利用する。
     */

    const {
      schoolsQueries,
    } =
      await import(
        "@/lib/firestore-scope"
      );

    const queries =
      schoolsQueries(
        user
      );

    const data =
      await getScopedDocs(
        queries
      );

    return data
      .map(
        (
          item,
          index
        ): School => ({
          id:
            stringValue(
              item.id
            ) ||
            stringValue(
              item.schoolId
            ) ||
            `school-${index}`,

          organizationId:
            stringValue(
              item.organizationId
            ),

          name:
            stringValue(
              item.name
            ),

          active:
            item.active !==
            false,
        })
      )
      .filter(
        (
          school
        ) =>
          school.organizationId ===
          user.organizationId &&
          school.active
      );
  }

  /* =======================================================
     Visible students
     ======================================================= */

  const filteredStudents =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (
        !keyword
      ) {
        return students;
      }

      return students.filter(
        (
          student
        ) => {
          const school =
            schools.find(
              (
                item
              ) =>
                item.id ===
                student.schoolId
            );

          return (
            student.studentNumber.includes(
              keyword
            ) ||
            student.name
              .toLowerCase()
              .includes(
                keyword
              ) ||
            student.grade
              .toLowerCase()
              .includes(
                keyword
              ) ||
            student.className
              .toLowerCase()
              .includes(
                keyword
              ) ||
            (
              school?.name ??
              ""
            )
              .toLowerCase()
              .includes(
                keyword
              )
          );
        }
      );
    }, [
      students,
      schools,
      search,
    ]);

  /* =======================================================
     CSV download
     ======================================================= */

  function downloadCurrentStudentsCSV() {
    if (
      students.length ===
      0
    ) {
      setError(
        "ダウンロードする生徒データがありません。"
      );

      return;
    }

    const rows =
      students.map(
        (
          student
        ) => {
          const school =
            schools.find(
              (
                item
              ) =>
                item.id ===
                student.schoolId
            );

          return [
            student.studentNumber,
            student.name,
            student.grade,
            student.className,
            school?.name ??
              "",
          ];
        }
      );

    const csv =
      "\uFEFF" +
      [
        CSV_HEADERS,
        ...rows,
      ]
        .map(
          (
            row
          ) =>
            row
              .map(
                csvEscape
              )
              .join(",")
        )
        .join(
          "\r\n"
        );

    downloadTextFile(
      csv,
      "生徒一覧.csv",
      "text/csv;charset=utf-8;"
    );

    setMessage(
      "現在の生徒一覧をCSVでダウンロードしました。"
    );
  }

  /* =======================================================
     CSV upload
     ======================================================= */

  async function handleCSVFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setError("");
    setMessage("");

    const file =
      event.target.files?.[0];

    if (
      !file
    ) {
      return;
    }

    setFileName(
      file.name
    );

    setPreviewReady(
      false
    );

    setCsvRows(
      []
    );

    try {
      if (
        !file.name
          .toLowerCase()
          .endsWith(
            ".csv"
          )
      ) {
        throw new Error(
          "CSVファイルを選択してください。"
        );
      }

      const text =
        await file.text();

      const parsed =
        parseCSV(
          text
        );

      if (
        parsed.length ===
        0
      ) {
        throw new Error(
          "CSVにデータがありません。"
        );
      }

      if (
        parsed.length >
        MAX_CSV_ROWS
      ) {
        throw new Error(
          `一度に登録できるのは${MAX_CSV_ROWS}行までです。`
        );
      }

      const rows =
        buildPreviewRows(
          parsed
        );

      setCsvRows(
        rows
      );

      setPreviewReady(
        true
      );
    } catch (
      err
    ) {
      console.error(
        "CSV parse error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "CSVを読み込めませんでした。"
      );
    }

    event.target.value =
      "";
  }

  /* =======================================================
     Preview rows
     ======================================================= */

  function buildPreviewRows(
    parsed: string[][]
  ): CSVRow[] {
    const rows: CSVRow[] =
      [];

    const first =
      parsed[0] ?? [];

    const hasHeader =
      looksLikeHeader(
        first
      );

    const dataRows =
      hasHeader
        ? parsed.slice(1)
        : parsed;

    const seenNumbers =
      new Set<string>();

    const seenNewKeys =
      new Set<string>();

    for (
      let i = 0;
      i < dataRows.length;
      i++
    ) {
      const source =
        dataRows[i];

      const rowNumber =
        hasHeader
          ? i + 2
          : i + 1;

      /*
       * CSV:
       *
       * 生徒番号
       * 氏名
       * 学年
       * クラス
       * 校舎
       */

      const studentNumber =
        normalizeStudentNumber(
          source[0] ?? ""
        );

      const name =
        cleanCSVValue(
          source[1] ?? ""
        );

      const grade =
        cleanCSVValue(
          source[2] ?? ""
        );

      const className =
        cleanCSVValue(
          source[3] ?? ""
        );

      const schoolName =
        cleanCSVValue(
          source[4] ?? ""
        );

      let studentId =
        "";

      let schoolId =
        "";

      let errorText =
        "";

      let isNew =
        false;

      let isUpdate =
        false;

      let isUnchanged =
        false;

      /*
       * 完全空行。
       */
      if (
        !studentNumber &&
        !name &&
        !grade &&
        !className &&
        !schoolName
      ) {
        continue;
      }

      /*
       * 氏名
       */
      if (
        !name
      ) {
        errorText =
          "氏名がありません。";
      }

      /*
       * 生徒番号
       *
       * 空欄 → 新規
       * 6桁 → 既存
       */
      if (
        !errorText &&
        studentNumber &&
        !/^\d{6}$/.test(
          studentNumber
        )
      ) {
        errorText =
          "生徒番号は6桁の数字で入力してください。";
      }

      /*
       * CSV内重複
       */
      if (
        !errorText &&
        studentNumber
      ) {
        if (
          seenNumbers.has(
            studentNumber
          )
        ) {
          errorText =
            "CSV内で同じ生徒番号が重複しています。";
        } else {
          seenNumbers.add(
            studentNumber
          );
        }
      }

      /*
       * 校舎
       */
      if (
        !errorText
      ) {
        const school =
          findSchool(
            schoolName,
            schools
          );

        if (
          !school
        ) {
          errorText =
            schoolName
              ? `校舎「${schoolName}」が見つかりません。`
              : "校舎がありません。";
        } else {
          schoolId =
            school.id;
        }
      }

      /*
       * 既存生徒
       *
       * 生徒番号だけで識別。
       */
      if (
        !errorText &&
        studentNumber
      ) {
        const existing =
          students.find(
            (
              student
            ) =>
              student.studentNumber ===
              studentNumber
          );

        if (
          !existing
        ) {
          errorText =
            `生徒番号「${studentNumber}」の生徒が登録されていません。新規生徒なら生徒番号を空欄にしてください。`;
        } else {
          studentId =
            existing.id;

          isUpdate =
            hasStudentChanged(
              existing,
              {
                name,
                grade,
                className,
                schoolId,
              }
            );

          isUnchanged =
            !isUpdate;
        }
      }

      /*
       * 新規生徒
       */
      if (
        !errorText &&
        !studentNumber
      ) {
        isNew =
          true;

        const newKey =
          [
            name,
            grade,
            className,
            schoolId,
          ].join(
            "|"
          );

        if (
          seenNewKeys.has(
            newKey
          )
        ) {
          errorText =
            "CSV内で同じ新規生徒情報が重複しています。";
        } else {
          seenNewKeys.add(
            newKey
          );
        }
      }

      rows.push({
        rowNumber,

        studentId,

        studentNumber,

        name,

        grade,

        className,

        schoolName,

        schoolId,

        error:
          errorText,

        isNew:
          !errorText &&
          isNew,

        isUpdate:
          !errorText &&
          isUpdate,

        isUnchanged:
          !errorText &&
          isUnchanged,
      });
    }

    return rows;
  }

  /* =======================================================
     CSV summary
     ======================================================= */

  const summary =
    useMemo<ImportSummary>(() => {
      return {
        newCount:
          csvRows.filter(
            (
              row
            ) =>
              row.isNew
          ).length,

        updateCount:
          csvRows.filter(
            (
              row
            ) =>
              row.isUpdate
          ).length,

        unchangedCount:
          csvRows.filter(
            (
              row
            ) =>
              row.isUnchanged
          ).length,

        errorCount:
          csvRows.filter(
            (
              row
            ) =>
              Boolean(
                row.error
              )
          ).length,
      };
    }, [
      csvRows,
    ]);

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
      !currentUser?.organizationId
    ) {
      setError(
        "組織情報を確認できません。"
      );

      return;
    }

    if (
      !canManage
    ) {
      setError(
        "生徒情報を管理する権限がありません。"
      );

      return;
    }

    if (
      !previewReady ||
      csvRows.length ===
        0
    ) {
      setError(
        "先にCSVをアップロードしてください。"
      );

      return;
    }

    if (
      summary.errorCount >
      0
    ) {
      setError(
        `${summary.errorCount}件のエラーがあります。修正してから再アップロードしてください。`
      );

      return;
    }

    try {
      setImporting(
        true
      );

      setError("");
      setMessage("");

      /*
       * -----------------------------------------------------
       * 現在使用中の生徒番号
       * -----------------------------------------------------
       */

      const usedNumbers =
        new Set(
          students
            .map(
              (
                student
              ) =>
                student.studentNumber
            )
            .filter(
              Boolean
            )
        );

      /*
       * -----------------------------------------------------
       * 永久予約済み番号
       * -----------------------------------------------------
       *
       * studentNumberRegistryを直接取得する。
       *
       * 本番Rulesでは管理者のみread可能。
       */

      const registryData =
        await loadNumberRegistry(
          currentUser
        );

      for (
        const number of
          registryData
      ) {
        usedNumbers.add(
          number
        );
      }

      let newCount =
        0;

      let updateCount =
        0;

      let unchangedCount =
        0;

      /*
       * =====================================================
       * 新規登録
       * =====================================================
       */

      for (
        const row of
          csvRows
      ) {
        if (
          !row.isNew
        ) {
          continue;
        }

        const studentNumber =
          generateStudentNumber(
            usedNumbers
          );

        usedNumbers.add(
          studentNumber
        );

        const studentRef =
          await addDoc(
            collection(
              db,
              "students"
            ),
            {
              organizationId:
                currentUser.organizationId,

              studentNumber,

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
         * 生徒番号を永久予約。
         */
        await addDoc(
          collection(
            db,
            "studentNumberRegistry"
          ),
          {
            organizationId:
              currentUser.organizationId,

            studentNumber,

            studentId:
              studentRef.id,

            createdAt:
              serverTimestamp(),
          }
        );

        /*
         * 初期履歴。
         */
        await addDoc(
          collection(
            db,
            "studentHistory"
          ),
          {
            organizationId:
              currentUser.organizationId,

            schoolId:
              row.schoolId,

            studentId:
              studentRef.id,

            studentNumber,

            name:
              row.name,

            grade:
              row.grade,

            className:
              row.className,

            changeType:
              "新規登録",

            changedBy:
              currentUser.uid,

            changedAt:
              serverTimestamp(),
          }
        );

        newCount++;
      }

      /*
       * =====================================================
       * 既存生徒更新
       * =====================================================
       */

      for (
        const row of
          csvRows
      ) {
        if (
          !row.studentId
        ) {
          continue;
        }

        const existing =
          students.find(
            (
              student
            ) =>
              student.id ===
              row.studentId
          );

        if (
          !existing
        ) {
          continue;
        }

        /*
         * 本部管理者以外は
         * 自校舎のみ変更可能。
         */
        if (
          currentUser.role !==
          "本部管理者"
        ) {
          if (
            !currentUser.schoolIds.includes(
              existing.schoolId
            ) ||
            !currentUser.schoolIds.includes(
              row.schoolId
            )
          ) {
            throw new Error(
              `生徒番号${existing.studentNumber}の校舎変更権限がありません。`
            );
          }
        }

        const changed =
          hasStudentChanged(
            existing,
            {
              name:
                row.name,

              grade:
                row.grade,

              className:
                row.className,

              schoolId:
                row.schoolId,
            }
          );

        if (
          !changed
        ) {
          unchangedCount++;

          continue;
        }

        /*
         * 変更前後を履歴保存。
         */
        await addDoc(
          collection(
            db,
            "studentHistory"
          ),
          {
            organizationId:
              currentUser.organizationId,

            schoolId:
              row.schoolId,

            studentId:
              existing.id,

            studentNumber:
              existing.studentNumber,

            previousName:
              existing.name,

            previousGrade:
              existing.grade,

            previousClassName:
              existing.className,

            previousSchoolId:
              existing.schoolId,

            newName:
              row.name,

            newGrade:
              row.grade,

            newClassName:
              row.className,

            newSchoolId:
              row.schoolId,

            changeType:
              "CSV更新",

            changedBy:
              currentUser.uid,

            changedAt:
              serverTimestamp(),
          }
        );

        /*
         * 現在情報だけ更新。
         *
         * studentNumberは絶対に変更しない。
         */
        await updateDoc(
          doc(
            db,
            "students",
            existing.id
          ),
          {
            name:
              row.name,

            grade:
              row.grade,

            className:
              row.className,

            schoolId:
              row.schoolId,

            updatedAt:
              serverTimestamp(),
          }
        );

        updateCount++;
      }

      setCsvRows(
        []
      );

      setPreviewReady(
        false
      );

      setFileName("");

      setMessage(
        `登録完了：新規${newCount}人、更新${updateCount}人、変更なし${unchangedCount}人`
      );

      await loadData(
        currentUser
      );
    } catch (
      err
    ) {
      console.error(
        "CSV import error:",
        err
      );

      setError(
        getSafeErrorMessage(
          err
        )
      );
    } finally {
      setImporting(
        false
      );
    }
  }

  /* =======================================================
     Number registry
     ======================================================= */

  async function loadNumberRegistry(
    user: CurrentUser
  ): Promise<string[]> {
    if (
      !user.organizationId
    ) {
      return [];
    }

    /*
     * ここはFirestore Rules上、
     * 本部管理者・校舎管理者だけ。
     *
     * 現状のFirestore scopeに
     * registry専用Queryを追加していないので、
     * organizationIdだけで取得する。
     */
    const {
      getDocs,
      query,
      collection,
      where,
    } =
      await import(
        "firebase/firestore"
      );

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "studentNumberRegistry"
          ),
          where(
            "organizationId",
            "==",
            user.organizationId
          )
        )
      );

    return snapshot.docs
      .map(
        (
          item
        ) =>
          stringValue(
            item.data()
              .studentNumber
          )
      )
      .filter(
        Boolean
      );
  }

  /* =======================================================
     Permission screen
     ======================================================= */

  if (
    currentUser &&
    !canManage
  ) {
    return null;
  }

  if (
    !currentUser &&
    !loading
  ) {
    return null;
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <main
      style={
        pageStyle
      }
    >
      <div
        style={{
          maxWidth:
            1500,

          margin:
            "0 auto",
        }}
      >
        {/* ==================================================
            Header
            ================================================== */}

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
            生徒管理
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
            生徒はCSVで一括登録・更新します。
            生徒番号はシステムが発行する永久識別番号です。
          </p>
        </header>

        {/* ==================================================
            Messages
            ================================================== */}

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

        {/* ==================================================
            CSV
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
              margin:
                0,
            }}
          >
            CSV一括登録・更新
          </h2>

          <div
            style={{
              marginTop:
                12,

              padding:
                16,

              background:
                "#f7f7f7",

              borderRadius:
                8,

              fontSize:
                13,

              lineHeight:
                1.9,
            }}
          >
            <strong>
              CSV形式
            </strong>

            <br />

            <code>
              生徒番号,氏名,学年,クラス,校舎
            </code>

            <br />

            生徒番号がある場合は、その番号の生徒を更新します。
            生徒番号が空欄の場合は新規生徒として登録し、
            システムが6桁の生徒番号を自動発行します。
          </div>

          <div
            style={{
              display:
                "flex",

              gap:
                10,

              flexWrap:
                "wrap",

              marginTop:
                18,
            }}
          >
            <button
              type="button"
              onClick={
                downloadCurrentStudentsCSV
              }
              style={
                secondaryButton
              }
            >
              現在の生徒CSVをダウンロード
            </button>

            <label
              style={
                uploadButton
              }
            >
              CSVを選択

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={
                  handleCSVFile
                }
                style={{
                  display:
                    "none",
                }}
              />
            </label>
          </div>

          {fileName && (
            <div
              style={{
                marginTop:
                  12,

                color:
                  "#666",

                fontSize:
                  12,
              }}
            >
              選択ファイル：
              <strong>
                {
                  fileName
                }
              </strong>
            </div>
          )}
        </section>

        {/* ==================================================
            Preview
            ================================================== */}

        {previewReady && (
          <section
            style={{
              ...cardStyle,

              marginBottom:
                20,
            }}
          >
            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

                alignItems:
                  "center",

                gap:
                  16,

                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    margin:
                      0,
                  }}
                >
                  CSVプレビュー
                </h2>

                <p
                  style={{
                    margin:
                      "5px 0 0",

                    color:
                      "#777",

                    fontSize:
                      12,
                  }}
                >
                  登録・更新前に内容を確認してください。
                </p>
              </div>

              <div
                style={{
                  display:
                    "flex",

                  gap:
                    8,

                  flexWrap:
                    "wrap",
                }}
              >
                <Summary
                  label="新規"
                  value={`${summary.newCount}件`}
                />

                <Summary
                  label="更新"
                  value={`${summary.updateCount}件`}
                />

                <Summary
                  label="変更なし"
                  value={`${summary.unchangedCount}件`}
                />

                <Summary
                  label="エラー"
                  value={`${summary.errorCount}件`}
                  danger={
                    summary.errorCount >
                    0
                  }
                />
              </div>
            </div>

            <div
              style={{
                overflowX:
                  "auto",

                marginTop:
                  20,

                maxHeight:
                  600,

                overflowY:
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
                      行
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

                    <th
                      style={
                        thStyle
                      }
                    >
                      処理
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      エラー
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {csvRows.map(
                    (
                      row
                    ) => (
                      <tr
                        key={`${row.rowNumber}-${row.studentNumber}-${row.name}`}
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            row.rowNumber
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {row.studentNumber ||
                            "自動発行"}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            row.name
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            row.grade
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            row.className
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            row.schoolName
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {row.error ? (
                            <span
                              style={
                                errorBadge
                              }
                            >
                              エラー
                            </span>
                          ) : row.isNew ? (
                            <span
                              style={
                                newBadge
                              }
                            >
                              新規登録
                            </span>
                          ) : row.isUpdate ? (
                            <span
                              style={
                                updateBadge
                              }
                            >
                              更新
                            </span>
                          ) : (
                            <span
                              style={
                                unchangedBadge
                              }
                            >
                              変更なし
                            </span>
                          )}
                        </td>

                        <td
                          style={{
                            ...tdStyle,

                            color:
                              row.error
                                ? "#a00000"
                                : "#777",
                          }}
                        >
                          {
                            row.error
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              disabled={
                importing ||
                summary.errorCount >
                  0 ||
                csvRows.length ===
                  0
              }
              onClick={
                importCSV
              }
              style={{
                ...primaryButton,

                marginTop:
                  20,

                opacity:
                  importing ||
                  summary.errorCount >
                    0 ||
                  csvRows.length ===
                    0
                    ? 0.5
                    : 1,
              }}
            >
              {importing
                ? "登録・更新中..."
                : "この内容で登録・更新する"}
            </button>
          </section>
        )}

        {/* ==================================================
            Current students
            ================================================== */}

        <section
          style={
            cardStyle
          }
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                16,

              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                現在の生徒
              </h2>

              <p
                style={{
                  margin:
                    "5px 0 0",

                  color:
                    "#777",

                  fontSize:
                    12,
                }}
              >
                {
                  filteredStudents.length
                }
                人
              </p>
            </div>

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
              placeholder="生徒番号・氏名・学年・クラス・校舎"
              style={{
                ...inputStyle,

                maxWidth:
                  380,

                marginTop:
                  0,
              }}
            />
          </div>

          {loading ? (
            <p
              style={{
                marginTop:
                  20,
              }}
            >
              生徒情報を読み込んでいます...
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",

                marginTop:
                  18,

                maxHeight:
                  650,

                overflowY:
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

                    <th
                      style={
                        thStyle
                      }
                    >
                      状態
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map(
                    (
                      student
                    ) => {
                      const school =
                        schools.find(
                          (
                            item
                          ) =>
                            item.id ===
                            student.schoolId
                        );

                      return (
                        <tr
                          key={
                            student.studentNumber
                          }
                        >
                          <td
                            style={{
                              ...tdStyle,

                              fontWeight:
                                700,
                            }}
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
                            {
                              student.className ||
                              "—"
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              school?.name ??
                              "—"
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {student.active
                              ? "在籍"
                              : "停止"}
                          </td>
                        </tr>
                      );
                    }
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
                        生徒がありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   CSV parser
   ========================================================= */

function parseCSV(
  text: string
): string[][] {
  const normalized =
    text
      .replace(
        /^\uFEFF/,
        ""
      )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      );

  const rows: string[][] =
    [];

  let row: string[] =
    [];

  let cell =
    "";

  let inQuotes =
    false;

  for (
    let i = 0;
    i < normalized.length;
    i++
  ) {
    const char =
      normalized[i];

    if (
      char ===
      '"'
    ) {
      if (
        inQuotes &&
        normalized[i + 1] ===
          '"'
      ) {
        cell +=
          '"';

        i++;

        continue;
      }

      inQuotes =
        !inQuotes;

      continue;
    }

    if (
      char ===
        "," &&
      !inQuotes
    ) {
      row.push(
        cell
      );

      cell =
        "";

      continue;
    }

    if (
      char ===
        "\n" &&
      !inQuotes
    ) {
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

  row.push(
    cell
  );

  if (
    row.some(
      (
        value
      ) =>
        value.trim()
          .length >
        0
    )
  ) {
    rows.push(
      row
    );
  }

  return rows;
}

/* =========================================================
   CSV helpers
   ========================================================= */

function looksLikeHeader(
  row: string[]
) {
  const values =
    row.map(
      (
        value
      ) =>
        cleanCSVValue(
          value
        )
    );

  return (
    values.includes(
      "生徒番号"
    ) ||
    values.includes(
      "氏名"
    )
  );
}

function cleanCSVValue(
  value: string
) {
  return value
    .replace(
      /^\uFEFF/,
      ""
    )
    .trim();
}

function normalizeStudentNumber(
  value: string
) {
  return cleanCSVValue(
    value
  ).replace(
    /\s/g,
    ""
  );
}

function csvEscape(
  value: string
) {
  return `"${String(
    value
  ).replace(
    /"/g,
    '""'
  )}"`;
}

function downloadTextFile(
  content: string,
  filename: string,
  type: string
) {
  const blob =
    new Blob(
      [
        content,
      ],
      {
        type,
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
    filename;

  document.body.appendChild(
    anchor
  );

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(
    url
  );
}

/* =========================================================
   Student number
   ========================================================= */

function generateStudentNumber(
  usedNumbers: Set<string>
) {
  for (
    let attempt = 0;
    attempt <
    100000;
    attempt++
  ) {
    const number =
      Math.floor(
        100000 +
          Math.random() *
            900000
      ).toString();

    if (
      !usedNumbers.has(
        number
      )
    ) {
      return number;
    }
  }

  throw new Error(
    "新しい生徒番号を発行できませんでした。"
  );
}

/* =========================================================
   Student comparison
   ========================================================= */

function hasStudentChanged(
  student: Student,
  next: {
    name: string;

    grade: string;

    className: string;

    schoolId: string;
  }
) {
  return (
    student.name !==
      next.name ||
    student.grade !==
      next.grade ||
    student.className !==
      next.className ||
    student.schoolId !==
      next.schoolId
  );
}

/* =========================================================
   School
   ========================================================= */

function findSchool(
  schoolName: string,
  schools: School[]
) {
  const normalized =
    schoolName
      .trim()
      .toLowerCase();

  return schools.find(
    (
      school
    ) =>
      school.name
        .trim()
        .toLowerCase() ===
      normalized
  );
}

/* =========================================================
   User role
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

/* =========================================================
   Value helpers
   ========================================================= */

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}

/* =========================================================
   Error
   ========================================================= */

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

    case "failed-precondition":
      return "現在この操作を実行できません。";

    case "already-exists":
      return "同じデータがすでに登録されています。";

    case "unavailable":
      return "サーバーに接続できませんでした。";

    default:
      return error instanceof Error
        ? error.message
        : "生徒情報を処理できませんでした。";
  }
}

/* =========================================================
   Summary
   ========================================================= */

function Summary({
  label,
  value,
  danger = false,
}: {
  label: string;

  value: string;

  danger?: boolean;
}) {
  return (
    <div
      style={{
        minWidth:
          80,

        padding:
          "8px 10px",

        border:
          "1px solid #eee",

        borderRadius:
          8,

        background:
          danger
            ? "#fff4f4"
            : "#fafafa",
      }}
    >
      <div
        style={{
          color:
            danger
              ? "#a00000"
              : "#777",

          fontSize:
            10,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display:
            "block",

          marginTop:
            2,

          color:
            danger
              ? "#a00000"
              : "#222",

          fontSize:
            15,
        }}
      >
        {value}
      </strong>
    </div>
  );
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
      7,

    padding:
      "10px 12px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",
  };

const primaryButton:
  React.CSSProperties = {
    width:
      "100%",

    padding:
      "13px 20px",

    border:
      "none",

    borderRadius:
      8,

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
      "10px 16px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",

    cursor:
      "pointer",

    fontWeight:
      600,
  };

const uploadButton:
  React.CSSProperties = {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    padding:
      "10px 16px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",

    cursor:
      "pointer",

    fontWeight:
      600,
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
    position:
      "sticky",

    top: 0,

    padding:
      "11px 10px",

    textAlign:
      "left",

    borderBottom:
      "2px solid #ddd",

    background:
      "#fff",

    whiteSpace:
      "nowrap",

    fontSize:
      12,

    zIndex:
      1,
  };

const tdStyle:
  React.CSSProperties = {
    padding:
      "11px 10px",

    borderBottom:
      "1px solid #eee",

    fontSize:
      13,

    whiteSpace:
      "nowrap",

    verticalAlign:
      "middle",
  };

const errorBadge:
  React.CSSProperties = {
    display:
      "inline-block",

    padding:
      "4px 8px",

    borderRadius:
      999,

    background:
      "#fff0f0",

    color:
      "#a00000",

    fontSize:
      11,

    fontWeight:
      600,
  };

const newBadge:
  React.CSSProperties = {
    display:
      "inline-block",

    padding:
      "4px 8px",

    borderRadius:
      999,

    background:
      "#eef9f1",

    color:
      "#28733f",

    fontSize:
      11,

    fontWeight:
      600,
  };

const updateBadge:
  React.CSSProperties = {
    display:
      "inline-block",

    padding:
      "4px 8px",

    borderRadius:
      999,

    background:
      "#eef5fc",

    color:
      "#1f4d80",

    fontSize:
      11,

    fontWeight:
      600,
  };

const unchangedBadge:
  React.CSSProperties = {
    display:
      "inline-block",

    padding:
      "4px 8px",

    borderRadius:
      999,

    background:
      "#f2f2f2",

    color:
      "#666",

    fontSize:
      11,

    fontWeight:
      600,
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
