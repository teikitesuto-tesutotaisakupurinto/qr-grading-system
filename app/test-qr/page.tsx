"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

const BUCKET = "answers";

const TEST_ID = "test-qr";
const SUBJECT_ID = "subject-qr";
const STUDENT_NUMBER = "123456";
const ANSWER_ID = "answer-qr-001";

export default function TestQrPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");

  async function createTestAnswer() {
    try {
      setLoading(true);
      setMessage("QR付き答案を作成しています...");

      if (!supabase) {
        throw new Error(
          "Supabaseが初期化されていません。"
        );
      }

      /*
       * QRコード生成
       */
      const qrDataUrl =
        await QRCode.toDataURL(
          STUDENT_NUMBER,
          {
            width: 700,
            margin: 4,
            errorCorrectionLevel: "H",
          }
        );

      /*
       * Canvas
       */
      const canvas =
        document.createElement("canvas");

      canvas.width = 2480;
      canvas.height = 3508;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        throw new Error(
          "Canvasを取得できません。"
        );
      }

      /*
       * 白背景
       */
      ctx.fillStyle = "#ffffff";

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      /*
       * タイトル
       */
      ctx.fillStyle = "#000000";

      ctx.font =
        "bold 90px sans-serif";

      ctx.fillText(
        "QR答案テスト",
        160,
        180
      );

      /*
       * テスト情報
       */
      ctx.font =
        "48px sans-serif";

      ctx.fillText(
        `Test ID: ${TEST_ID}`,
        160,
        280
      );

      ctx.fillText(
        `Subject ID: ${SUBJECT_ID}`,
        160,
        360
      );

      ctx.fillText(
        `Student Number: ${STUDENT_NUMBER}`,
        160,
        440
      );

      /*
       * QR画像
       */
      const qrImage =
        new Image();

      await new Promise<void>(
        (resolve, reject) => {
          qrImage.onload =
            () => resolve();

          qrImage.onerror =
            () =>
              reject(
                new Error(
                  "QR画像を読み込めません。"
                )
              );

          qrImage.src =
            qrDataUrl;
        }
      );

      const qrSize = 900;

      ctx.drawImage(
        qrImage,
        790,
        600,
        qrSize,
        qrSize
      );

      /*
       * QR説明
       */
      ctx.font =
        "bold 60px sans-serif";

      ctx.fillText(
        "生徒番号QR",
        980,
        1600
      );

      /*
       * 解答欄
       */
      ctx.font =
        "bold 55px sans-serif";

      ctx.fillText(
        "解答欄",
        160,
        1820
      );

      for (
        let i = 0;
        i < 5;
        i++
      ) {
        const y =
          1940 +
          i * 270;

        ctx.strokeStyle =
          "#000000";

        ctx.lineWidth = 5;

        ctx.strokeRect(
          160,
          y,
          2160,
          190
        );

        ctx.font =
          "45px sans-serif";

        ctx.fillText(
          `${i + 1}.`,
          210,
          y + 120
        );
      }

      /*
       * PNG化
       */
      const blob =
        await new Promise<Blob>(
          (resolve, reject) => {
            canvas.toBlob(
              (result) => {
                if (!result) {
                  reject(
                    new Error(
                      "PNG生成に失敗しました。"
                    )
                  );

                  return;
                }

                resolve(result);
              },
              "image/png"
            );
          }
        );

      /*
       * プレビュー
       */
      const previewUrl =
        URL.createObjectURL(
          blob
        );

      setPreview(
        previewUrl
      );

      /*
       * Storage path
       *
       * Bucket = answers
       *
       * Path =
       * test-qr/subject-qr/answer-qr-001.png
       */
      const path =
        `${TEST_ID}/${SUBJECT_ID}/${ANSWER_ID}.png`;

      setMessage(
        "Supabase Storageへアップロードしています..."
      );

      /*
       * Supabase Storageへ直接アップロード
       */
      const {
        error,
      } =
        await supabase.storage
          .from(BUCKET)
          .upload(
            path,
            blob,
            {
              contentType:
                "image/png",

              upsert:
                true,

              cacheControl:
                "3600",
            }
          );

      if (error) {
        throw new Error(
          `Storageへのアップロードに失敗しました: ${error.message}`
        );
      }

      setMessage(
        [
          "テスト答案の作成に成功しました。",
          "",
          `Bucket: ${BUCKET}`,
          `Path: ${path}`,
          `Student Number: ${STUDENT_NUMBER}`,
        ].join("\n")
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "テスト答案の作成に失敗しました。"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 40,
      }}
    >
      <h1>
        QR答案テスト
      </h1>

      <p>
        生徒番号
        <strong>
          {STUDENT_NUMBER}
        </strong>
        のQR付き答案を生成します。
      </p>

      <button
        type="button"
        onClick={
          createTestAnswer
        }
        disabled={loading}
        style={{
          padding:
            "14px 24px",

          fontSize:
            18,

          cursor:
            loading
              ? "default"
              : "pointer",
        }}
      >
        {loading
          ? "作成中..."
          : "QR付きテスト答案を作成"}
      </button>

      {message && (
        <pre
          style={{
            marginTop: 24,
            padding: 20,
            background:
              "#f5f5f5",
            whiteSpace:
              "pre-wrap",
          }}
        >
          {message}
        </pre>
      )}

      {preview && (
        <section
          style={{
            marginTop: 32,
          }}
        >
          <h2>
            プレビュー
          </h2>

          <img
            src={preview}
            alt="QR付きテスト答案"
            style={{
              width:
                "100%",

              maxWidth:
                650,

              border:
                "1px solid #ccc",
            }}
          />
        </section>
      )}
    </main>
  );
}
