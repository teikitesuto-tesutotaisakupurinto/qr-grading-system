"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
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
  SCHOOL_ASSETS_BUCKET,
  supabase,
} from "@/lib/supabase";

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type CurrentUser = {
  uid: string;

  name: string;

  organizationId: string | null;

  role: UserRole | null;

  schoolIds: string[];
};

type School = {
  id: string;

  name: string;

  logoPath: string;

  logoUrl: string;

  active: boolean;
};

type Settings = {
  schoolName: string;

  logoText: string;

  defaultYear: string;

  studentNumberDigits: number;

  allowStudentAnswerViewBeforeGrading: boolean;

  requireSecondReview: boolean;

  hideStudentIdentityInCrossSection: boolean;

  enableDeviationScore: boolean;

  enableRanking: boolean;

  enableRetest: boolean;

  answerUploadImmediatelyVisible: boolean;
};

const initialSettings: Settings = {
  schoolName: "○○塾",

  logoText: "塾ロゴ",

  defaultYear: "2026",

  studentNumberDigits: 6,

  allowStudentAnswerViewBeforeGrading:
    true,

  requireSecondReview:
    true,

  hideStudentIdentityInCrossSection:
    true,

  enableDeviationScore:
    true,

  enableRanking:
    true,

  enableRetest:
    true,

  answerUploadImmediatelyVisible:
    true,
};

export default function SettingsPage() {
  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<CurrentUser | null>(
      null
    );

  const [
    settings,
    setSettings,
  ] =
    useState<Settings>(
      initialSettings
    );

  const [
    schools,
    setSchools,
  ] =
    useState<School[]>([]);

  const [
    selectedSchoolId,
    setSelectedSchoolId,
  ] =
    useState("");

  const [
    logoFile,
    setLogoFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    logoPreview,
    setLogoPreview,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    logoSaving,
    setLogoSaving,
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

  /* ========================================================
     認証
     ======================================================== */

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

              name:
                typeof data.name ===
                "string"
                  ? data.name
                  : firebaseUser.displayName ??
                    "",

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

  /* ========================================================
     校舎取得
     ======================================================== */

  useEffect(() => {
    if (
      !currentUser?.organizationId
    ) {
      return;
    }

    void loadSchools(
      currentUser.organizationId
    );
  }, [
    currentUser?.organizationId,
  ]);

  async function loadSchools(
    organizationId: string
  ) {
    try {
      const snapshot =
        await getDocs(
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
        );

      const loaded =
        snapshot.docs.map(
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

              logoPath:
                typeof data.logoPath ===
                "string"
                  ? data.logoPath
                  : "",

              logoUrl:
                typeof data.logoUrl ===
                "string"
                  ? data.logoUrl
                  : "",

              active:
                data.active !==
                false,
            };
          }
        );

      setSchools(
        loaded
      );

      if (
        loaded.length > 0 &&
        !selectedSchoolId
      ) {
        const available =
          getAvailableSchools(
            loaded,
            currentUser
          );

        if (
          available.length > 0
        ) {
          setSelectedSchoolId(
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
    }
  }

  /* ========================================================
     設定更新
     ======================================================== */

  function updateSetting<
    K extends keyof Settings
  >(
    key: K,
    value: Settings[K]
  ) {
    setSettings(
      (current) => ({
        ...current,

        [key]:
          value,
      })
    );

    setMessage("");
  }

  /* ========================================================
     設定保存
     ======================================================== */

  async function saveSettings() {
    if (
      !currentUser?.organizationId
    ) {
      setError(
        "組織情報を確認できません。"
      );

      return;
    }

    if (
      currentUser.role !==
        "本部管理者" &&
      currentUser.role !==
        "校舎管理者"
    ) {
      setError(
        "設定を変更する権限がありません。"
      );

      return;
    }

    try {
      setSaving(true);

      setError("");
      setMessage("");

      /*
       * 現在の正式スキーマでは、
       * organizationSettingsを使用。
       */

      const settingsRef =
        doc(
          db,
          "organizations",
          currentUser.organizationId
        );

      await updateDoc(
        settingsRef,
        {
          settings: {
            ...settings,
          },

          updatedAt:
            serverTimestamp(),
        }
      );

      setMessage(
        "設定を保存しました。"
      );
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
      setSaving(false);
    }
  }

  /* ========================================================
     ロゴ選択
     ======================================================== */

  function handleLogoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "画像ファイルを選択してください。"
      );

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        "ロゴ画像は5MB以下にしてください。"
      );

      return;
    }

    setLogoFile(
      file
    );

    const url =
      URL.createObjectURL(
        file
      );

    setLogoPreview(
      url
    );

    setError("");
  }

  /* ========================================================
     ロゴアップロード
     ======================================================== */

  async function uploadLogo() {
    if (
      !currentUser?.organizationId
    ) {
      setError(
        "組織情報を確認できません。"
      );

      return;
    }

    if (
      !selectedSchoolId
    ) {
      setError(
        "校舎を選択してください。"
      );

      return;
    }

    if (!logoFile) {
      setError(
        "ロゴ画像を選択してください。"
      );

      return;
    }

    if (
      currentUser.role !==
        "本部管理者" &&
      currentUser.role !==
        "校舎管理者"
    ) {
      setError(
        "ロゴを変更する権限がありません。"
      );

      return;
    }

    try {
      setLogoSaving(true);

      setError("");
      setMessage("");

      if (!supabase) {
        throw new Error(
          "Storageに接続できません。"
        );
      }

      const extension =
        getImageExtension(
          logoFile
        );

      const path =
        `${currentUser.organizationId}/` +
        `${selectedSchoolId}/` +
        `logo.${extension}`;

      /*
       * 既存ロゴを上書き。
       */
      const uploadResult =
        await supabase.storage
          .from(
            SCHOOL_ASSETS_BUCKET
          )
          .upload(
            path,
            logoFile,
            {
              upsert:
                true,

              contentType:
                logoFile.type,

              cacheControl:
                "3600",
            }
          );

      if (
        uploadResult.error
      ) {
        console.error(
          uploadResult.error
        );

        throw new Error(
          "ロゴ画像を保存できませんでした。"
        );
      }

      /*
       * 現在はStorage URLを取得。
       *
       * bucketをPrivateにする場合は、
       * 後で署名URL方式へ変更する。
       */
      const publicResult =
        supabase.storage
          .from(
            SCHOOL_ASSETS_BUCKET
          )
          .getPublicUrl(
            path
          );

      const logoUrl =
        publicResult.data
          .publicUrl;

      /*
       * FirestoreにパスとURLを保存。
       */
      await updateDoc(
        doc(
          db,
          "schools",
          selectedSchoolId
        ),
        {
          logoPath:
            path,

          logoUrl,

          updatedAt:
            serverTimestamp(),
        }
      );

      setSchools(
        (current) =>
          current.map(
            (
              school
            ) =>
              school.id ===
              selectedSchoolId
                ? {
                    ...school,

                    logoPath:
                      path,

                    logoUrl,
                  }
                : school
          )
      );

      setLogoFile(
        null
      );

      setLogoPreview(
        logoUrl
      );

      setMessage(
        "塾ロゴを保存しました。"
      );
    } catch (err) {
      console.error(
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "ロゴを保存できませんでした。"
      );
    } finally {
      setLogoSaving(false);
    }
  }

  /* ========================================================
     選択校舎
     ======================================================== */

  const selectedSchool =
    schools.find(
      (
        school
      ) =>
        school.id ===
        selectedSchoolId
    );

  const availableSchools =
    getAvailableSchools(
      schools,
      currentUser
    );

  /* ========================================================
     権限
     ======================================================== */

  if (
    currentUser &&
    currentUser.role !==
      "本部管理者" &&
    currentUser.role !==
      "校舎管理者"
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
            設定
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
            1100,

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
            設定
          </h1>

          <p
            style={{
              margin: 0,

              color:
                "#666",
            }}
          >
            答案採点システムの基本設定を管理します。
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

        {/* ==================================================
            塾基本情報
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            塾基本情報
          </h2>

          <label
            style={
              labelStyle
            }
          >
            塾名

            <input
              value={
                settings.schoolName
              }
              onChange={(
                event
              ) =>
                updateSetting(
                  "schoolName",
                  event.target
                    .value
                )
              }
              style={
                inputStyle
              }
            />
          </label>

          <label
            style={
              labelStyle
            }
          >
            基準年度

            <input
              value={
                settings.defaultYear
              }
              onChange={(
                event
              ) =>
                updateSetting(
                  "defaultYear",
                  event.target
                    .value
                )
              }
              style={
                inputStyle
              }
            />
          </label>
        </section>

        {/* ==================================================
            校舎ロゴ
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            校舎ロゴ
          </h2>

          <p
            style={{
              color:
                "#666",

              fontSize:
                13,

              lineHeight:
                1.7,
            }}
          >
            QRシールの左上に表示するロゴを校舎ごとに管理します。
          </p>

          <label
            style={
              labelStyle
            }
          >
            校舎

            <select
              value={
                selectedSchoolId
              }
              onChange={(
                event
              ) => {
                setSelectedSchoolId(
                  event.target
                    .value
                );

                setLogoFile(
                  null
                );

                setLogoPreview(
                  ""
                );
              }}
              style={
                inputStyle
              }
            >
              <option value="">
                校舎を選択してください
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

          {selectedSchool && (
            <div
              style={{
                marginTop:
                  24,

                display:
                  "grid",

                gridTemplateColumns:
                  "220px 1fr",

                gap:
                  28,

                alignItems:
                  "start",
              }}
            >
              <div
                style={{
                  width:
                    220,

                  height:
                    140,

                  border:
                    "1px solid #ddd",

                  borderRadius:
                    10,

                  background:
                    "#fafafa",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  overflow:
                    "hidden",
                }}
              >
                {logoPreview ||
                selectedSchool.logoUrl ? (
                  <img
                    src={
                      logoPreview ||
                      selectedSchool.logoUrl
                    }
                    alt="校舎ロゴ"
                    style={{
                      maxWidth:
                        "90%",

                      maxHeight:
                        "90%",

                      objectFit:
                        "contain",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      color:
                        "#999",

                      fontSize:
                        13,
                    }}
                  >
                    ロゴ未登録
                  </span>
                )}
              </div>

              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  ロゴ画像

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={
                      handleLogoChange
                    }
                    style={{
                      display:
                        "block",

                      marginTop:
                        8,
                    }}
                  />
                </label>

                <p
                  style={{
                    marginTop:
                      12,

                    color:
                      "#777",

                    fontSize:
                      12,

                    lineHeight:
                      1.7,
                  }}
                >
                  PNG・JPEG・WebP・SVGに対応。
                  <br />
                  最大5MB。
                </p>

                <button
                  type="button"
                  disabled={
                    logoSaving ||
                    !logoFile
                  }
                  onClick={
                    uploadLogo
                  }
                  style={{
                    marginTop:
                      12,

                    padding:
                      "10px 18px",

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
                      logoSaving ||
                      !logoFile
                        ? "default"
                        : "pointer",

                    opacity:
                      logoSaving ||
                      !logoFile
                        ? 0.5
                        : 1,
                  }}
                >
                  {logoSaving
                    ? "保存中..."
                    : "ロゴを保存"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            生徒番号
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            生徒番号
          </h2>

          <div
            style={{
              padding:
                14,

              background:
                "#f7f7f7",

              borderRadius:
                8,
            }}
          >
            <strong>
              6桁
            </strong>

            <span
              style={{
                marginLeft:
                  12,

                color:
                  "#666",
              }}
            >
              数字のみで発行します。
            </span>
          </div>
        </section>

        {/* ==================================================
            答案・採点
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            答案・採点
          </h2>

          <SettingToggle
            label="答案アップロード直後に生徒が答案画像を見られる"
            checked={
              settings.answerUploadImmediatelyVisible
            }
            onChange={(
              value
            ) =>
              updateSetting(
                "answerUploadImmediatelyVisible",
                value
              )
            }
          />

          <SettingToggle
            label="採点前でもアップロード済み答案を詳細から表示する"
            checked={
              settings.allowStudentAnswerViewBeforeGrading
            }
            onChange={(
              value
            ) =>
              updateSetting(
                "allowStudentAnswerViewBeforeGrading",
                value
              )
            }
          />

          <SettingToggle
            label="二次確認を必須にする"
            checked={
              settings.requireSecondReview
            }
            onChange={(
              value
            ) =>
              updateSetting(
                "requireSecondReview",
                value
              )
            }
          />

          <SettingToggle
            label="問題別串刺し採点で生徒名・生徒番号を非表示にする"
            checked={
              settings.hideStudentIdentityInCrossSection
            }
            onChange={(
              value
            ) =>
              updateSetting(
                "hideStudentIdentityInCrossSection",
                value
              )
            }
          />
        </section>

        {/* ==================================================
            成績
            ================================================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2>
            成績
          </h2>

          <SettingToggle
            label="偏差値を使用する"
            checked={
              settings.enableDeviationScore
            }
            onChange={(
              value
            ) =>
              updateSetting(
                "enableDeviationScore",
                value
              )
            }
          />

          <SettingToggle
            label="順位を使用する"
            checked={
              settings.enableRanking
            }
            onChange={(
              value
            ) =>
              updateSetting(
                "enableRanking",
                value
              )
            }
          />

          <SettingToggle
            label="追試を使用する"
            checked={
              settings.enableRetest
            }
            onChange={(
              value
            ) =>
              updateSetting(
                "enableRetest",
                value
              )
            }
          />
        </section>

        {/* ==================================================
            保存
            ================================================== */}

        <section
          style={
            cardStyle
          }
        >
          <button
            type="button"
            disabled={
              saving
            }
            onClick={
              saveSettings
            }
            style={{
              padding:
                "12px 24px",

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
                saving
                  ? "default"
                  : "pointer",

              opacity:
                saving
                  ? 0.6
                  : 1,
            }}
          >
            {saving
              ? "保存中..."
              : "設定を保存"}
          </button>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   Toggle
   ========================================================= */

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;

  checked: boolean;

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
          "center",

        gap:
          10,

        padding:
          "13px 0",

        borderBottom:
          "1px solid #eee",

        cursor:
          "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={
          checked
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .checked
          )
        }
      />

      <span>
        {label}
      </span>
    </label>
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

function getImageExtension(
  file: File
) {
  switch (
    file.type
  ) {
    case "image/png":
      return "png";

    case "image/jpeg":
      return "jpg";

    case "image/webp":
      return "webp";

    case "image/svg+xml":
      return "svg";

    default:
      return "png";
  }
}

function getSafeErrorMessage(
  error: unknown
) {
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

    default:
      return "設定を保存できませんでした。";
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

    marginTop:
      18,

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
      "11px 12px",

    border:
      "1px solid #ccc",

    borderRadius:
      7,

    background:
      "#fff",
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
