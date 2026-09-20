import vision from "@google-cloud/vision";

import sharp from "sharp";

const client =
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

  processedAt: number;
};

/**
 * 答案ページをOCRする。
 *
 * Google Cloud Vision の
 * documentTextDetection を使用します。
 *
 * OCR結果には、
 *
 * ・全文
 * ・単語
 * ・信頼度
 * ・画像上の座標
 *
 * を保存します。
 */
export async function processAnswerPage(
  imageBuffer: Buffer,
  testId: string,
  subjectId: string
): Promise<OcrResult> {
  if (!imageBuffer.length) {
    throw new Error(
      "OCR対象の画像が空です。"
    );
  }

  const metadata =
    await sharp(imageBuffer)
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
      "OCR対象画像のサイズを取得できません。"
    );
  }

  const prepared =
    await prepareOcrImage(
      imageBuffer
    );

  const [
    result,
  ] =
    await client.documentTextDetection(
      {
        image: {
          content: prepared,
        },

        imageContext: {
          languageHints: [
            "ja",
            "en",
          ],
        },
      }
    );

  const annotation =
    result.fullTextAnnotation;

  if (!annotation) {
    return {
      text: "",
      words: [],
      width,
      height,
      processedAt: Date.now(),
    };
  }

  const words =
    extractWords(
      annotation
    );

  const text =
    annotation.text ?? "";

  /*
   * testId / subjectId は
   * OCR結果を採点処理へ紐付けるため、
   * 呼び出し側でgradingResultsに保存します。
   *
   * ここではOCRエンジン自体は
   * テスト固有の判定を行いません。
   */
  void testId;
  void subjectId;

  return {
    text,
    words,
    width,
    height,
    processedAt:
      Date.now(),
  };
}

/**
 * OCR前処理。
 *
 * 白黒化・ノイズ低減・適切な解像度への
 * 正規化を行います。
 */
async function prepareOcrImage(
  input: Buffer
): Promise<Buffer> {
  const metadata =
    await sharp(input)
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
      "画像サイズが不正です。"
    );
  }

  const targetWidth =
    Math.max(
      width,
      2480
    );

  return sharp(input)
    .rotate()
    .resize({
      width: targetWidth,
      fit: "inside",
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

/**
 * Visionの全文アノテーションから
 * 単語単位の座標を抽出します。
 */
function extractWords(
  annotation: vision.protos.google.cloud.vision.v1.ITextAnnotation
): OcrWord[] {
  const words: OcrWord[] = [];

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
            (word.symbols ?? [])
              .map(
                (symbol) =>
                  symbol.text ?? ""
              )
              .join("");

          if (!text) {
            continue;
          }

          const vertices =
            word.boundingBox
              ?.vertices ?? [];

          const box =
            normalizeBoundingBox(
              vertices
            );

          const confidence =
            Number(
              word.confidence ?? 0
            );

          words.push({
            text,
            confidence,
            boundingBox: box,
          });
        }
      }
    }
  }

  return words;
}

/**
 * Visionの4点座標を
 * x / y / width / height に変換します。
 */
function normalizeBoundingBox(
  vertices: Array<
    vision.protos.google.cloud.vision.v1.IVertex
  >
) {
  if (vertices.length === 0) {
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
        Number(vertex.x ?? 0)
    );

  const ys =
    vertices.map(
      (vertex) =>
        Number(vertex.y ?? 0)
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
