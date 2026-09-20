import QRCode from "qrcode";

export async function createStudentQrDataUrl(
  studentNumber: string
): Promise<string> {
  return QRCode.toDataURL(studentNumber, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

export function createQrPayload(
  studentNumber: string
) {
  return {
    type: "student",
    studentNumber,
    version: 1,
  };
}
