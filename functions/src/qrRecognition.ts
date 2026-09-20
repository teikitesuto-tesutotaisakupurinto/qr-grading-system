import sharp from "sharp";
import jsQR from "jsqr";

export type QrRecognitionResult = {
  studentNumber: string | null;
  rawValue: string | null;
  confidence: number;
  candidates: string[];
};

type ImageData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

const QR_SCAN_SCALES = [
  1,
  0.75,
  0.5,
];

const CORNER_RATIO = 0.3;

/* =========================================================
   メイン
   ========================================================= */

export async function recognizeStudentQr(
  buffer: Buffer
): Promise<QrRecognitionResult> {
  if (!buffer.length) {
    throw new Error(
      "QR読み取り対象の画像が空です。"
    );
  }

  const candidates: string[] = [];

  /*
   * まず答案全体を複数解像度で解析。
   */
  for (
    const scale of QR_SCAN_SCALES
  ) {
    const image =
      await prepareImage(
        buffer,
        scale
      );

    const value =
      decodeQr(image);

    if (value) {
      candidates.push(value);
    }
  }

  /*
   * 全体で読めない場合、
   * 四隅付近を個別に解析。
   */
  const cornerValues =
    await scanCorners(buffer);

  candidates.push(
    ...cornerValues
  );

  const normalizedCandidates =
    candidates
      .map(normalizeQrValue)
      .filter(
        (
          value
        ): value is string =>
          value !== null
      );

  const uniqueCandidates =
    Array.from(
      new Set(
        normalizedCandidates
      )
    );

  /*
   * 1つだけ有効な生徒番号が得られた場合。
   */
  if (
    uniqueCandidates.length === 1
  ) {
    return {
      studentNumber:
        uniqueCandidates[0],

      rawValue:
        candidates.find(
          (value) =>
            normalizeQrValue(
              value
            ) ===
            uniqueCandidates[0]
        ) ?? null,

      confidence:
        calculateConfidence(
          candidates.length,
          uniqueCandidates.length
        ),

      candidates:
        uniqueCandidates,
    };
  }

  /*
   * 複数の異なる生徒番号が
   * 検出された場合は自動確定しない。
   */
  if (
    uniqueCandidates.length > 1
  ) {
    return {
      studentNumber: null,
      rawValue: null,
      confidence: 0,
      candidates:
        uniqueCandidates,
    };
  }

  return {
    studentNumber: null,
    rawValue: null,
    confidence: 0,
    candidates: [],
  };
}

/* =========================================================
   QR値の正規化
   ========================================================= */

function normalizeQrValue(
  value: string
): string | null {
  const normalized =
    value
      .trim()
      .replace(/\s+/g, "");

  /*
   * 現在のQR仕様：
   * 6桁数字
   */
  if (
    /^\d{6}$/.test(
      normalized
    )
  ) {
    return normalized;
  }

  /*
   * 拡張JSON形式にも対応。
   *
   * {
   *   "type": "student",
   *   "studentNumber": "583214"
   * }
   */
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
    // 通常文字列として処理
  }

  return null;
}

/* =========================================================
   画像準備
   ========================================================= */

async function prepareImage(
  buffer: Buffer,
  scale: number
): Promise<ImageData> {
  const metadata =
    await sharp(buffer)
      .metadata();

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  if (
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      "QR画像のサイズを取得できません。"
    );
  }

  const targetWidth =
    Math.max(
      320,
      Math.round(
        width * scale
      )
    );

  const {
    data,
    info,
  } =
    await sharp(buffer)
      .resize({
        width:
          targetWidth,
        fit: "inside",
        withoutEnlargement:
          false,
      })
      .grayscale()
      .normalize()
      .raw()
      .toBuffer({
        resolveWithObject:
          true,
      });

  return {
    data:
      new Uint8ClampedArray(
        data
      ),

    width:
      info.width,

    height:
      info.height,
  };
}

/* =========================================================
   QRデコード
   ========================================================= */

function decodeQr(
  image: ImageData
): string | null {
  const result =
    jsQR(
      image.data,
      image.width,
      image.height,
      {
        inversionAttempts:
          "attemptBoth",
      }
    );

  return result?.data ??
    null;
}

/* =========================================================
   四隅探索
   ========================================================= */

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
    width <= 0 ||
    height <= 0
  ) {
    return [];
  }

  const cropWidth =
    Math.max(
      400,
      Math.floor(
        width *
          CORNER_RATIO
      )
    );

  const cropHeight =
    Math.max(
      400,
      Math.floor(
        height *
          CORNER_RATIO
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
          width -
            cropWidth
        ),

      top: 0,
    },

    {
      left: 0,

      top:
        Math.max(
          0,
          height -
            cropHeight
        ),
    },

    {
      left:
        Math.max(
          0,
          width -
            cropWidth
        ),

      top:
        Math.max(
          0,
          height -
            cropHeight
        ),
    },
  ];

  const results: string[] =
    [];

  for (
    const region of regions
  ) {
    const cropWidthActual =
      Math.min(
        cropWidth,
        width -
          region.left
      );

    const cropHeightActual =
      Math.min(
        cropHeight,
        height -
          region.top
      );

    if (
      cropWidthActual <= 0 ||
      cropHeightActual <= 0
    ) {
      continue;
    }

    const cropped =
      await sharp(buffer)
        .extract({
          left:
            region.left,

          top:
            region.top,

          width:
            cropWidthActual,

          height:
            cropHeightActual,
        })
        .png()
        .toBuffer();

    for (
      const scale of
        QR_SCAN_SCALES
    ) {
      const image =
        await prepareImage(
          cropped,
          scale
        );

      const value =
        decodeQr(image);

      if (value) {
        results.push(
          value
        );
      }
    }
  }

  return results;
}

/* =========================================================
   信頼度
   ========================================================= */

function calculateConfidence(
  detectionCount: number,
  validCount: number
): number {
  if (
    detectionCount <= 0 ||
    validCount <= 0
  ) {
    return 0;
  }

  /*
   * 同じ6桁番号を複数回検出できた場合、
   * 信頼度を上げる。
   */
  const repeated =
    Math.min(
      detectionCount,
      3
    );

  return Math.min(
    1,
    0.8 +
      repeated * 0.06
  );
}
