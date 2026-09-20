"use client";

import { useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";

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
  allowStudentAnswerViewBeforeGrading: true,
  requireSecondReview: true,
  hideStudentIdentityInCrossSection: true,
  enableDeviationScore: true,
  enableRanking: true,
  enableRetest: true,
  answerUploadImmediatelyVisible: true,
};

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<Settings>(
      initialSettings
    );

  const [saved, setSaved] =
    useState(false);

  function update<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setSaved(false);
  }

  function saveSettings() {
    /*
      本番では Firestore の
      systemSettings ドキュメントへ保存します。
    */

    setSaved(true);
  }

  return (
    <main className="page">
      <SchoolHeader title="設定" />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>設定</h1>

            <p>
              システム全体の基本設定を管理します。
            </p>
          </div>
        </div>

        <section className="stepCard">
          <h2>
            塾基本情報
          </h2>

          <label>
            塾名

            <input
              value={settings.schoolName}
              onChange={(event) =>
                update(
                  "schoolName",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            右上ロゴ表示名

            <input
              value={settings.logoText}
              onChange={(event) =>
                update(
                  "logoText",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            基準年度

            <input
              value={settings.defaultYear}
              onChange={(event) =>
                update(
                  "defaultYear",
                  event.target.value
                )
              }
            />
          </label>
        </section>

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
              {settings.studentNumberDigits}
              桁
            </span>
          </div>

          <p>
            生徒番号はランダム6桁・数字のみで発行します。
          </p>
        </section>

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
            onChange={(value) =>
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
            onChange={(value) =>
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
            onChange={(value) =>
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
            onChange={(value) =>
              update(
                "hideStudentIdentityInCrossSection",
                value
              )
            }
          />
        </section>

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
            onChange={(value) =>
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
            onChange={(value) =>
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
            onChange={(value) =>
              update(
                "enableRetest",
                value
              )
            }
          />
        </section>

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
            onClick={saveSettings}
          >
            設定を保存
          </button>

          {saved && (
            <p
              style={{
                marginTop: 12,
                color: "#555",
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
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 0",
        cursor: "pointer",
        borderBottom:
          "1px solid #eee",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
      />

      <span>
        {label}
      </span>
    </label>
  );
}
