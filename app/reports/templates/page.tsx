"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";

type Orientation = "portrait" | "landscape";

type ReportSettings = {
  showStudentName: boolean;
  showStudentNumber: boolean;
  showTestName: boolean;
  showTestDate: boolean;
  showSubjectScore: boolean;
  showPercentage: boolean;
  showDeviationScore: boolean;
  showSections: boolean;
  showRubrics: boolean;
  showOverallRank: boolean;
  showSchoolRank: boolean;
  showGradeRank: boolean;
  showClassRank: boolean;
  showSubjectRank: boolean;
};

const defaultSettings: ReportSettings = {
  showStudentName: true,
  showStudentNumber: true,
  showTestName: true,
  showTestDate: true,
  showSubjectScore: true,
  showPercentage: true,
  showDeviationScore: true,
  showSections: true,
  showRubrics: true,
  showOverallRank: true,
  showSchoolRank: true,
  showGradeRank: true,
  showClassRank: true,
  showSubjectRank: false,
};

export default function ReportTemplatesPage() {
  const [templateName, setTemplateName] =
    useState("通常テスト用");

  const [orientation, setOrientation] =
    useState<Orientation>("portrait");

  const [logoText, setLogoText] =
    useState("塾ロゴ");

  const [settings, setSettings] =
    useState<ReportSettings>(
      defaultSettings
    );

  const [saved, setSaved] =
    useState(false);

  const enabledItems = useMemo(
    () =>
      Object.values(settings).filter(
        Boolean
      ).length,
    [settings]
  );

  function updateSetting(
    key: keyof ReportSettings
  ) {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));

    setSaved(false);
  }

  function saveTemplate() {
    /*
      本番では lib/reports.ts を使用して
      Firestoreの
      gradeReportTemplates
      に保存します。
    */

    setSaved(true);
  }

  return (
    <main className="page">
      <SchoolHeader
        title="成績表デザイン"
      />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>
              成績表デザイン
            </h1>

            <p>
              成績表のレイアウトと表示項目を設定します。
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "360px minmax(0, 1fr)",
            gap: 24,
          }}
        >
          <section className="stepCard">
            <h2>
              基本設定
            </h2>

            <label>
              テンプレート名

              <input
                value={templateName}
                onChange={(event) => {
                  setTemplateName(
                    event.target.value
                  );
                  setSaved(false);
                }}
              />
            </label>

            <label>
              用紙

              <select
                value={orientation}
                onChange={(event) => {
                  setOrientation(
                    event.target
                      .value as Orientation
                  );
                  setSaved(false);
                }}
              >
                <option value="portrait">
                  A4縦
                </option>

                <option value="landscape">
                  A4横
                </option>
              </select>
            </label>

            <label>
              右上ロゴ

              <input
                value={logoText}
                onChange={(event) => {
                  setLogoText(
                    event.target.value
                  );
                  setSaved(false);
                }}
                placeholder="塾ロゴ"
              />
            </label>

            <h3>
              表示項目
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <SettingRow
                label="生徒名"
                checked={
                  settings.showStudentName
                }
                onChange={() =>
                  updateSetting(
                    "showStudentName"
                  )
                }
              />

              <SettingRow
                label="生徒番号"
                checked={
                  settings.showStudentNumber
                }
                onChange={() =>
                  updateSetting(
                    "showStudentNumber"
                  )
                }
              />

              <SettingRow
                label="テスト名"
                checked={
                  settings.showTestName
                }
                onChange={() =>
                  updateSetting(
                    "showTestName"
                  )
                }
              />

              <SettingRow
                label="実施日"
                checked={
                  settings.showTestDate
                }
                onChange={() =>
                  updateSetting(
                    "showTestDate"
                  )
                }
              />

              <SettingRow
                label="教科別得点"
                checked={
                  settings.showSubjectScore
                }
                onChange={() =>
                  updateSetting(
                    "showSubjectScore"
                  )
                }
              />

              <SettingRow
                label="得点率"
                checked={
                  settings.showPercentage
                }
                onChange={() =>
                  updateSetting(
                    "showPercentage"
                  )
                }
              />

              <SettingRow
                label="偏差値"
                checked={
                  settings.showDeviationScore
                }
                onChange={() =>
                  updateSetting(
                    "showDeviationScore"
                  )
                }
              />

              <SettingRow
                label="大問別得点"
                checked={
                  settings.showSections
                }
                onChange={() =>
                  updateSetting(
                    "showSections"
                  )
                }
              />

              <SettingRow
                label="観点別"
                checked={
                  settings.showRubrics
                }
                onChange={() =>
                  updateSetting(
                    "showRubrics"
                  )
                }
              />

              <SettingRow
                label="全校順位"
                checked={
                  settings.showOverallRank
                }
                onChange={() =>
                  updateSetting(
                    "showOverallRank"
                  )
                }
              />

              <SettingRow
                label="校舎順位"
                checked={
                  settings.showSchoolRank
                }
                onChange={() =>
                  updateSetting(
                    "showSchoolRank"
                  )
                }
              />

              <SettingRow
                label="学年順位"
                checked={
                  settings.showGradeRank
                }
                onChange={() =>
                  updateSetting(
                    "showGradeRank"
                  )
                }
              />

              <SettingRow
                label="クラス順位"
                checked={
                  settings.showClassRank
                }
                onChange={() =>
                  updateSetting(
                    "showClassRank"
                  )
                }
              />

              <SettingRow
                label="教科別順位"
                checked={
                  settings.showSubjectRank
                }
                onChange={() =>
                  updateSetting(
                    "showSubjectRank"
                  )
                }
              />
            </div>

            <div
              className="selectionPanel"
              style={{
                marginTop: 20,
              }}
            >
              表示項目：
              {enabledItems}項目
            </div>

            <button
              type="button"
              className="primaryButton"
              style={{
                width: "100%",
              }}
              onClick={
                saveTemplate
              }
            >
              テンプレートを保存
            </button>

            {saved && (
              <p
                style={{
                  marginTop: 12,
                  color: "#555",
                }}
              >
                保存しました。
              </p>
            )}
          </section>

          <section>
            <div className="gradeReport">
              <div
                className="gradeReportHeader"
              >
                <div>
                  <h1>
                    成績表
                  </h1>
                </div>

                <div
                  style={{
                    textAlign: "right",
                  }}
                >
                  <strong>
                    {logoText ||
                      "塾ロゴ"}
                  </strong>

                  {settings.showTestName && (
                    <div>
                      第1回確認テスト
                    </div>
                  )}

                  {settings.showTestDate && (
                    <div>
                      2026/09/24
                    </div>
                  )}
                </div>
              </div>

              {(settings.showStudentName ||
                settings.showStudentNumber) && (
                <div className="studentInfo">
                  {settings.showStudentName && (
                    <div>
                      <span>
                        氏名
                      </span>
                      <strong>
                        山田 太郎
                      </strong>
                    </div>
                  )}

                  {settings.showStudentNumber && (
                    <div>
                      <span>
                        生徒番号
                      </span>
                      <strong>
                        583214
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {settings.showSubjectScore && (
                <section>
                  <h2>
                    教科別成績
                  </h2>

                  <table>
                    <thead>
                      <tr>
                        <th>
                          教科
                        </th>

                        <th>
                          得点
                        </th>

                        {settings.showPercentage && (
                          <th>
                            得点率
                          </th>
                        )}

                        {settings.showDeviationScore && (
                          <th>
                            偏差値
                          </th>
                        )}

                        {settings.showSubjectRank && (
                          <th>
                            順位
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td>
                          国語
                        </td>
                        <td>
                          34 / 50
                        </td>

                        {settings.showPercentage && (
                          <td>
                            68.0%
                          </td>
                        )}

                        {settings.showDeviationScore && (
                          <td>
                            52.4
                          </td>
                        )}

                        {settings.showSubjectRank && (
                          <td>
                            52位
                          </td>
                        )}
                      </tr>

                      <tr>
                        <td>
                          数学
                        </td>
                        <td>
                          42 / 50
                        </td>

                        {settings.showPercentage && (
                          <td>
                            84.0%
                          </td>
                        )}

                        {settings.showDeviationScore && (
                          <td>
                            58.7
                          </td>
                        )}

                        {settings.showSubjectRank && (
                          <td>
                            21位
                          </td>
                        )}
                      </tr>

                      <tr>
                        <td>
                          英語
                        </td>
                        <td>
                          40 / 50
                        </td>

                        {settings.showPercentage && (
                          <td>
                            80.0%
                          </td>
                        )}

                        {settings.showDeviationScore && (
                          <td>
                            56.9
                          </td>
                        )}

                        {settings.showSubjectRank && (
                          <td>
                            28位
                          </td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </section>
              )}

              {settings.showSections && (
                <section
                  style={{
                    marginTop: 24,
                  }}
                >
                  <h2>
                    大問別
                  </h2>

                  <table>
                    <thead>
                      <tr>
                        <th>
                          大問
                        </th>
                        <th>
                          得点
                        </th>
                        <th>
                          得点率
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td>
                          大問1
                        </td>
                        <td>
                          8 / 10
                        </td>
                        <td>
                          80.0%
                        </td>
                      </tr>

                      <tr>
                        <td>
                          大問2
                        </td>
                        <td>
                          12 / 15
                        </td>
                        <td>
                          80.0%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              )}

              {settings.showRubrics && (
                <section
                  style={{
                    marginTop: 24,
                  }}
                >
                  <h2>
                    観点別
                  </h2>

                  <table>
                    <thead>
                      <tr>
                        <th>
                          観点
                        </th>
                        <th>
                          得点
                        </th>
                        <th>
                          得点率
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td>
                          知識・技能
                        </td>
                        <td>
                          18 / 25
                        </td>
                        <td>
                          72.0%
                        </td>
                      </tr>

                      <tr>
                        <td>
                          思考・判断・表現
                        </td>
                        <td>
                          16 / 20
                        </td>
                        <td>
                          80.0%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              )}

              {(settings.showOverallRank ||
                settings.showSchoolRank ||
                settings.showGradeRank ||
                settings.showClassRank) && (
                <section
                  style={{
                    marginTop: 24,
                  }}
                >
                  <h2>
                    順位
                  </h2>

                  <div className="rankGrid">
                    {settings.showOverallRank && (
                      <div>
                        <span>
                          全校
                        </span>
                        <strong>
                          38位
                        </strong>
                      </div>
                    )}

                    {settings.showSchoolRank && (
                      <div>
                        <span>
                          校舎
                        </span>
                        <strong>
                          7位
                        </strong>
                      </div>
                    )}

                    {settings.showGradeRank && (
                      <div>
                        <span>
                          学年
                        </span>
                        <strong>
                          12位
                        </strong>
                      </div>
                    )}

                    {settings.showClassRank && (
                      <div>
                        <span>
                          クラス
                        </span>
                        <strong>
                          3位
                        </strong>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

type SettingRowProps = {
  label: string;
  checked: boolean;
  onChange: () => void;
};

function SettingRow({
  label,
  checked,
  onChange,
}: SettingRowProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontWeight: 400,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />

      <span>
        {label}
      </span>
    </label>
  );
}
