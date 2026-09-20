import { getFirestore } from "firebase-admin/firestore";
import vision from "@google-cloud/vision";
import sharp from "sharp";

const db = getFirestore();
const visionClient =
  new vision.ImageAnnotatorClient();

export type OcrWord = {
  text: string;
  confidence: number;

  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type OcrResult = {
  text: string;
  words: OcrWord[];

  width: number;
  height: number;

  confidence: number;

  processedAt: number;
};

export type OcrRegionResult = {
  regionId: string;
  questionId?: string;

  text: string;
  words: OcrWord[];

  confidence: number;

  x: number;
  y: number;
  width: number;
  height: number;
};

type AnswerRegion = {
  id: string;

  type:
    | "section"
    | "question"
    | "answer"
    | "score"
    | "result"
    | "rubric"
    | "comment"
    | "name"
    | "qr";

  /*
   * 正規化座標。
   *
   * 0.0 ～ 1.0
   */
  x: number;
  y: number;
  width: number;
  height: number;

  questionId?: string;
};

const OCR_MIN_WIDTH = 1200;
const OCR_MAX_WIDTH = 3500;

const MIN_CONFIDENCE = 0.5;

/* =========================================================
   答案全体OCR
   ========================================================= */

export async function processAnswerPage(
  imageBuffer: Buffer,
  testId: string,
  subjectId: string
): Promise<OcrResult> {
  if (!imageBuffer.length) {
    throw new Error(
      "OCR対象画像が空です。"
    );
  }

  const prepared =
    await prepareOcrImage(
      imageBuffer
    );

  const metadata =
    await sharp(prepared)
      .metadata();

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  const annotation =
    await detectText(
      prepared
    );

  const words =
    extractWords(
      annotation
    );

  const text =
    annotation?.text ?? "";

  const confidence =
    calculateConfidence(
      words
    );

  /*
   * テスト・教科との紐付けは
   * 呼び出し側のgradingResultsで保存する。
   */
  void testId;
  void subjectId;

  return {
    text,

    words,

    width,

    height,

    confidence,

    processedAt:
      Date.now(),
  };
}

/* =========================================================
   解答枠OCR
   ========================================================= */

export async function processAnswerRegions(
  imageBuffer: Buffer,
  testId: string,
  subjectId: string
): Promise<OcrRegionResult[]> {
  if (!imageBuffer.length) {
    throw new Error(
      "OCR対象画像が空です。"
    );
  }

  const prepared =
    await prepareOcrImage(
      imageBuffer
    );

  const metadata =
    await sharp(prepared)
      .metadata();

  const imageWidth =
    metadata.width ?? 0;

  const imageHeight =
    metadata.height ?? 0;

  if (
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    throw new Error(
      "OCR画像のサイズを取得できません。"
    );
  }

  const regions =
    await getAnswerRegions(
      testId,
      subjectId
    );

  const results: OcrRegionResult[] =
    [];

  for (
    const region of regions
  ) {
    /*
     * QR枠・コメント枠など、
     * 解答文字列としてOCRしない枠は除外。
     */
    if (
      region.type !== "answer" &&
      region.type !== "name"
    ) {
      continue;
    }

    const crop =
      await cropRegion(
        prepared,
        region,
        imageWidth,
        imageHeight
      );

    if (!crop) {
      continue;
    }

    const annotation =
      await detectText(
        crop.buffer
      );

    const words =
      extractWords(
        annotation
      );

    const text =
      annotation?.text
        ?.trim() ?? "";

    results.push({
      regionId:
        region.id,

      questionId:
        region.questionId,

      text,

      words,

      confidence:
        calculateConfidence(
          words
        ),

      x: crop.x,

      y: crop.y,

      width:
        crop.width,

      height:
        crop.height,
    });
  }

  return results;
}

/* =========================================================
   Firestoreから解答枠を取得
   ========================================================= */

async function getAnswerRegions(
  testId: string,
  subjectId: string
): Promise<AnswerRegion[]> {
  const snapshot =
    await db
      .collection(
        "answerRegions"
      )
      .where(
        "testId",
        "==",
        testId
      )
      .where(
        "subjectId",
        "==",
        subjectId
      )
      .get();

  return snapshot.docs.map(
    (doc) => {
      const data =
        doc.data();

      return {
        id: doc.id,

        type:
          data.type,

        x:
          Number(
            data.x ?? 0
          ),

        y:
          Number(
            data.y ?? 0
          ),

        width:
          Number(
            data.width ?? 0
          ),

        height:
          Number(
            data.height ?? 0
          ),

        questionId:
          typeof data.questionId ===
          "string"
            ? data.questionId
            : undefined,
      };
    }
  );
}

/* =========================================================
   OCR前処理
   ========================================================= */

async function prepareOcrImage(
  input: Buffer
): Promise<Buffer> {
  const metadata =
    await sharp(input)
      .metadata();

  const originalWidth =
    metadata.width ?? 0;

  if (
    originalWidth <= 0
  ) {
    throw new Error(
      "画像サイズを取得できません。"
    );
  }

  const targetWidth =
    Math.min(
      OCR_MAX_WIDTH,
      Math.max(
        OCR_MIN_WIDTH,
        originalWidth
      )
    );

  return sharp(input)
    .rotate()
    .resize({
      width:
        targetWidth,

      fit: "inside",

      withoutEnlargement:
        false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

/* =========================================================
   Vision OCR
   ========================================================= */

async function detectText(
  imageBuffer: Buffer
) {
  const [
    result,
  ] =
    await visionClient.documentTextDetection(
      {
        image: {
          content:
            imageBuffer,
        },

        imageContext: {
          languageHints: [
            "ja",
            "en",
          ],
        },
      }
    );

  return (
    result.fullTextAnnotation ??
    null
  );
}

/* =========================================================
   OCR枠切り出し
   ========================================================= */

async function cropRegion(
  imageBuffer: Buffer,
  region: AnswerRegion,
  imageWidth: number,
  imageHeight: number
) {
  /*
   * 枠設定は0～1の正規化座標。
   */
  const left =
    Math.round(
      region.x *
        imageWidth
    );

  const top =
    Math.round(
      region.y *
        imageHeight
    );

  const width =
    Math.round(
      region.width *
        imageWidth
    );

  const height =
    Math.round(
      region.height *
        imageHeight
    );

  if (
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  /*
   * 画像範囲外を防止。
   */
  const safeLeft =
    Math.max(
      0,
      Math.min(
        left,
        imageWidth - 1
      )
    );

  const safeTop =
    Math.max(
      0,
      Math.min(
        top,
        imageHeight - 1
      )
    );

  const safeWidth =
    Math.min(
      width,
      imageWidth -
        safeLeft
    );

  const safeHeight =
    Math.min(
      height,
      imageHeight -
        safeTop
    );

  if (
    safeWidth <= 0 ||
    safeHeight <= 0
  ) {
    return null;
  }

  const buffer =
    await sharp(
      imageBuffer
    )
      .extract({
        left:
          safeLeft,

        top:
          safeTop,

        width:
          safeWidth,

        height:
          safeHeight,
      })
      .resize({
        width:
          Math.max(
            600,
            safeWidth
          ),

        fit: "inside",

        withoutEnlargement:
          false,
      })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();

  return {
    buffer,

    x: safeLeft,

    y: safeTop,

    width: safeWidth,

    height: safeHeight,
  };
}

/* =========================================================
   Vision結果 → words
   ========================================================= */

function extractWords(
  annotation:
    vision.protos.google.cloud.vision.v1.ITextAnnotation | null
): OcrWord[] {
  if (!annotation) {
    return [];
  }

  const words: OcrWord[] =
    [];

  for (
    const page of
      annotation.pages ?? []
  ) {
    for (
      const block of
        page.blocks ?? []
    ) {
      for (
        const paragraph of
          block.paragraphs ?? []
      ) {
        for (
          const word of
            paragraph.words ?? []
        ) {
          const text =
            (
              word.symbols ?? []
            )
              .map(
                (symbol) =>
                  symbol.text ??
                  ""
              )
              .join("");

          if (!text) {
            continue;
          }

          const vertices =
            word
              .boundingBox
              ?.vertices ?? [];

          const boundingBox =
            normalizeBoundingBox(
              vertices
            );

          words.push({
            text,

            confidence:
              Number(
                word.confidence ??
                  0
              ),

            boundingBox,
          });
        }
      }
    }
  }

  return words;
}

/* =========================================================
   Bounding Box
   ========================================================= */

function normalizeBoundingBox(
  vertices: Array<
    vision.protos.google.cloud.vision.v1.IVertex
  >
) {
  if (
    vertices.length === 0
  ) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  const xs =
    vertices.map(
      (vertex) =>
        Number(
          vertex.x ?? 0
        )
    );

  const ys =
    vertices.map(
      (vertex) =>
        Number(
          vertex.y ?? 0
        )
    );

  const minX =
    Math.min(...xs);

  const maxX =
    Math.max(...xs);

  const minY =
    Math.min(...ys);

  const maxY =
    Math.max(...ys);

  return {
    x: minX,

    y: minY,

    width:
      Math.max(
        0,
        maxX - minX
      ),

    height:
      Math.max(
        0,
        maxY - minY
      ),
  };
}

/* =========================================================
   信頼度
   ========================================================= */

function calculateConfidence(
  words: OcrWord[]
): number {
  if (
    words.length === 0
  ) {
    return 0;
  }

  const valid =
    words.filter(
      (word) =>
        word.confidence >=
        MIN_CONFIDENCE
    );

  if (
    valid.length === 0
  ) {
    return 0;
  }

  const average =
    valid.reduce(
      (sum, word) =>
        sum +
        word.confidence,
      0
    ) /
    valid.length;

  return Math.max(
    0,
    Math.min(
      1,
      average
    )
  );
}
