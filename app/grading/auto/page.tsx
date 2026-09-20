"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import SchoolHeader from "@/components/SchoolHeader";
import StepBar from "@/components/StepBar";

import {
  getAnswers,
  getGradingJob,
  startAutoGrading,
} from "@/lib/answers";

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

export default function AutoGradingPage() {
  const searchParams =
    useSearchParams();

  const testId =
    searchParams.get(
      "testId"
    ) ?? "";

  const subjectId =
    searchParams.get(
      "subjectId"
    ) ?? "";

  const [
    jobId,
    setJobId,
  ] = useState<
    string | null
  >(null);

  const [
    total,
    setTotal,
  ] = useState<number>(0);

  const [
    processed,
    setProcessed,
  ] = useState<number>(0);

  const [
    succeeded,
    setSucceeded,
  ] = useState<number>(0);

  const [
    reviewCount,
    setReviewCount,
  ] = useState<number>(0);

  const [
    errorCount,
    setErrorCount,
  ] = useState<number>(0);

  const [
    running,
    setRunning,
  ] = useState(false);

  const [
    finished,
    setFinished,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const progress =
    useMemo(() => {
      if (total <= 0) {
        return 0;
      }

      return Math.min(
        100,
        Math.round(
          (processed /
            total) *
            100
        )
      );
    }, [
      processed,
      total,
    ]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled =
      false;

    const timer =
      window.setInterval(
        async () => {
          try {
            const job =
              await getGradingJob(
                jobId
              );

            if (
              cancelled ||
              !job
            ) {
              return;
            }

            setProcessed(
              Number(
                job.processed ??
                  0
              )
            );

            setSucceeded(
              Number(
                job.succeeded ??
                  0
              )
            );

            setReviewCount(
              Number(
                job.reviewRequired ??
                  0
              )
            );

            setErrorCount(
              Number(
                job.errors ??
                  0
              )
            );

            if (
              job.status ===
                "completed" ||
              job.status ===
                "completed_with_errors"
            ) {
              setRunning(false);
              setFinished(true);

              if (
                job.status ===
                "completed_with_errors"
              ) {
                setErrorMessage(
                  "一部の答案でエラーが発生しました。"
                );
              }

              window.clearInterval(
                timer
              );
            }

            if (
              job.status ===
              "failed"
            ) {
              setRunning(false);

              setErrorMessage(
                typeof job.errorMessage ===
                  "string"
                  ? job.errorMessage
                  : "答案処理に失敗しました。"
              );

              window.clearInterval(
                timer
              );
            }
          } catch (error) {
            if (
              !cancelled
            ) {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "ジョブ状態を取得できません。"
              );
            }
          }
        },
        2000
      );

    return () => {
      cancelled = true;

      window.clearInterval(
        timer
      );
    };
  }, [jobId]);

  async function startProcessing() {
    if (
      !testId ||
      !subjectId
    ) {
      setErrorMessage(
        "testIdとsubjectIdが必要です。"
      );

      return;
    }

    setRunning(true);
    setFinished(false);

    setErrorMessage("");

    setProcessed(0);
    setSucceeded(0);
    setReviewCount(0);
    setErrorCount(0);

    setJobId(null);

    try {
      const answers =
        await getAnswers(
          testId,
          subjectId,
          "uploaded"
        );

      if (
        answers.length ===
        0
      ) {
        setRunning(false);

        setErrorMessage(
          "未処理の答案がありません。"
        );

        return;
      }

      const result =
        await startAutoGrading(
          testId,
          subjectId,
          answers.map(
            (answer) =>
              answer.id
          )
        );

      setJobId(
        result.jobId
      );

      setTotal(
        Number(
          result.total
        )
      );
    } catch (error) {
      setRunning(false);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "自動採点の開始に失敗しました。"
      );
    }
  }

  const items: ProcessingItem[] =
    [
      "QR認識",
      "四隅マーカー検出",
      "傾き・台形補正",
      "答案位置合わせ",
      "OCR",
      "自動採点",
    ].map(
      (name) => ({
        name,

        total,

        processed,

        status:
          errorCount > 0
            ? "要確認"
            : finished
            ? "完了"
            : running
            ? "処理中"
            : "待機中",
      })
    );

  return (
    <main className="page">
      <SchoolHeader
        title="自動採点"
      />

      <section className="content">
        <StepBar
          currentStep={4}
        />

        <div className="pageHeader">
          <div>
            <h1>
              自動採点
            </h1>

            <p>
              QR認識・画像補正・OCR・自動採点をCloud Functionsで処理します。
            </p>
          </div>
        </div>

        <section className="stepCard">
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom: 18,
            }}
          >
            <div>
              <strong>
                テスト：
                {testId ||
                  "未指定"}
              </strong>

              <div>
                教科：
                {subjectId ||
                  "未指定"}
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
            }}
          >
            <div
              style={{
                width:
                  `${progress}%`,
                height:
                  "100%",
                background:
                  "#222",
                transition:
                  "width .2s linear",
              }}
            />
          </div>

          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              marginTop: 8,
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

          {errorMessage && (
            <div
              className="selectionPanel"
              style={{
                marginTop: 16,
              }}
            >
              {errorMessage}
            </div>
          )}

          <div
            className="actionBar"
            style={{
              marginTop: 20,
            }}
          >
            <button
              type="button"
              className="primaryButton"
              disabled={
                running
              }
              onClick={
                startProcessing
              }
            >
              {running
                ? "処理中..."
                : finished
                ? "再実行"
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
          {items.map(
            (item) => {
              const itemProgress =
                item.total <= 0
                  ? 0
                  : Math.min(
                      100,
                      Math.round(
                        (item.processed /
                          item.total) *
                          100
                      )
                    );

              return (
                <div
                  key={
                    item.name
                  }
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
                      {
                        item.name
                      }
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
                        width:
                          `${itemProgress}%`,
                        height:
                          "100%",
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
                    {
                      item.status
                    }
                  </div>
                </div>
              );
            }
          )}
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
              成功
            </strong>

            <p>
              {succeeded}
              枚
            </p>
          </div>

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
              要確認答案は一次確認で確認してください。
            </p>

            <a
              href="/grading/first"
              className="primaryButton"
            >
              一次確認へ
            </a>
          </section>
        )}
      </section>
    </main>
  );
}
