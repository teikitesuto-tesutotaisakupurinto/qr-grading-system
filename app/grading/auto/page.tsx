"use client";

import { useEffect, useState } from "react";

import SchoolHeader from "@/components/SchoolHeader";
import StepBar from "@/components/StepBar";

type ProcessingStatus =
  | "待機中"
  | "処理中"
  | "完了"
  | "要確認"
  | "エラー";

type ProcessingItem = {
  name: string;
  total: number;
  processed: number;
  status: ProcessingStatus;
};

const initialItems: ProcessingItem[] = [
  {
    name: "QR認識",
    total: 3000,
    processed: 0,
    status: "待機中",
  },
  {
    name: "四隅マーカー検出",
    total: 3000,
    processed: 0,
    status: "待機中",
  },
  {
    name: "傾き・台形補正",
    total: 3000,
    processed: 0,
    status: "待機中",
  },
  {
    name: "答案位置合わせ",
    total: 3000,
    processed: 0,
    status: "待機中",
  },
  {
    name: "OCR",
    total: 3000,
    processed: 0,
    status: "待機中",
  },
  {
    name: "自動採点",
    total: 3000,
    processed: 0,
    status: "待機中",
  },
];

export default function AutoGradingPage() {
  const [items, setItems] =
    useState<ProcessingItem[]>(
      initialItems
    );

  const [running, setRunning] =
    useState(false);

  const [finished, setFinished] =
    useState(false);

  const [errorCount, setErrorCount] =
    useState(0);

  const [reviewCount, setReviewCount] =
    useState(0);

  const total = 3000;

  const processed =
    items.find(
      (item) =>
        item.name === "自動採点"
    )?.processed ?? 0;

  const progress =
    total === 0
      ? 0
      : Math.round(
          (processed / total) * 100
        );

  useEffect(() => {
    if (!running) return;

    if (processed >= total) {
      setRunning(false);
      setFinished(true);

      setItems((current) =>
        current.map((item) => ({
          ...item,
          processed:
            item.total,
          status:
            item.name === "自動採点"
              ? "完了"
              : item.status,
        }))
      );

      return;
    }

    const timer = setTimeout(() => {
      setItems((current) =>
        current.map((item, index) => {
          const next =
            Math.min(
              item.processed +
                (index === 5
                  ? 75
                  : 100),
              item.total
            );

          let status:
            | ProcessingStatus =
            next >= item.total
              ? "完了"
              : "処理中";

          if (
            item.name ===
              "四隅マーカー検出" &&
            next > 0 &&
            next % 997 < 100
          ) {
            status = "要確認";
          }

          return {
            ...item,
            processed: next,
            status,
          };
        })
      );

      if (
        Math.random() < 0.08
      ) {
        setReviewCount(
          (current) =>
            current + 1
        );
      }

      if (
        Math.random() < 0.01
      ) {
        setErrorCount(
          (current) =>
            current + 1
        );
      }
    }, 100);

    return () =>
      clearTimeout(timer);
  }, [running, processed]);

  function startProcessing() {
    setItems(
      initialItems.map(
        (item) => ({
          ...item,
          processed: 0,
          status: "待機中",
        })
      )
    );

    setErrorCount(0);
    setReviewCount(0);
    setFinished(false);
    setRunning(true);
  }

  return (
    <main className="page">
      <SchoolHeader
        title="自動採点"
      />

      <section className="content">
        <StepBar currentStep={4} />

        <div className="pageHeader">
          <div>
            <h1>
              自動採点
            </h1>

            <p>
              QR認識・画像補正・OCR・自動採点を一括処理します。
            </p>
          </div>
        </div>

        <section className="stepCard">
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom: 18,
            }}
          >
            <div>
              <strong>
                第1回確認テスト
              </strong>

              <div>
                数学
              </div>
            </div>

            <div>
              答案：
              <strong>
                {processed.toLocaleString()}
                {" / "}
                {total.toLocaleString()}
              </strong>
            </div>
          </div>

          <div
            style={{
              height: 14,
              background:
                "#eee",
              borderRadius: 7,
              overflow:
                "hidden",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background:
                  "#222",
                transition:
                  "width .1s linear",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
            }}
          >
            <span>
              {progress}%
            </span>

            <span>
              {finished
                ? "処理完了"
                : running
                ? "処理中"
                : "待機中"}
            </span>
          </div>

          <div
            className="actionBar"
            style={{
              marginTop: 20,
            }}
          >
            <button
              type="button"
              className="primaryButton"
              disabled={running}
              onClick={
                startProcessing
              }
            >
              {finished
                ? "もう一度実行"
                : "自動採点を開始"}
            </button>
          </div>
        </section>

        <section
          className="listCard"
          style={{
            marginTop: 24,
          }}
        >
          {items.map((item) => {
            const itemProgress =
              Math.round(
                (item.processed /
                  item.total) *
                  100
              );

            return (
              <div
                key={item.name}
                style={{
                  padding:
                    "18px",
                  borderBottom:
                    "1px solid #eee",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    marginBottom:
                      8,
                  }}
                >
                  <strong>
                    {item.name}
                  </strong>

                  <span>
                    {item.processed.toLocaleString()}
                    {" / "}
                    {item.total.toLocaleString()}
                  </span>
                </div>

                <div
                  style={{
                    height: 8,
                    background:
                      "#eee",
                    borderRadius:
                      4,
                    overflow:
                      "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${itemProgress}%`,
                      height: "100%",
                      background:
                        "#555",
                    }}
                  />
                </div>

                <div
                  style={{
                    marginTop:
                      6,
                    color:
                      "#777",
                    fontSize:
                      12,
                  }}
                >
                  {item.status}
                </div>
              </div>
            );
          })}
        </section>

        <section
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: 12,
            marginTop: 24,
          }}
        >
          <div className="selectionPanel">
            <strong>
              要確認
            </strong>

            <p>
              {reviewCount}
              枚
            </p>
          </div>

          <div className="selectionPanel">
            <strong>
              エラー
            </strong>

            <p>
              {errorCount}
              枚
            </p>
          </div>

          <div className="selectionPanel">
            <strong>
              次の工程
            </strong>

            <p>
              一次確認
            </p>
          </div>
        </section>

        {finished && (
          <section
            className="stepCard"
            style={{
              marginTop: 24,
            }}
          >
            <h2>
              自動採点完了
            </h2>

            <p>
              自動採点が完了しました。
              「要確認」の答案は一次確認で確認してください。
            </p>

            <a
              href="/grading/first"
              className="primaryButton"
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
              }}
            >
              一次確認へ
            </a>
          </section>
        )}
      </section>
    </main>
  );
}
