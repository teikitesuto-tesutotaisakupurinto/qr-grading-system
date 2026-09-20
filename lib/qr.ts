"use client";

import QRCode from "qrcode";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

export type QrCodeRecord = {
  id: string;

  studentNumber: string;

  value: string;

  sheetIndex: number;

  stickerIndex: number;

  createdAt?: unknown;
};

const STICKERS_PER_STUDENT = 18;

/* =========================================================
   QR値
   ========================================================= */

export function createQrValue(
  studentNumber: string
): string {
  if (
    !/^\d{6}$/.test(
      studentNumber
    )
  ) {
    throw new Error(
      "生徒番号は6桁数字で指定してください。"
    );
  }

  return studentNumber;
}

/* =========================================================
   QR画像生成
   ========================================================= */

export async function createQrDataUrl(
  studentNumber: string
): Promise<string> {
  const value =
    createQrValue(
      studentNumber
    );

  return QRCode.toDataURL(
    value,
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
}

/* =========================================================
   QR SVG生成
   ========================================================= */

export async function createQrSvg(
  studentNumber: string
): Promise<string> {
  const value =
    createQrValue(
      studentNumber
    );

  return QRCode.toString(
    value,
    {
      type: "svg",

      errorCorrectionLevel:
        "M",

      margin: 1,

      width: 600,
    }
  );
}

/* =========================================================
   1人分18枚のQR情報
   ========================================================= */

export function createStudentQrRecords(
  studentNumber: string
): QrCodeRecord[] {
  const value =
    createQrValue(
      studentNumber
    );

  const records: QrCodeRecord[] =
    [];

  for (
    let index = 0;
    index <
    STICKERS_PER_STUDENT;
    index++
  ) {
    records.push({
      id:
        `${studentNumber}-${index + 1}`,

      studentNumber,

      value,

      sheetIndex:
        Math.floor(
          index / 18
        ),

      stickerIndex:
        index,
    });
  }

  return records;
}

/* =========================================================
   Firestoreへ18枚登録
   ========================================================= */

export async function registerStudentQrCodes(
  studentNumber: string
): Promise<void> {
  const records =
    createStudentQrRecords(
      studentNumber
    );

  const batch =
    writeBatch(db);

  for (
    const record of records
  ) {
    const reference =
      doc(
        db,
        "qrCodes",
        record.id
      );

    batch.set(
      reference,
      {
        studentNumber:
          record.studentNumber,

        value:
          record.value,

        sheetIndex:
          record.sheetIndex,

        stickerIndex:
          record.stickerIndex,

        createdAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  }

  await batch.commit();
}

/* =========================================================
   複数生徒のQR登録
   ========================================================= */

export async function registerQrCodesForStudents(
  studentNumbers: string[]
): Promise<void> {
  const uniqueNumbers =
    Array.from(
      new Set(
        studentNumbers
      )
    );

  const records =
    uniqueNumbers.flatMap(
      (studentNumber) =>
        createStudentQrRecords(
          studentNumber
        )
    );

  /*
   * Firestoreの1回のbatch上限を考慮。
   */
  const BATCH_SIZE = 400;

  for (
    let start = 0;
    start < records.length;
    start += BATCH_SIZE
  ) {
    const batch =
      writeBatch(db);

    const chunk =
      records.slice(
        start,
        start + BATCH_SIZE
      );

    for (
      const record of chunk
    ) {
      batch.set(
        doc(
          db,
          "qrCodes",
          record.id
        ),
        {
          studentNumber:
            record.studentNumber,

          value:
            record.value,

          sheetIndex:
            record.sheetIndex,

          stickerIndex:
            record.stickerIndex,

          createdAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );
    }

    await batch.commit();
  }
}

/* =========================================================
   生徒のQR一覧
   ========================================================= */

export async function getStudentQrCodes(
  studentNumber: string
): Promise<QrCodeRecord[]> {
  createQrValue(
    studentNumber
  );

  const qrQuery =
    query(
      collection(
        db,
        "qrCodes"
      ),
      where(
        "studentNumber",
        "==",
        studentNumber
      )
    );

  const snapshot =
    await getDocs(
      qrQuery
    );

  return snapshot.docs
    .map(
      (item) =>
        ({
          id: item.id,
          ...item.data(),
        }) as QrCodeRecord
    )
    .sort(
      (a, b) =>
        a.stickerIndex -
        b.stickerIndex
    );
}

/* =========================================================
   QRコード1枚取得
   ========================================================= */

export async function getQrCode(
  qrId: string
): Promise<QrCodeRecord | null> {
  const snapshot =
    await getDoc(
      doc(
        db,
        "qrCodes",
        qrId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as QrCodeRecord;
}

/* =========================================================
   QR値から生徒番号を取得
   ========================================================= */

export function parseQrValue(
  value: string
): string | null {
  const normalized =
    value
      .trim()
      .replace(/\s+/g, "");

  if (
    /^\d{6}$/.test(
      normalized
    )
  ) {
    return normalized;
  }

  try {
    const parsed =
      JSON.parse(
        value
      ) as {
        type?: unknown;
        studentNumber?: unknown;
      };

    if (
      parsed.type ===
        "student" &&
      typeof parsed.studentNumber ===
        "string" &&
      /^\d{6}$/.test(
        parsed.studentNumber
      )
    ) {
      return parsed.studentNumber;
    }
  } catch {
    // 通常の文字列として扱う
  }

  return null;
}
