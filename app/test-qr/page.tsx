"use client";

import {
  useState,
} from "react";

import QRCode from "qrcode";

import {
  uploadAnswer,
} from "@/lib/answers";

export default function TestQrPage() {
  const [
    status,
    setStatus,
  ] = useState("");

  const [
    preview,
    setPreview,
  ] = useState<string | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  async function createTestAnswer() {
    try {
      setLoading(true);

      setStatus(
        "テスト答案を作成しています..."
      );

      /*
       * テスト用データ
       */
      const testId =
        "test-qr";

      const subjectId =
        "subject-qr";

      const studentNumber =
        "123456";

      /*
       * QRに入れる値
       */
      const qrData =
        studentNumber;

      /*
       * QRをData URLとして生成
       */
      const qrDataUrl =
        await QRCode.toDataURL(
          qrData,
          {
            width: 500,

            margin: 4,

            errorCorrectionLevel:
              "H",
          }
        );

      /*
       * Canvas
       */
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        2480;

      canvas.height =
        3508;

      const context =
        canvas.getContext(
          "2d"
        );

      if (!context) {
        throw new Error(
          "Canvasを取得できません。"
        );
      }

      /*
       * 背景
       */
      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      /*
       * タイトル
       */
      context.fillStyle =
        "#000000";

      context.font =
        "bold 90px sans-serif";

      context.fillText(
        "QR答案テスト",
        160,
        180
      );

      /*
       * テスト情報
       */
      context.font =
        "50px sans-serif";

      context.fillText(
        "Test: test-qr",
        160,
        280
      );

      context.fillText(
        "Subject: subject-qr",
        160,
        360
      );

      context.fillText(
        "Student: 123456",
        160,
        440
      );

      /*
       * QR画像
       */
      const qrImage =
        new Image();

      await new Promise<void>(
        (
          resolve,
          reject
        ) => {
          qrImage.onload =
            () => resolve();

          qrImage.onerror =
            () =>
              reject(
                new Error(
                  "QR画像の読み込みに失敗しました。"
                )
              );

          qrImage.src =
            qrDataUrl;
        }
      );

      const qrSize =
        900;

      const qrX =
        790;

      const qrY =
        650;

      context.drawImage(
        qrImage,
        qrX,
        qrY,
        qrSize,
        qrSize
      );

      /*
       * QR説明
       */
      context.font =
        "60px sans-serif";

      context.fillText(
        "生徒番号QR",
        950,
        1650
      );

      /*
       * 答案欄
       */
      context.font =
        "bold 55px sans-serif";

      context.fillText(
        "解答欄",
        160,
        1850
      );

      context.font =
        "45px sans-serif";

      for (
        let i = 0;
        i < 5;
        i++
      ) {
        const y =
          1980 +
          i * 260;

        context.strokeStyle =
          "#000000";

        context.lineWidth =
          4;

        context.strokeRect(
          160,
          y,
          2160,
          180
        );

        context.fillText(
          `${i + 1}.`,
          210,
          y + 115
        );
      }

      /*
       * PNG Blob
       */
      const blob =
        await new Promise<Blob>(
          (
            resolve,
            reject
          ) => {
            canvas.toBlob(
              (
                result
              ) => {
                if (
                  result
                ) {
                  resolve(
                    result
                  );
                } else {
                  reject(
                    new Error(
                      "PNG生成に失敗しました。"
                    )
                  );
                }
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
       * File
       */
      const file =
        new File(
          [
            blob,
          ],
          "answer-qr-001.png",
          {
            type:
              "image/png",
          }
        );

      /*
       * Supabaseへアップロード
       *
       * uploadAnswer側で
       * Cloud Functionを経由せず、
       * 現在の実装に合わせて
       * アップロードURLを取得する。
       */
      setStatus(
        "Supabase Storageへアップロードしています..."
      );

      /*
       * 現在のuploadAnswer実装では
       * studentNumberも指定できる。
       */
      const answer =
        await uploadAnswer({
          testId,

          subjectId,

          studentNumber,

          file,
        });

      setStatus(
        `アップロード完了: ${answer.id}`
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      setStatus(
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
        maxWidth:
          900,

        margin:
          "0 auto",

        padding:
          40,
      }}
    >
      <h1>
        QR答案テスト
      </h1>

      <p>
        生徒番号
        123456
        のテスト答案を生成します。
      </p>

      <button
        type="button"
        onClick={
          createTestAnswer
        }
        disabled={
          loading
        }
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
          : "テスト答案を作成"}
      </button>

      {status && (
        <p
          style={{
            marginTop:
              24,

            whiteSpace:
              "pre-wrap",
          }}
        >
          {status}
        </p>
      )}

      {preview && (
        <section
          style={{
            marginTop:
              32,
          }}
        >
          <h2>
            プレビュー
          </h2>

          <img
            src={
              preview
            }
            alt="QRテスト答案"
            style={{
              width:
                "100%",

              maxWidth:
                600,

              border:
                "1px solid #ccc",
            }}
          />
        </section>
      )}
    </main>
  );
}
