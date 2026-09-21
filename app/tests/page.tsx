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

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type GradingMethod =
  | "選択式"
  | "数値"
  | "短答"
  | "記述"
  | "手動";

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

type GradingSettings = {
  automaticGrading: boolean;
  aiGrading: boolean;
  firstReviewRequired: boolean;
  secondReviewRequired: boolean;
  allowManualCorrection: boolean;
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
  gradingMethod: GradingMethod;
  gradingSettings: GradingSettings;
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

const GRADING_METHODS: GradingMethod[] = [
  "選択式",
  "数値",
  "短答",
  "記述",
  "手動",
];

const DEFAULT_GRADING_SETTINGS: GradingSettings = {
  automaticGrading: true,
  aiGrading: false,
  firstReviewRequired: true,
  secondReviewRequired: true,
  allowManualCorrection: true,
};

export default function TestsPage() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<CurrentUser | null>(null);

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
  ] = useState<string | null>(null);

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

  const [
    gradingMethod,
    setGradingMethod,
  ] =
    useState<GradingMethod>(
      "選択式"
    );

  const [
    gradingSettings,
    setGradingSettings,
  ] =
    useState<GradingSettings>(
      DEFAULT_GRADING_SETTINGS
    );

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
          /*
           * エラーで勝手に
           * /loginへ戻さない。
           */
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

              organizationId:
                typeof data.organizationId ===
                "string"
                  ? data.organizationId
                  : null,

              role,

              schoolIds,
            });
          } catch (err) {
            console.error(
              "Test authentication error:",
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
      ] =
        await Promise.all([
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

            const rawSettings =
              data.gradingSettings;

            const settings: GradingSettings =
              isGradingSettings(
                rawSettings
              )
                ? rawSettings
                : {
                    ...DEFAULT_GRADING_SETTINGS,
                  };

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

              gradingMethod:
                isGradingMethod(
                  data.gradingMethod
                )
                  ? data.gradingMethod
                  : "選択式",

              gradingSettings:
                settings,

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
        "Test loading error:",
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
      existing.has(
        value
      )
    );

    setTestId(
      value
    );
  }

  /*
   * ========================================================
   * 採点設定更新
   * ========================================================
   */

  function updateGradingSetting<
    K extends keyof GradingSettings
  >(
    key: K,
    value: GradingSettings[K]
  ) {
    setGradingSettings(
      (
        current
      ) => ({
        ...current,

        [key]:
          value,
      })
    );

    setMessage("");
  }

  /*
   * ========================================================
   * 採点方式変更
   * ========================================================
   */

  function handleGradingMethodChange(
    value: GradingMethod
  ) {
    setGradingMethod(
      value
    );

    /*
     * 手動採点の場合、
     * 自動採点とAI採点はOFF。
     */
    if (
      value ===
      "手動"
    ) {
      setGradingSettings(
        (
          current
        ) => ({
          ...current,

          automaticGrading:
            false,

          aiGrading:
            false,
        })
      );

      return;
    }

    /*
     * 記述の場合はAI採点を
     * 利用できる状態にする。
     */
    if (
      value ===
      "記述"
    ) {
      setGradingSettings(
        (
          current
        ) => ({
          ...current,

          automaticGrading:
            true,

          aiGrading:
            true,
        })
      );

      return;
    }

    setGradingSettings(
      (
        current
      ) => ({
        ...current,

        automaticGrading:
          true,
      })
    );
  }

  /*
   * ========================================================
   * 保存
   * ========================================================
   */

  async function saveTest() {
    if (
      saving
    ) {
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
      !Number.isFinite(
        score
      ) ||
      score <=
        0
    ) {
      setError(
        "満点は1以上の数字で入力してください。"
      );

      return;
    }

    /*
     * 校舎権限
     */
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

    /*
     * 手動採点なら自動採点OFF
     */
    if (
      gradingMethod ===
      "手動" &&
      gradingSettings.automaticGrading
    ) {
      setError(
        "手動採点では自動採点を有効にできません。"
      );

      return;
    }

    try {
      setSaving(true);

      /*
       * テストID重複確認
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
              testId
                .trim()
                .toUpperCase()
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

        gradingMethod,

        gradingSettings: {
          ...gradingSettings,

          /*
           * 手動採点なら
           * 自動採点を強制OFF。
           */
          automaticGrading:
            gradingMethod ===
            "手動"
              ? false
              : gradingSettings.automaticGrading,

          aiGrading:
            gradingMethod ===
            "手動"
              ? false
              : gradingSettings.aiGrading,
        },

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
        "Test save error:",
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

    setGradingMethod(
      test.gradingMethod
    );

    setGradingSettings(
      {
        ...test.gradingSettings,
      }
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
        "Test status error:",
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

    setGradingMethod(
      "選択式"
    );

    setGradingSettings(
      {
        ...DEFAULT_GRADING_SETTINGS,
      }
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

      if (
        !keyword
      ) {
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
            テスト情報と採点方法を管理します。
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
            テスト登録
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
                問題文や問題データは登録せず、答案画像から解析します。
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

          {/* ================================================
              基本情報
              ================================================ */}

          <h3
            style={{
              marginTop:
                24,
              marginBottom:
                0,
              fontSize:
                15,
            }}
          >
            基本情報
          </h3>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap:
                16,
              marginTop:
                16,
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

          {/* ================================================
              採点設定
              ================================================ */}

          <h3
            style={{
              marginTop:
                30,
              marginBottom:
                0,
              fontSize:
                15,
            }}
          >
            採点設定
          </h3>

          <div
            style={{
              marginTop:
                16,
            }}
          >
            <label>
              採点方式

              <select
                value={
                  gradingMethod
                }
                onChange={(
                  event
                ) =>
                  handleGradingMethodChange(
                    event.target
                      .value as GradingMethod
                  )
                }
                style={
                  inputStyle
                }
              >
                {GRADING_METHODS.map(
                  (
                    method
                  ) => (
                    <option
                      key={
                        method
                      }
                      value={
                        method
                      }
                    >
                      {
                        method
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <div
              style={{
                marginTop:
                  18,

                border:
                  "1px solid #eee",

                borderRadius:
                  10,

                overflow:
                  "hidden",
              }}
            >
              <SettingToggle
                label="自動採点を使用する"
                description="OCR・答案解析後に採点処理を自動で実行します。"
                checked={
                  gradingSettings.automaticGrading
                }
                disabled={
                  gradingMethod ===
                  "手動"
                }
                onChange={(
                  value
                ) =>
                  updateGradingSetting(
                    "automaticGrading",
                    value
                  )
                }
              />

              <SettingToggle
                label="AI採点を使用する"
                description="記述式など、単純な正誤比較が難しい答案の採点候補をAIで作成します。"
                checked={
                  gradingSettings.aiGrading
                }
                disabled={
                  gradingMethod ===
                    "手動" ||
                  gradingMethod !==
                    "記述"
                }
                onChange={(
                  value
                ) =>
                  updateGradingSetting(
                    "aiGrading",
                    value
                  )
                }
              />

              <SettingToggle
                label="一次確認を必須にする"
                description="自動採点後、講師などによる一次確認を必須にします。"
                checked={
                  gradingSettings.firstReviewRequired
                }
                onChange={(
                  value
                ) =>
                  updateGradingSetting(
                    "firstReviewRequired",
                    value
                  )
                }
              />

              <SettingToggle
                label="二次確認を必須にする"
                description="一次確認後、別の確認者による二次確認を必須にします。"
                checked={
                  gradingSettings.secondReviewRequired
                }
                onChange={(
                  value
                ) =>
                  updateGradingSetting(
                    "secondReviewRequired",
                    value
                  )
                }
              />

              <SettingToggle
                label="手動修正を許可する"
                description="自動採点結果を確認者が修正できるようにします。"
                checked={
                  gradingSettings.allowManualCorrection
                }
                onChange={(
                  value
                ) =>
                  updateGradingSetting(
                    "allowManualCorrection",
                    value
                  )
                }
              />
            </div>
          </div>

          <div
            style={{
              marginTop:
                18,

              padding:
                14,

              background:
                "#f7f7f7",

              borderRadius:
                8,

              color:
                "#555",

              fontSize:
                13,

              lineHeight:
                1.7,
            }}
          >
            <strong>
              現在の設定：
            </strong>

            {" "}

            {gradingMethod}

            {" / "}

            {gradingSettings.automaticGrading
              ? "自動採点"
              : "手動採点"}

            {" / "}

            {gradingSettings.firstReviewRequired
              ? "一次確認あり"
              : "一次確認なし"}

            {" / "}

            {gradingSettings.secondReviewRequired
              ? "二次確認あり"
              : "二次確認なし"}
          </div>

          {/* ================================================
              保存
              ================================================ */}

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
                      採点方式
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
                          {
                            test.gradingMethod
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
                              flexWrap:
                                "wrap",
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
                          padding:
                            40,
                          textAlign:
                            "center",
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
   SettingToggle
   ========================================================= */

function SettingToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;

  description: string;

  checked: boolean;

  disabled?: boolean;

  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <label
      style={{
        display:
          "flex",

        alignItems:
          "flex-start",

        gap:
          12,

        padding:
          15,

        borderBottom:
          "1px solid #eee",

        cursor:
          disabled
            ? "default"
            : "pointer",

        opacity:
          disabled
            ? 0.5
            : 1,
      }}
    >
      <input
        type="checkbox"
        checked={
          checked
        }
        disabled={
          disabled
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .checked
          )
        }
        style={{
          marginTop:
            3,
        }}
      />

      <span>
        <strong>
          {label}
        </strong>

        <span
          style={{
            display:
              "block",

            marginTop:
              4,

            color:
              "#777",

            fontSize:
              12,

            lineHeight:
              1.6,
          }}
        >
          {
            description
          }
        </span>
      </span>
    </label>
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

function isGradingMethod(
  value: unknown
): value is GradingMethod {
  return (
    value ===
      "選択式" ||
    value ===
      "数値" ||
    value ===
      "短答" ||
    value ===
      "記述" ||
    value ===
      "手動"
  );
}

function isGradingSettings(
  value: unknown
): value is GradingSettings {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof data.automaticGrading ===
      "boolean" &&
    typeof data.aiGrading ===
      "boolean" &&
    typeof data.firstReviewRequired ===
      "boolean" &&
    typeof data.secondReviewRequired ===
      "boolean" &&
    typeof data.allowManualCorrection ===
      "boolean"
  );
}

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

    whiteSpace:
      "nowrap",
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
