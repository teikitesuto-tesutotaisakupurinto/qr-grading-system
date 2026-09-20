"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";

type StudentPreview = {
  id: string;
  name: string;
  currentGrade: string;
  nextGrade: string;
  currentClass: string;
  nextClass: string;
  status: "在籍" | "卒業";
};

const demoStudents: StudentPreview[] = [
  {
    id: "583214",
    name: "山田 太郎",
    currentGrade: "中学1年",
    nextGrade: "中学2年",
    currentClass: "1TZ",
    nextClass: "未設定",
    status: "在籍",
  },
  {
    id: "741928",
    name: "佐藤 花子",
    currentGrade: "中学2年",
    nextGrade: "中学3年",
    currentClass: "2TZ",
    nextClass: "未設定",
    status: "在籍",
  },
  {
    id: "316507",
    name: "鈴木 一郎",
    currentGrade: "中学3年",
    nextGrade: "卒業",
    currentClass: "3TZ",
    nextClass: "—",
    status: "卒業",
  },
];

function advanceGrade(
  grade: string
): string {
  const map: Record<
    string,
    string
  > = {
    小学1年: "小学2年",
    小学2年: "小学3年",
    小学3年: "小学4年",
    小学4年: "小学5年",
    小学5年: "小学6年",
    小学6年: "中学1年",
    中学1年: "中学2年",
    中学2年: "中学3年",
    中学3年: "卒業",
    高校1年: "高校2年",
    高校2年: "高校3年",
    高校3年: "卒業",
  };

  return map[grade] ?? grade;
}

export default function YearUpdatePage() {
  const currentYear = 2026;
  const nextYear = currentYear + 1;

  const [students, setStudents] =
    useState(demoStudents);

  const [newClasses, setNewClasses] =
    useState<
      Record<string, string>
    >({});

  const [confirmed, setConfirmed] =
    useState(false);

  const [updating, setUpdating] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const preview = useMemo(
    () =>
      students.map((student) => ({
        ...student,
        nextGrade:
          student.status ===
          "卒業"
            ? "卒業"
            : advanceGrade(
                student.currentGrade
              ),
      })),
    [students]
  );

  function updateClass(
    studentId: string,
    value: string
  ) {
    setNewClasses((current) => ({
      ...current,
      [studentId]: value,
    }));
  }

  function prepareUpdate() {
    setConfirmed(true);
    setMessage(
      "年度更新内容を確認しました。"
    );
  }

  async function executeUpdate() {
    setUpdating(true);
    setMessage("");

    /*
      本番ではCloud Functionsで
      全在籍生徒をトランザクション単位で更新します。

      生徒番号：
      変更しない

      QR：
      変更しない

      過去年度：
      保持する

      学年：
      1つ上げる

      新年度クラス：
      CSV等で後から反映可能
    */

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 700)
    );

    setStudents((current) =>
      current.map((student) => {
        if (
          student.status ===
          "卒業"
        ) {
          return student;
        }

        return {
          ...student,
          currentGrade:
            advanceGrade(
              student.currentGrade
            ),
          currentClass:
            newClasses[
              student.id
            ] ??
            "未設定",
        };
      })
    );

    setUpdating(false);
    setConfirmed(false);

    setMessage(
      `${nextYear}年度への年度更新が完了しました。`
    );
  }

  return (
    <main className="page">
      <SchoolHeader title="年度更新" />

      <section className="content">
        <div className="pageHeader">
          <div>
            <h1>
              年度更新
            </h1>

            <p>
              年度が変わったときに学年を自動更新します。
            </p>
          </div>
        </div>

        <section className="stepCard">
          <h2>
            年度
          </h2>

          <div className="totalGrid">
            <div>
              <span>
                現在年度
              </span>

              <strong>
                {currentYear}
                年度
              </strong>
            </div>

            <div>
              <span>
                更新後
              </span>

              <strong>
                {nextYear}
                年度
              </strong>
            </div>
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            更新ルール
          </h2>

          <div className="listCard">
            <div className="listRow">
              <strong>
                学年
              </strong>

              <span>
                自動的に1学年上げる
              </span>

              <span>
                自動
              </span>
            </div>

            <div className="listRow">
              <strong>
                生徒番号
              </strong>

              <span>
                現在の番号を維持
              </span>

              <span>
                変更なし
              </span>
            </div>

            <div className="listRow">
              <strong>
                QRコード
              </strong>

              <span>
                現在のQRを維持
              </span>

              <span>
                変更なし
              </span>
            </div>

            <div className="listRow">
              <strong>
                過去成績
              </strong>

              <span>
                過去年度データを保持
              </span>

              <span>
                変更なし
              </span>
            </div>

            <div className="listRow">
              <strong>
                新年度クラス
              </strong>

              <span>
                CSV等で更新可能
              </span>

              <span>
                手動反映
              </span>
            </div>
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            更新プレビュー
          </h2>

          <div className="studentTable">
            <div className="studentRow headerRow">
              <div>
                生徒番号
              </div>

              <div>
                氏名
              </div>

              <div>
                現在学年
              </div>

              <div>
                更新後
              </div>

              <div>
                新年度クラス
              </div>

              <div>
                状態
              </div>
            </div>

            {preview.map(
              (student) => (
                <div
                  className="studentRow"
                  key={student.id}
                >
                  <div>
                    {student.id}
                  </div>

                  <div>
                    {student.name}
                  </div>

                  <div>
                    {
                      student.currentGrade
                    }
                  </div>

                  <div>
                    {
                      student.nextGrade
                    }
                  </div>

                  <div>
                    {student.status ===
                    "卒業" ? (
                      "—"
                    ) : (
                      <input
                        value={
                          newClasses[
                            student.id
                          ] ??
                          student.nextClass
                        }
                        onChange={(
                          event
                        ) =>
                          updateClass(
                            student.id,
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="新年度クラス"
                      />
                    )}
                  </div>

                  <div>
                    {
                      student.status
                    }
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {message && (
          <div
            className="selectionPanel"
            style={{
              marginTop: 20,
            }}
          >
            {message}
          </div>
        )}

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          {!confirmed ? (
            <button
              type="button"
              className="primaryButton"
              onClick={
                prepareUpdate
              }
            >
              年度更新内容を確認
            </button>
          ) : (
            <div>
              <div className="formError">
                年度更新を実行すると、
                学年が一括更新されます。
                生徒番号・QR・過去成績は変更されません。
              </div>

              <div className="actionBar">
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() =>
                    setConfirmed(
                      false
                    )
                  }
                >
                  戻る
                </button>

                <button
                  type="button"
                  className="primaryButton"
                  disabled={
                    updating
                  }
                  onClick={
                    executeUpdate
                  }
                >
                  {updating
                    ? "年度更新中..."
                    : `${nextYear}年度へ更新`}
                </button>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
