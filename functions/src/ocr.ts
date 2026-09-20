import vision, {
  protos,
} from "@google-cloud/vision";

export type OcrWord = {
  text: string;

  confidence?: number;

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

  confidence: number;
};

const client =
  new vision.ImageAnnotatorClient();

/* =========================================================
   答案OCR
   ========================================================= */

export async function processAnswerPage(
  buffer: Buffer,
  testId: string,
  subjectId: string
): Promise<OcrResult> {
  if (
    buffer.length === 0
  ) {
    throw new Error(
      "OCR対象の画像が空です。"
    );
  }

  if (!testId) {
    throw new Error(
      "testIdがありません。"
    );
  }

  if (!subjectId) {
    throw new Error(
      "subjectIdがありません。"
    );
  }

  const [
    result,
  ] =
    await client.documentTextDetection({
      image: {
        content:
          buffer,
      },
    });

  const annotation =
    result.fullTextAnnotation;

  const text =
    annotation?.text ??
    "";

  const words =
    extractWords(
      annotation
    );

  const confidence =
    calculateConfidence(
      words
    );

  return {
    text,

    words,

    confidence,
  };
}

/* =========================================================
   Word抽出
   ========================================================= */

function extractWords(
  annotation:
    protos.google.cloud.vision.v1.ITextAnnotation
    | null
): OcrWord[] {
  if (
    !annotation?.pages
  ) {
    return [];
  }

  const words: OcrWord[] =
    [];

  for (
    const page of
      annotation.pages
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
                  symbol.text ??
                  ""
              )
              .join("");

          if (!text) {
            continue;
          }

          const boundingBox =
            normalizeBoundingBox(
              word
                .boundingBox
                ?.vertices
                ?? []
            );

          const confidence =
            typeof word.confidence ===
            "number"
              ? word.confidence
              : undefined;

          words.push({
            text,

            confidence,

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
    protos.google.cloud.vision.v1.IVertex
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
    Math.min(
      ...xs
    );

  const maxX =
    Math.max(
      ...xs
    );

  const minY =
    Math.min(
      ...ys
    );

  const maxY =
    Math.max(
      ...ys
    );

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

  const values =
    words
      .map(
        (word) =>
          word.confidence
      )
      .filter(
        (
          value
        ): value is number =>
          typeof value ===
          "number"
      );

  if (
    values.length === 0
  ) {
    return 0;
  }

  const total =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  return (
    total /
    values.length
  );
}
