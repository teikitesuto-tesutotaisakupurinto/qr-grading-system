"use client";

import {
  ChangeEvent,
  useState,
} from "react";

import SchoolHeader from "@/components/SchoolHeader";

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

const initialSettings: Settings = {
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

export default function SettingsPage() {
  const [
    settings,
    setSettings,
  ] =
    useState<Settings>(
      initialSettings
    );

  const [
    saved,
    setSaved,
  ] =
    useState(false);

  const [
    logoPreview,
    setLogoPreview,
  ] =
    useState(
      initialSettings.logoUrl
    );

  function update<
    K extends keyof Settings
  >(
    key: K,
    value: Settings[K]
  ) {
    setSettings(
      (current) => ({
        ...current,

        [key]: value,
      })
    );

    setSaved(false);
  }

  function handleLogoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
      ].includes(
        file.type
      )
    ) {
      alert(
        "PNG・JPG・WebPの画像を選択してください。"
      );

      event.target.value =
        "";

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      alert(
        "ロゴ画像は5MB以下にしてください。"
      );

      event.target.value =
        "";

      return;
    }

    const url =
      URL.createObjectURL(
        file
      );

    setLogoPreview(
      url
    );

    update(
      "logoUrl",
      url
    );
  }

  function removeLogo() {
    setLogoPreview("");

    update(
      "logoUrl",
      ""
    );
  }

  function saveSettings() {
    /*
     * 現在は画面上の設定を保持する段階。
     *
     * 次の段階で、
     *
     * Firestore
     * ↓
     * systemSettings
     *
     * へ正式保存します。
     */

    setSaved(
      true
    );
  }

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
              marginTop: 16,
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
              color: "#666",

              lineHeight:
                1.7,
            }}
          >
            QRシール発行シートの左上に表示するロゴです。
          </p>

          {logoPreview ? (
            <div
              style={{
                marginTop:
                  16,

                display:
                  "flex",

                alignItems:
                  "center",

                gap: 20,
              }}
            >
              <div
                style={{
                  width:
                    220,

                  height:
                    90,

                  border:
                    "1px solid #ddd",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  background:
                    "#fff",

                  overflow:
                    "hidden",
                }}
              >
                <img
                  src={
                    logoPreview
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
                  220,

                height:
                  90,

                border:
                  "1px dashed #bbb",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

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
                "pointer",
            }}
          >
            ロゴ画像を選択

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={
                handleLogoChange
              }
            />
          </label>

          <p
            style={{
              marginTop:
                10,

              fontSize:
                13,

              color:
                "#777",
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
            保存
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
            onClick={
              saveSettings
            }
          >
            設定を保存
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
