"use client";

import { useMemo } from "react";
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
  const qrValue = useMemo(
    () => studentNumber,
    [studentNumber]
  );

  const qrDataUrl = useMemo(() => {
    return QRCode.toDataURL(
      qrValue,
      {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 180,
      }
    );
  }, [qrValue]);

  return (
    <section className="qrSheet">
      {Array.from(
        {
          length: STICKER_COUNT,
        },
        (_, index) => (
          <div
            key={index}
            className="qrSticker"
          >
            <div className="qrCodeArea">
              <img
                src={qrDataUrl}
                alt={`生徒番号 ${studentNumber} のQRコード`}
                className="qrCodeImage"
              />
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
