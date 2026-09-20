"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QRSheetProps = {
  studentName: string;
  studentNumber: string;
};

export default function QRSheet({
  studentName,
  studentNumber,
}: QRSheetProps) {
  const [qrImage, setQrImage] = useState("");

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(studentNumber, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) {
        setQrImage(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [studentNumber]);

  return (
    <div className="qrSheet">
      {Array.from({ length: 18 }).map((_, index) => (
        <div className="qrSticker" key={index}>
          <div className="qrCodeArea">
            {qrImage && (
              <img
                src={qrImage}
                alt=""
                className="qrCodeImage"
              />
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
      ))}
    </div>
  );
}
