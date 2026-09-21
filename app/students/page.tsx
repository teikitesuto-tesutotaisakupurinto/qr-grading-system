"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getFirebaseErrorMessage,
} from "@/lib/firebaseError";

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

const GRADES = [
  "未設定",
  "小学1年",
  "小学2年",
  "小学3年",
  "小学4年",
  "小学5年",
  "小学6年",
  "中学1年",
  "中学2年",
  "中学3年",
  "高校1年",
  "高校2年",
  "高校3年",
];

export default function StudentsPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(null);

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
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null
  );

  const [
    studentNumber,
    setStudentNumber,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

  const [
    grade,
    setGrade,
  ] = useState("未設定");

  const [
    className,
    setClassName,
  ] = useState("");

  const [
    schoolId,
    setSchoolId,
  ] = useState("");

  /*
   * ========================================================
   * 認証ユーザー
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
            });
          } catch (err) {
            console.error(
              err
            );

            setError(
              getFirebaseErrorMessage(
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
   * データ読み込み
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

      /*
       * 新規登録時の初期校舎
       */
      if (
        !schoolId &&
        loadedSchools.length >
          0
      ) {
        const available =
          getAvailableSchools(
            loadedSchools,
            currentUser
          );

        if (
          available.length >
          0
        ) {
          setSchoolId(
            available[0].id
          );
        }
      }
    } catch (err) {
      console.error(
        err
      );

      setError(
        getFirebaseErrorMessage(
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
    useMemo(
      () =>
        getAvailableSchools(
          schools,
          currentUser
        ),
      [
        schools,
        currentUser,
      ]
    );

  /*
   * ========================================================
   * 生徒番号生成
   * ========================================================
   */

  function generateStudentNumber() {
    const existing =
      new Set(
        students.map(
          (student) =>
            student.studentNumber
        )
      );

    let number = "";

    do {
      number =
        Math.floor(
          100000 +
            Math.random() *
              900000
        ).toString();
    } while (
      existing.has(number)
    );

    setStudentNumber(
      number
    );
  }

  /*
   * ========================================================
   * 生徒保存
   * ========================================================
   */

  async function saveStudent() {
    if (saving) {
      return;
    }

    setError("");
    setMessage("");

    if (
      !currentUser?.organizationId
    ) {
      setError(
        "組織情報を確認できません。"
      );

      return;
    }

    if (
      !schoolId
    ) {
      setError(
        "所属校舎を選択してください。"
      );

      return;
    }

    if (
      !name.trim()
    ) {
      setError(
        "氏名を入力してください。"
      );

      return;
    }

    if (
      !/^\d{6}$/.test(
        studentNumber
      )
    ) {
      setError(
        "生徒番号は6桁の数字で入力してください。"
      );

      return;
    }

    /*
     * 校舎権限確認
     */

    if (
      currentUser.role !==
        "本部管理者" &&
      !currentUser.schoolIds.includes(
        schoolId
      )
    ) {
      setError(
        "この校舎の生徒を管理する権限がありません。"
      );

      return;
    }

    try {
      setSaving(true);

      /*
       * 生徒番号重複確認
       */

      const duplicateSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "students"
            ),
            where(
              "organizationId",
              "==",
              currentUser.organizationId
            ),
            where(
              "studentNumber",
              "==",
              studentNumber
            )
          )
        );

      const duplicate =
        duplicateSnapshot.docs.find(
          (
            item
          ) =>
            item.id !==
            editingId
        );

      if (duplicate) {
        throw new Error(
          "この生徒番号はすでに使用されています。"
        );
      }

      if (
        editingId
      ) {
        /*
         * 編集
         */

        await updateDoc(
          doc(
            db,
            "students",
            editingId
          ),
          {
            schoolId,

            studentNumber,

            name:
              name.trim(),

            grade,

            className:
              className.trim(),

            updatedAt:
              serverTimestamp(),
          }
        );

        setMessage(
          "生徒情報を更新しました。"
        );
      } else {
        /*
         * 新規登録
         */

        await addDoc(
          collection(
            db,
            "students"
          ),
          {
            organizationId:
              currentUser.organizationId,

            schoolId,

            studentNumber,

            name:
              name.trim(),

            grade,

            className:
              className.trim(),

            active:
              true,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        setMessage(
          "生徒を登録しました。"
        );
      }

      resetForm();

      await loadData(
        currentUser.organizationId
      );
    } catch (err) {
      console.error(
        err
      );

      /*
       * Firebaseの生エラーは
       * 画面に表示しない。
       */

      setError(
        getFirebaseErrorMessage(
          err
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================================
   * 編集開始
   * ========================================================
   */

  function startEdit(
    student: Student
  ) {
    setEditingId(
      student.id
    );

    setStudentNumber(
      student.studentNumber
    );

    setName(
      student.name
    );

    setGrade(
      student.grade
    );

    setClassName(
      student.className
    );

    setSchoolId(
      student.schoolId
    );

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /*
   * ========================================================
   * 有効/停止
   * ========================================================
   */

  async function toggleStudent(
    student: Student
  ) {
    setError("");
    setMessage("");

    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    if (
      currentUser.role !==
        "本部管理者" &&
      !currentUser.schoolIds.includes(
        student.schoolId
      )
    ) {
      setError(
        "この生徒を変更する権限がありません。"
      );

      return;
    }

    try {
      await updateDoc(
        doc(
          db,
          "students",
          student.id
        ),
        {
          active:
            !student.active,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        student.active
          ? "生徒を停止しました。"
          : "生徒を有効にしました。"
      );

      await loadData(
        currentUser.organizationId
      );
    } catch (err) {
      console.error(
        err
      );

      setError(
        getFirebaseErrorMessage(
          err
        )
      );
    }
  }

  /*
   * ========================================================
   * フォームリセット
   * ========================================================
   */

  function resetForm() {
    setEditingId(null);

    setStudentNumber("");

    setName("");

    setGrade(
      "未設定"
    );

    setClassName("");

    const first =
      availableSchools[0];

    setSchoolId(
      first?.id ?? ""
    );
  }

  /*
   * ========================================================
   * 検索
   * ========================================================
   */

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
    }, [
      students,
      search,
    ]);

  /*
   * ========================================================
   * 権限なし
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
            生徒管理
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
      <div
        style={{
          maxWidth:
            1400,
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
              28,
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
            生徒情報・生徒番号・学年・クラス・所属校舎を管理します。
          </p>
        </header>

        {error && (
          <Message
            type="error"
            message={error}
          />
        )}

        {message && (
          <Message
            type="success"
            message={message}
          />
        )}

        {/* ==================================================
            生徒登録
            ================================================== */}

        <section
          style={{
            ...cardStyle,
            marginBottom:
              24,
          }}
        >
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap:
                16,
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                {editingId
                  ? "生徒情報を編集"
                  : "生徒を登録"}
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color:
                    "#777",
                  fontSize:
                    13,
                }}
              >
                生徒番号はQRシールに使用されます。
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                style={
                  secondaryButton
                }
              >
                新規登録に戻す
              </button>
            )}
          </div>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap:
                16,
              marginTop:
                20,
            }}
          >
            <label>
              生徒番号

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    8,
                }}
              >
                <input
                  value={
                    studentNumber
                  }
                  onChange={(
                    event
                  ) =>
                    setStudentNumber(
                      event.target.value.replace(
                        /\D/g,
                        ""
                      ).slice(
                        0,
                        6
                      )
                    )
                  }
                  inputMode="numeric"
                  maxLength={
                    6
                  }
                  placeholder="123456"
                  style={{
                    ...inputStyle,
                    marginTop:
                      7,
                  }}
                />

                {!editingId && (
                  <button
                    type="button"
                    onClick={
                      generateStudentNumber
                    }
                    style={{
                      marginTop:
                        7,
                      whiteSpace:
                        "nowrap",
                      padding:
                        "0 14px",
                      border:
                        "1px solid #ccc",
                      borderRadius:
                        7,
                      background:
                        "#fff",
                      cursor:
                        "pointer",
                    }}
                  >
                    自動発行
                  </button>
                )}
              </div>
            </label>

            <label>
              氏名

              <input
                value={
                  name
                }
                onChange={(
                  event
                ) =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="山田太郎"
                style={
                  inputStyle
                }
              />
            </label>

            <label>
              学年

              <select
                value={
                  grade
                }
                onChange={(
                  event
                ) =>
                  setGrade(
                    event.target.value
                  )
                }
                style={
                  inputStyle
                }
              >
                {GRADES.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {
                        item
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              クラス

              <input
                value={
                  className
                }
                onChange={(
                  event
                ) =>
                  setClassName(
                    event.target.value
                  )
                }
                placeholder="3年2組"
                style={
                  inputStyle
                }
              />
            </label>

            <label>
              所属校舎

              <select
                value={
                  schoolId
                }
                onChange={(
                  event
                ) =>
                  setSchoolId(
                    event.target.value
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="">
                  選択してください
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
            </label>
          </div>

          <div
            style={{
              display:
                "flex",
              gap:
                10,
              marginTop:
                24,
            }}
          >
            <button
              type="button"
              disabled={
                saving
              }
              onClick={
                saveStudent
              }
              style={
                primaryButton
              }
            >
              {saving
                ? "保存中..."
                : editingId
                  ? "変更を保存"
                  : "生徒を登録"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                style={
                  secondaryButton
                }
              >
                キャンセル
              </button>
            )}
          </div>
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
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap:
                16,
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                生徒一覧
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color:
                    "#777",
                  fontSize:
                    13,
                }}
              >
                {students.length}
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
                  event.target.value
                )
              }
              placeholder="氏名・生徒番号・クラスで検索"
              style={{
                ...inputStyle,
                maxWidth:
                  320,
                marginTop:
                  0,
              }}
            />
          </div>

          {loading ? (
            <p
              style={{
                marginTop:
                  24,
              }}
            >
              読み込み中...
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
                marginTop:
                  20,
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

                    <th
                      style={
                        thStyle
                      }
                    >
                      操作
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
                          <strong>
                            {
                              student.studentNumber
                            }
                          </strong>
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

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <span
                            style={{
                              padding:
                                "4px 8px",
                              borderRadius:
                                999,
                              background:
                                student.active
                                  ? "#eef8f1"
                                  : "#f3f3f3",
                              color:
                                student.active
                                  ? "#28733f"
                                  : "#777",
                              fontSize:
                                11,
                              fontWeight:
                                600,
                            }}
                          >
                            {student.active
                              ? "有効"
                              : "停止"}
                          </span>
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
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
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(
                                  student
                                )
                              }
                              style={
                                smallButton
                              }
                            >
                              編集
                            </button>

                            <Link
                              href={`/qr-stickers?studentId=${encodeURIComponent(
                                student.id
                              )}`}
                              style={
                                smallLink
                              }
                            >
                              QRシール
                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                toggleStudent(
                                  student
                                )
                              }
                              style={
                                dangerButton
                              }
                            >
                              {student.active
                                ? "停止"
                                : "有効化"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}

                  {filteredStudents.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          7
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
   Available schools
   ========================================================= */

function getAvailableSchools(
  schools: School[],
  user: CurrentUser | null
) {
  if (!user) {
    return [];
  }

  const activeSchools =
    schools.filter(
      (school) =>
        school.active
    );

  if (
    user.role ===
    "本部管理者"
  ) {
    return activeSchools;
  }

  return activeSchools.filter(
    (school) =>
      user.schoolIds.includes(
        school.id
      )
  );
}

/* =========================================================
   School name
   ========================================================= */

function getSchoolName(
  schoolId: string,
  schools: School[]
) {
  return (
    schools.find(
      (school) =>
        school.id ===
        schoolId
    )?.name ??
    "不明"
  );
}

/* =========================================================
   Role
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
   Message
   ========================================================= */

function Message({
  type,
  message,
}: {
  type:
    | "error"
    | "success";

  message: string;
}) {
  return (
    <div
      style={{
        marginBottom:
          16,
        padding:
          14,
        border:
          "1px solid",
        borderColor:
          type ===
          "error"
            ? "#efb5b5"
            : "#b8d9c0",
        borderRadius:
          8,
        background:
          type ===
          "error"
            ? "#fff4f4"
            : "#f2faf4",
        color:
          type ===
          "error"
            ? "#9b1c1c"
            : "#25633a",
        lineHeight:
          1.6,
      }}
    >
      {message}
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

const inputStyle:
  React.CSSProperties = {
    display:
      "block",

    width:
      "100%",

    marginTop:
      7,

    padding:
      "11px 12px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",

    outline:
      "none",
  };

const primaryButton:
  React.CSSProperties = {
    padding:
      "11px 22px",

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
      "10px 18px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",

    color:
      "#333",

    cursor:
      "pointer",
  };

const smallButton:
  React.CSSProperties = {
    padding:
      "7px 10px",

    border:
      "1px solid #ccc",

    borderRadius:
      6,

    background:
      "#fff",

    cursor:
      "pointer",
  };

const smallLink:
  React.CSSProperties = {
    display:
      "inline-flex",

    alignItems:
      "center",

    padding:
      "7px 10px",

    border:
      "1px solid #ccc",

    borderRadius:
      6,

    background:
      "#fff",

    color:
      "#333",

    textDecoration:
      "none",

    fontSize:
      13,
  };

const dangerButton:
  React.CSSProperties = {
    padding:
      "7px 10px",

    border:
      "1px solid #d99",

    borderRadius:
      6,

    background:
      "#fff",

    color:
      "#a00000",

    cursor:
      "pointer",
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
