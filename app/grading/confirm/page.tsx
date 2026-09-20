"use client";

import { useMemo, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";
import StepBar from "@/components/StepBar";

type CheckItem = {
  id: string;
  label: string;
  count: number;
  required: boolean;
};

const initialChecks: CheckItem[] = [
  {
    id: "ungraded",
    label: "未採点答案",
    count: 0,
    required: true,
  },
  {
    id: "first-review",
    label: "一次確認未完了",
    count: 0,
    required: true,
  },
  {
    id: "second-review",
    label: "二次確認未完了",
    count: 0,
    required: true,
  },
  {
    id: "partial-score",
    label: "△の部分点未入力",
    count: 0,
    required: true,
  },
  {
    id: "grading-error",
    label: "採点エラー",
    count: 0,
    required: true,
  },
  {
    id: "score-error",
    label: "合計点不整合",
    count: 0,
    required: true,
  },
];

export default function GradingConfirmPage() {
  const [checks, setChecks] =
    useState(initialChecks);

  const [confirmed, setConfirmed] =
    useState(false);

  const [confirming, setConfirming] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const hasError = useMemo(
    () =>
      checks.some(
        (item) =>
          item.required &&
          item.count > 0
      ),
    [checks]
  );

  const completed =
    checks.every(
      (item) => item.count === 0
    );

  async function runFinalCheck() {
    setConfirming(true);
    setMessage("");

    /*
      本番ではここでCloud Functions側に
      最終採点チェックを依頼します。
    */

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 500)
    );

    setChecks((current) =>
      current.map((item) => ({
        ...item,
        count: 0,
      }))
    );

    setConfirming(false);

    setMessage(
      "最終チェックが完了しました。"
    );
  }

  function confirmGrading() {
    if (hasError) {
      setMessage(
        "未解決のエラーがあるため、採点を確定できません。"
      );

      return;
    }

    setConfirmed(true);

    setMessage(
      "採点を確定しました。"
    );
  }

  return (
    <main className="page">
      <SchoolHeader
        title="採点確定"
      />

      <section className="content">
        <StepBar currentStep={7} />

        <div className="pageHeader">
          <div>
            <h1>
              採点確定
            </h1>

            <p>
              テスト公開前の最終確認です。
            </p>
          </div>
        </div>

        {message && (
          <div className="selectionPanel">
            {message}
          </div>
        )}

        <section className="stepCard">
          <h2>
            最終チェック
          </h2>

          <div className="listCard">
            {checks.map(
              (item) => {
                const ok =
                  item.count === 0;

                return (
                  <div
                    key={item.id}
                    className="listRow"
                  >
                    <strong>
                      {item.label}
                    </strong>

                    <span>
                      {item.count}
                      件
                    </span>

                    <span>
                      {ok
                        ? "問題なし"
                        : "要確認"}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          <div
            className="actionBar"
            style={{
              marginTop: 20,
            }}
          >
            <button
              type="button"
              className="secondaryButton"
              disabled={
                confirming ||
                confirmed
              }
              onClick={
                runFinalCheck
              }
            >
              {confirming
                ? "チェック中..."
                : "最終チェックを実行"}
            </button>
          </div>
        </section>

        <section
          className="stepCard"
          style={{
            marginTop: 20,
          }}
        >
          <h2>
            確定前確認
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <div className="selectionPanel">
              <strong>
                一次確認
              </strong>

              <p>
                完了
              </p>
            </div>

            <div className="selectionPanel">
              <strong>
                二次確認
              </strong>

              <p>
                完了
              </p>
            </div>

            <div className="selectionPanel">
              <strong>
                最終チェック
              </strong>

              <p>
                {completed
                  ? "問題なし"
                  : "要確認"}
              </p>
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
            採点確定
          </h2>

          <p>
            採点を確定すると、採点結果が確定データになります。
            その後、テスト全体を一括公開できます。
          </p>

          {!confirmed ? (
            <button
              type="button"
              className="primaryButton"
              disabled={
                hasError ||
                !completed ||
                confirming
              }
              onClick={
                confirmGrading
              }
            >
              採点を確定する
            </button>
          ) : (
            <div className="selectionPanel">
              <strong>
                採点確定済み
              </strong>

              <p>
                次はテスト全体の公開です。
              </p>

              <a
                href="/answers"
                className="primaryButton"
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                }}
              >
                公開画面へ
              </a>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
