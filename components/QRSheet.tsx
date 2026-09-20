"use client";

import {
  useEffect,
  useState,
} from "react";

import QRCode from "qrcode";

type QRSheetProps = {
  studentName: string;
  studentNumber: string;
};

const STICKER_COUNT = 18;

export default function QRSheet({
  studentName,
  studentNumber,
}: QRSheetProps) {
  const [qrDataUrl, setQrDataUrl] =
    useState<string>("");

  const [error, setError] =
    useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function generateQr() {
      setQrDataUrl("");
      setError("");

      if (
        !/^\d{6}$/.test(
          studentNumber
        )
      ) {
        setError(
          "生徒番号は6桁数字で指定してください。"
        );
        return;
      }

      try {
        const dataUrl =
          await QRCode.toDataURL(
            studentNumber,
            {
              errorCorrectionLevel:
                "M",

              margin: 1,

              width: 600,

              color: {
                dark: "#000000",
                light: "#ffffff",
              },
            }
          );

        if (!cancelled) {
          setQrDataUrl(
            dataUrl
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "QRコードの生成に失敗しました。"
          );
        }
      }
    }

    void generateQr();

    return () => {
      cancelled = true;
    };
  }, [studentNumber]);

  return (
    <section className="qrSheet">
      {Array.from(
        {
          length:
            STICKER_COUNT,
        },
        (_, index) => (
          <div
            key={index}
            className="qrSticker"
          >
            <div className="qrCodeArea">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`生徒番号 ${studentNumber} のQRコード`}
                  className="qrCodeImage"
                  draggable={false}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontSize: 9,
                    textAlign:
                      "center",
                  }}
                >
                  {error ||
                    "QR生成中"}
                </div>
              )}
            </div>

            <div className="qrStudentInfo">
              <div className="qrStudentName">
                {studentName}
              </div>

              <div className="qrStudentNumber">
                {studentNumber}
              </div>
            </div>
          </div>
        )
      )}
    </section>
  );
}
