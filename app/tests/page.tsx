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
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";

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

const SUBJECTS = [
  "国語",
  "数学",
  "算数",
  "英語",
  "理科",
  "社会",
  "その他",
];

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

export default function TestsPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(
    null
  );

  const [
    tests,
    setTests,
  ] = useState<Test[]>([]);

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
    testId,
    setTestId,
  ] = useState("");

  const [
    testName,
    setTestName,
  ] = useState("");

  const [
    subject,
    setSubject,
  ] = useState("国語");

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

  const [
    examDate,
    setExamDate,
  ] = useState("");

  const [
    totalScore,
    setTotalScore,
  ] = useState("100");

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
        testSnapshot,
        schoolSnapshot,
      ] = await Promise.all([
        getDocs(
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

      const loadedTests =
        testSnapshot.docs.map(
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
                  : "未設定",

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

      setTests(
        loadedTests
      );

      setSchools(
        loadedSchools
      );

      if (
        !schoolId
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
   * テストID生成
   * ========================================================
   */

  function generateTestId() {
    const existing =
      new Set(
        tests.map(
          (
            test
          ) =>
            test.testId
        )
      );

    let value = "";

    do {
      value =
        `T${Date.now()
          .toString(36)
          .toUpperCase()
          .slice(-7)}`;
    } while (
      existing.has(value)
    );

    setTestId(
      value
    );
  }

  /*
   * ========================================================
   * 保存
   * ========================================================
   */

  async function saveTest() {
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
        "校舎を選択してください。"
      );

      return;
    }

    if (
      !testId.trim()
    ) {
      setError(
        "テストIDを入力してください。"
      );

      return;
    }

    if (
      !testName.trim()
    ) {
      setError(
        "テスト名を入力してください。"
      );

      return;
    }

    const score =
      Number(
        totalScore
      );

    if (
      !Number.isFinite(score) ||
      score <= 0
    ) {
      setError(
        "満点は1以上の数字で入力してください。"
      );

      return;
    }

    if (
      currentUser.role !==
        "本部管理者" &&
      !currentUser.schoolIds.includes(
        schoolId
      )
    ) {
      setError(
        "この校舎のテストを管理する権限がありません。"
      );

      return;
    }

    try {
      setSaving(true);

      /*
       * テストIDは組織内で一意。
       */

      const duplicateSnapshot =
        await getDocs(
          query(
            collection(
              db,
              "tests"
            ),
            where(
              "organizationId",
              "==",
              currentUser.organizationId
            ),
            where(
              "testId",
              "==",
              testId.trim()
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

      if (
        duplicate
      ) {
        throw new Error(
          "このテストIDはすでに使用されています。"
        );
      }

      const payload = {
        organizationId:
          currentUser.organizationId,

        schoolId,

        testId:
          testId
            .trim()
            .toUpperCase(),

        name:
          testName.trim(),

        subject,

        grade,

        className:
          className.trim(),

        examDate,

        totalScore:
          score,

        active:
          true,

        updatedAt:
          serverTimestamp(),
      };

      if (
        editingId
      ) {
        await updateDoc(
          doc(
            db,
            "tests",
            editingId
          ),
          payload
        );

        setMessage(
          "テストを更新しました。"
        );
      } else {
        await addDoc(
          collection(
            db,
            "tests"
          ),
          {
            ...payload,

            createdAt:
              serverTimestamp(),
          }
        );

        setMessage(
          "テストを登録しました。"
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

      if (
        err instanceof Error &&
        !isFirebaseError(
          err
        )
      ) {
        setError(
          err.message
        );
      } else {
        setError(
          getSafeErrorMessage(
            err
          )
        );
      }
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================================
   * 編集
   * ========================================================
   */

  function startEdit(
    test: Test
  ) {
    setEditingId(
      test.id
    );

    setTestId(
      test.testId
    );

    setTestName(
      test.name
    );

    setSubject(
      test.subject
    );

    setGrade(
      test.grade
    );

    setClassName(
      test.className
    );

    setSchoolId(
      test.schoolId
    );

    setExamDate(
      test.examDate
    );

    setTotalScore(
      test.totalScore.toString()
    );

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  /*
   * ========================================================
   * 停止/有効化
   * ========================================================
   */

  async function toggleTest(
    test: Test
  ) {
    if (
      !currentUser
    ) {
      return;
    }

    if (
      currentUser.role !==
        "本部管理者" &&
      !currentUser.schoolIds.includes(
        test.schoolId
      )
    ) {
      setError(
        "このテストを変更する権限がありません。"
      );

      return;
    }

    try {
      setError("");
      setMessage("");

      await updateDoc(
        doc(
          db,
          "tests",
          test.id
        ),
        {
          active:
            !test.active,

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        test.active
          ? "テストを停止しました。"
          : "テストを有効にしました。"
      );

      if (
        currentUser.organizationId
      ) {
        await loadData(
          currentUser.organizationId
        );
      }
    } catch (err) {
      console.error(
        err
      );

      setError(
        getSafeErrorMessage(
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
    setEditingId(
      null
    );

    setTestId("");

    setTestName("");

    setSubject(
      "国語"
    );

    setGrade(
      "未設定"
    );

    setClassName("");

    setExamDate("");

    setTotalScore(
      "100"
    );

    const first =
      availableSchools[0];

    setSchoolId(
      first?.id ??
        ""
    );
  }

  /*
   * ========================================================
   * 検索
   * ========================================================
   */

  const filteredTests =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return tests;
      }

      return tests.filter(
        (
          test
        ) =>
          test.testId
            .toLowerCase()
            .includes(
              keyword
            ) ||
          test.name
            .toLowerCase()
            .includes(
              keyword
            ) ||
          test.subject
            .toLowerCase()
            .includes(
              keyword
            ) ||
          test.className
            .toLowerCase()
            .includes(
              keyword
            )
      );
    }, [
      tests,
      search,
    ]);

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
            テスト管理
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
            テスト管理
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
            テストID・教科・学年・配点を管理します。
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
            登録
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
              justifyContent:
                "space-between",
              alignItems:
                "center",
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
                  ? "テストを編集"
                  : "テストを登録"}
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
                テストIDは答案用紙のテストID QRと一致させます。
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
              テストID

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
                    testId
                  }
                  onChange={(
                    event
                  ) =>
                    setTestId(
                      event.target.value
                    )
                  }
                  placeholder="T2026A01"
                  style={
                    inputStyle
                  }
                />

                {!editingId && (
                  <button
                    type="button"
                    onClick={
                      generateTestId
                    }
                    style={
                      secondaryButton
                    }
                  >
                    自動発行
                  </button>
                )}
              </div>
            </label>

            <label>
              テスト名

              <input
                value={
                  testName
                }
                onChange={(
                  event
                ) =>
                  setTestName(
                    event.target.value
                  )
                }
                placeholder="第1回定期テスト"
                style={
                  inputStyle
                }
              />
            </label>

            <label>
              教科

              <select
                value={
                  subject
                }
                onChange={(
                  event
                ) =>
                  setSubject(
                    event.target.value
                  )
                }
                style={
                  inputStyle
                }
              >
                {SUBJECTS.map(
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
              校舎

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

            <label>
              実施日

              <input
                type="date"
                value={
                  examDate
                }
                onChange={(
                  event
                ) =>
                  setExamDate(
                    event.target.value
                  )
                }
                style={
                  inputStyle
                }
              />
            </label>

            <label>
              満点

              <input
                type="number"
                min="1"
                value={
                  totalScore
                }
                onChange={(
                  event
                ) =>
                  setTotalScore(
                    event.target.value
                  )
                }
                style={
                  inputStyle
                }
              />
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
                saveTest
              }
              style={
                primaryButton
              }
            >
              {saving
                ? "保存中..."
                : editingId
                  ? "変更を保存"
                  : "テストを登録"}
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
            テスト一覧
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
                テスト一覧
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
                {tests.length}
                件
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
              placeholder="テストID・名称・教科・クラス"
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
                      テストID
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      テスト名
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      教科
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
                      実施日
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      満点
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
                  {filteredTests.map(
                    (
                      test
                    ) => (
                      <tr
                        key={
                          test.id
                        }
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          <strong>
                            {
                              test.testId
                            }
                          </strong>
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            test.name
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            test.subject
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            test.grade
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {test.examDate ||
                            "—"}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            test.totalScore
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {test.active
                            ? "有効"
                            : "停止"}
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
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(
                                  test
                                )
                              }
                              style={
                                smallButton
                              }
                            >
                              編集
                            </button>

                            <Link
                              href={`/test-qr?testId=${encodeURIComponent(
                                test.testId
                              )}`}
                              style={
                                smallLink
                              }
                            >
                              テストQR
                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                toggleTest(
                                  test
                                )
                              }
                              style={
                                dangerButton
                              }
                            >
                              {test.active
                                ? "停止"
                                : "有効化"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}

                  {filteredTests.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          8
                        }
                        style={{
                          ...tdStyle,
                          textAlign:
                            "center",
                          padding:
                            40,
                          color:
                            "#777",
                        }}
                      >
                        テストがありません。
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
   Helpers
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
      (
        school
      ) =>
        school.active
    );

  if (
    user.role ===
    "本部管理者"
  ) {
    return activeSchools;
  }

  return activeSchools.filter(
    (
      school
    ) =>
      user.schoolIds.includes(
        school.id
      )
  );
}

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

function isFirebaseError(
  error: unknown
) {
  const value =
    error as {
      code?: string;
    };

  return Boolean(
    value?.code
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

    case "already-exists":
      return "同じデータがすでに登録されています。";

    case "failed-precondition":
      return "現在この操作を実行できません。";

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからお試しください。";

    default:
      return "テスト情報を処理できませんでした。";
  }
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
      "10px 16px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",

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
