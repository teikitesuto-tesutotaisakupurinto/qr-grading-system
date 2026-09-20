"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import SchoolHeader from "@/components/SchoolHeader";

import {
  db,
} from "@/lib/firebase";

import {
  getCurrentUser,
  type AppUser,
} from "@/lib/auth";

import {
  getSupabase,
} from "@/lib/supabase";

/* =========================================================
   Settings
   ========================================================= */

type Settings = {
  schoolName: string;

  logoText: string;

  logoUrl: string;

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

const defaultSettings: Settings = {
  schoolName: "○○塾",

  logoText: "塾ロゴ",

  logoUrl: "",

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

/* =========================================================
   Page
   ========================================================= */

export default function SettingsPage() {
  const [
    user,
    setUser,
  ] = useState<AppUser | null>(
    null
  );

  const [
    settings,
    setSettings,
  ] = useState<Settings>(
    defaultSettings
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
    uploadingLogo,
    setUploadingLogo,
  ] = useState(false);

  const [
    saved,
    setSaved,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     schoolId
     ======================================================= */

  const schoolId =
    user?.schoolIds?.[0] ??
    "";

  /* =======================================================
     初期読み込み
     ======================================================= */

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      try {
        setLoading(true);

        setError("");

        const currentUser =
          await getCurrentUser();

        if (cancelled) {
          return;
        }

        if (!currentUser) {
          throw new Error(
            "ログインしてください。"
          );
        }

        setUser(
          currentUser
        );

        const currentSchoolId =
          currentUser.schoolIds?.[0] ??
          "";

        if (!currentSchoolId) {
          throw new Error(
            "所属校舎が設定されていません。"
          );
        }

        const schoolSnapshot =
          await getDoc(
            doc(
              db,
              "schools",
              currentSchoolId
            )
          );

        if (
          schoolSnapshot.exists()
        ) {
          const data =
            schoolSnapshot.data();

          const savedSettings =
            data.settings;

          setSettings({
            ...defaultSettings,

            schoolName:
              typeof data.name ===
              "string"
                ? data.name
                : defaultSettings.schoolName,

            logoText:
              typeof data.logoText ===
              "string"
                ? data.logoText
                : defaultSettings.logoText,

            logoUrl:
              typeof data.logoUrl ===
              "string"
                ? data.logoUrl
                : defaultSettings.logoUrl,

            ...(savedSettings &&
            typeof savedSettings ===
              "object"
              ? savedSettings
              : {}),
          });

          return;
        }

        setSettings(
          defaultSettings
        );
      } catch (
        err
      ) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "設定を読み込めませんでした。"
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

  /* =======================================================
     Update
     ======================================================= */

  function update<
    K extends keyof Settings
  >(
    key: K,
    value: Settings[K]
  ) {
    setSettings(
      (
        current
      ) => ({
        ...current,

        [key]: value,
      })
    );

    setSaved(false);
  }

  /* =======================================================
     Logo upload
     ======================================================= */

  async function handleLogoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value =
      "";

    if (!file) {
      return;
    }

    if (!schoolId) {
      setError(
        "所属校舎が設定されていません。"
      );

      return;
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      setError(
        "PNG・JPG・WebPのみ使用できます。"
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

    try {
      setUploadingLogo(
        true
      );

      setError("");

      setSaved(false);

      const supabase =
        getSupabase();

      const extension =
        file.type ===
        "image/png"
          ? "png"
          : file.type ===
            "image/webp"
          ? "webp"
          : "jpg";

      const path =
        `${schoolId}/logo.${extension}`;

      const upload =
        await supabase.storage
          .from(
            "school-assets"
          )
          .upload(
            path,
            file,
            {
              upsert:
                true,

              contentType:
                file.type,

              cacheControl:
                "3600",
            }
          );

      if (
        upload.error
      ) {
        throw new Error(
          `ロゴのアップロードに失敗しました: ${upload.error.message}`
        );
      }

      const publicUrl =
        supabase.storage
          .from(
            "school-assets"
          )
          .getPublicUrl(
            path
          )
          .data
          .publicUrl;

      setSettings(
        (
          current
        ) => ({
          ...current,

          logoUrl:
            publicUrl,
        })
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "ロゴのアップロードに失敗しました。"
      );
    } finally {
      setUploadingLogo(
        false
      );
    }
  }

  /* =======================================================
     Logo delete
     ======================================================= */

  async function removeLogo() {
    if (!schoolId) {
      return;
    }

    try {
      setUploadingLogo(
        true
      );

      setError("");

      const supabase =
        getSupabase();

      await supabase.storage
        .from(
          "school-assets"
        )
        .remove([
          `${schoolId}/logo.png`,
          `${schoolId}/logo.jpg`,
          `${schoolId}/logo.webp`,
        ]);

      setSettings(
        (
          current
        ) => ({
          ...current,

          logoUrl: "",
        })
      );

      setSaved(false);
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "ロゴの削除に失敗しました。"
      );
    } finally {
      setUploadingLogo(
        false
      );
    }
  }

  /* =======================================================
     Save
     ======================================================= */

  async function saveSettings() {
    if (!schoolId) {
      setError(
        "所属校舎が設定されていません。"
      );

      return;
    }

    try {
      setSaving(true);

      setSaved(false);

      setError("");

      await setDoc(
        doc(
          db,
          "schools",
          schoolId
        ),
        {
          name:
            settings.schoolName,

          logoText:
            settings.logoText,

          logoUrl:
            settings.logoUrl,

          settings: {
            defaultYear:
              settings.defaultYear,

            studentNumberDigits:
              settings.studentNumberDigits,

            allowStudentAnswerViewBeforeGrading:
              settings.allowStudentAnswerViewBeforeGrading,

            requireSecondReview:
              settings.requireSecondReview,

            hideStudentIdentityInCrossSection:
              settings.hideStudentIdentityInCrossSection,

            enableDeviationScore:
              settings.enableDeviationScore,

            enableRanking:
              settings.enableRanking,

            enableRetest:
              settings.enableRetest,

            answerUploadImmediatelyVisible:
              settings.answerUploadImmediatelyVisible,
          },

          updatedAt:
            serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );

      setSaved(true);
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "設定の保存に失敗しました。"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     Loading
     ======================================================= */

  if (loading) {
    return (
      <main className="page">
        <SchoolHeader
          title="設定"
        />

        <section className="content">
          <div className="stepCard">
            設定を読み込んでいます...
          </div>
        </section>
      </main>
    );
  }

  /* =======================================================
     Render
     ======================================================= */

  return (
    <main className="page">
      <SchoolHeader
        title="設定"
      />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>
              設定
            </h1>

            <p>
              システム全体の基本設定を管理します。
            </p>
          </div>
        </div>

        {error && (
          <div
            className="selectionPanel"
            style={{
              marginBottom:
                20,
            }}
          >
            {error}
          </div>
        )}

        {/* =================================================
            塾基本情報
            ================================================= */}

        <section className="stepCard">
          <h2>
            塾基本情報
          </h2>

          <label>
            塾名

            <input
              value={
                settings.schoolName
              }
              onChange={(
                event
              ) =>
                update(
                  "schoolName",
                  event.target
                    .value
                )
              }
            />
          </label>

          <label
            style={{
              display:
                "block",

              marginTop:
                16,
            }}
          >
            ロゴ表示名

            <input
              value={
                settings.logoText
              }
              onChange={(
                event
              ) =>
                update(
                  "logoText",
                  event.target
                    .value
                )
              }
            />
          </label>

          <label
            style={{
              display:
                "block",

              marginTop:
                16,
            }}
          >
            基準年度

            <input
              value={
                settings.defaultYear
              }
              onChange={(
                event
              ) =>
                update(
                  "defaultYear",
                  event.target
                    .value
                )
              }
            />
          </label>
        </section>

        {/* =================================================
            塾ロゴ
            ================================================= */}

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            塾ロゴ
          </h2>

          <p
            style={{
              color:
                "#666",

              lineHeight:
                1.7,
            }}
          >
            QRシール発行シートの左上に表示するロゴです。
          </p>

          {settings.logoUrl ? (
            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap: 20,

                marginTop:
                  16,
              }}
            >
              <div
                style={{
                  width:
                    240,

                  height:
                    100,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  border:
                    "1px solid #ddd",

                  background:
                    "#fff",

                  overflow:
                    "hidden",
                }}
              >
                <img
                  src={
                    settings.logoUrl
                  }
                  alt="塾ロゴ"
                  style={{
                    maxWidth:
                      "100%",

                    maxHeight:
                      "100%",

                    objectFit:
                      "contain",
                  }}
                />
              </div>

              <button
                type="button"
                className="secondaryButton"
                disabled={
                  uploadingLogo
                }
                onClick={
                  removeLogo
                }
              >
                ロゴを削除
              </button>
            </div>
          ) : (
            <div
              style={{
                marginTop:
                  16,

                width:
                  240,

                height:
                  100,

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                border:
                  "1px dashed #aaa",

                color:
                  "#777",
              }}
            >
              ロゴ未登録
            </div>
          )}

          <label
            className="secondaryButton"
            style={{
              display:
                "inline-block",

              marginTop:
                16,

              cursor:
                uploadingLogo
                  ? "default"
                  : "pointer",

              opacity:
                uploadingLogo
                  ? 0.6
                  : 1,
            }}
          >
            {uploadingLogo
              ? "処理中..."
              : "ロゴ画像を選択"}

            <input
              type="file"
              hidden
              disabled={
                uploadingLogo
              }
              accept="image/png,image/jpeg,image/webp"
              onChange={
                handleLogoChange
              }
            />
          </label>

          <p
            style={{
              marginTop:
                10,

              color:
                "#777",

              fontSize:
                13,
            }}
          >
            PNG・JPG・WebP / 5MB以下
          </p>
        </section>

        {/* =================================================
            生徒番号
            ================================================= */}

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            生徒番号
          </h2>

          <div className="selectionPanel">
            <strong>
              桁数
            </strong>

            <span>
              {
                settings.studentNumberDigits
              }
              桁
            </span>
          </div>

          <p>
            生徒番号は6桁の数字で管理します。
          </p>
        </section>

        {/* =================================================
            答案・採点
            ================================================= */}

        <section
          className="stepCard"
          style={{
            marginTop: 20,
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
              update(
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
              update(
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
              update(
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
              update(
                "hideStudentIdentityInCrossSection",
                value
              )
            }
          />
        </section>

        {/* =================================================
            成績
            ================================================= */}

        <section
          className="stepCard"
          style={{
            marginTop: 20,
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
              update(
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
              update(
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
              update(
                "enableRetest",
                value
              )
            }
          />
        </section>

        {/* =================================================
            Save
            ================================================= */}

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            保存
          </h2>

          <button
            type="button"
            className="primaryButton"
            disabled={
              saving ||
              uploadingLogo
            }
            onClick={
              saveSettings
            }
          >
            {saving
              ? "保存中..."
              : "設定を保存"}
          </button>

          {saved && (
            <p
              style={{
                marginTop:
                  12,

                color:
                  "#555",
              }}
            >
              設定を保存しました。
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

/* =========================================================
   Toggle
   ========================================================= */

type SettingToggleProps = {
  label: string;

  checked: boolean;

  onChange: (
    value: boolean
  ) => void;
};

function SettingToggle({
  label,
  checked,
  onChange,
}: SettingToggleProps) {
  return (
    <label
      style={{
        display:
          "flex",

        alignItems:
          "center",

        gap: 10,

        padding:
          "12px 0",

        cursor:
          "pointer",

        borderBottom:
          "1px solid #eee",
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
