import sharp from "sharp";
import jsQR from "jsqr";

export type QrRecognitionResult = {
  studentNumber: string | null;
  rawValue: string | null;
  confidence: number;
  candidates: string[];
};

function isValidStudentNumber(
  value: string
): boolean {
  return /^\d{6}$/.test(value);
}

function normalizeQrValue(
  value: string
): string | null {
  const normalized =
    value.trim();

  // 今回のQRは6桁生徒番号を直接格納
  if (
    isValidStudentNumber(
      normalized
    )
  ) {
    return normalized;
  }

  // 将来の拡張形式
  // {"type":"student","studentNumber":"583214"}
  try {
    const parsed =
      JSON.parse(normalized);

    if (
      parsed &&
      parsed.type ===
        "student" &&
      typeof parsed.studentNumber ===
        "string" &&
      isValidStudentNumber(
        parsed.studentNumber
      )
    ) {
      return parsed.studentNumber;
    }
  } catch {
    // JSONでなければ通常のQRとして扱う
  }

  return null;
}

async function decodeImage(
  buffer: Buffer
) {
  const { data, info } =
    await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

  const pixels = new Uint8ClampedArray(
    data
  );

  return {
    pixels,
    width: info.width,
    height: info.height,
  };
}

function tryDecode(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
) {
  const result = jsQR(
    pixels,
    width,
    height,
    {
      inversionAttempts:
        "attemptBoth",
    }
  );

  return result?.data ?? null;
}

export async function recognizeStudentQr(
  buffer: Buffer
): Promise<QrRecognitionResult> {
  const decoded =
    await decodeImage(buffer);

  const rawValue =
    tryDecode(
      decoded.pixels,
      decoded.width,
      decoded.height
    );

  if (rawValue) {
    const studentNumber =
      normalizeQrValue(
        rawValue
      );

    if (studentNumber) {
      return {
        studentNumber,
        rawValue,
        confidence: 1,
        candidates: [
          studentNumber,
        ],
      };
    }
  }

  /*
   * 答案全体からQRが直接読めない場合に備え、
   * 左上→右上→左下→右下の順で
   * QR候補領域を再解析します。
   */

  const candidates =
    await scanCorners(buffer);

  const validCandidates =
    candidates
      .map(normalizeQrValue)
      .filter(
        (
          value
        ): value is string =>
          value !== null
      );

  const unique =
    Array.from(
      new Set(
        validCandidates
      )
    );

  if (unique.length === 1) {
    return {
      studentNumber:
        unique[0],
      rawValue:
        candidates.find(
          (candidate) =>
            normalizeQrValue(
              candidate
            ) === unique[0]
        ) ?? null,
      confidence: 0.95,
      candidates:
        unique,
    };
  }

  if (unique.length > 1) {
    /*
     * 同一答案から複数の異なる生徒番号が
     * 読めた場合は自動確定しない。
     */
    return {
      studentNumber: null,
      rawValue: null,
      confidence: 0,
      candidates: unique,
    };
  }

  return {
    studentNumber: null,
    rawValue: null,
    confidence: 0,
    candidates: [],
  };
}

async function scanCorners(
  buffer: Buffer
): Promise<string[]> {
  const metadata =
    await sharp(buffer)
      .metadata();

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  if (
    width === 0 ||
    height === 0
  ) {
    return [];
  }

  const cropWidth =
    Math.max(
      300,
      Math.floor(
        width * 0.25
      )
    );

  const cropHeight =
    Math.max(
      300,
      Math.floor(
        height * 0.25
      )
    );

  const regions = [
    {
      left: 0,
      top: 0,
    },
    {
      left:
        Math.max(
          0,
          width - cropWidth
        ),
      top: 0,
    },
    {
      left: 0,
      top:
        Math.max(
          0,
          height - cropHeight
        ),
    },
    {
      left:
        Math.max(
          0,
          width - cropWidth
        ),
      top:
        Math.max(
          0,
          height - cropHeight
        ),
    },
  ];

  const results: string[] = [];

  for (
    const region of regions
  ) {
    const crop =
      await sharp(buffer)
        .extract({
          left: region.left,
          top: region.top,
          width: Math.min(
            cropWidth,
            width -
              region.left
          ),
          height: Math.min(
            cropHeight,
            height -
              region.top
          ),
        })
        .ensureAlpha()
        .raw()
        .toBuffer({
          resolveWithObject:
            true,
        });

    const value =
      tryDecode(
        new Uint8ClampedArray(
          crop.data
        ),
        crop.info.width,
        crop.info.height
      );

    if (value) {
      results.push(value);
    }
  }

  return results;
}
