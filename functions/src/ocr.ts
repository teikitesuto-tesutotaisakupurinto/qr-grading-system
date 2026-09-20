import vision, {
  protos,
} from "@google-cloud/vision";

import {
  getFirestore,
} from "firebase-admin/firestore";

const db =
  getFirestore();

const client =
  new vision.ImageAnnotatorClient();

/* =========================================================
   型
   ========================================================= */

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

  confidence: number;

  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

/* =========================================================
   答案OCR
   ========================================================= */

export async function processAnswerPage(
  buffer: Buffer,
  testId: string,
  subjectId: string
): Promise<OcrResult> {
  if (buffer.length === 0) {
    throw new Error(
      "OCR対象画像が空です。"
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
        content: buffer,
      },
    });

  const annotation =
    result.fullTextAnnotation;

  const words =
    extractWords(
      annotation
    );

  return {
    text:
      annotation?.text ??
      "",

    words,

    width:
      getPageWidth(
        annotation
      ),

    height:
      getPageHeight(
        annotation
      ),

    confidence:
      calculateConfidence(
        words
      ),

    processedAt:
      Date.now(),
  };
}

/* =========================================================
   問題別OCR
   ========================================================= */

export async function processAnswerRegions(
  buffer: Buffer,
  testId: string,
  subjectId: string
): Promise<OcrRegionResult[]> {
  if (buffer.length === 0) {
    throw new Error(
      "OCR対象画像が空です。"
    );
  }

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

  if (snapshot.empty) {
    return [];
  }

  const [
    result,
  ] =
    await client.documentTextDetection({
      image: {
        content: buffer,
      },
    });

  const annotation =
    result.fullTextAnnotation;

  const words =
    extractWords(
      annotation
    );

  const fullText =
    annotation?.text ??
    "";

  const fullConfidence =
    calculateConfidence(
      words
    );

  return snapshot.docs.map(
    (regionDoc) => {
      const data =
        regionDoc.data();

      return {
        regionId:
          regionDoc.id,

        questionId:
          typeof data.questionId ===
          "string"
            ? data.questionId
            : undefined,

        text:
          typeof data.text ===
          "string"
            ? data.text
            : fullText,

        confidence:
          Number.isFinite(
            Number(
              data.confidence
            )
          )
            ? Number(
                data.confidence
              )
            : fullConfidence,

        boundingBox: {
          x:
            toNumber(
              data.x ??
                data.left
            ),

          y:
            toNumber(
              data.y ??
                data.top
            ),

          width:
            toNumber(
              data.width
            ),

          height:
            toNumber(
              data.height
            ),
        },
      };
    }
  );
}

/* =========================================================
   Word抽出
   ========================================================= */

function extractWords(
  annotation:
    protos.google.cloud.vision.v1.ITextAnnotation
    | null
    | undefined
): OcrWord[] {
  if (!annotation?.pages) {
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
                (
                  symbol: protos.google.cloud.vision.v1.ISymbol
                ) =>
                  symbol.text ??
                  ""
              )
              .join("");

          if (!text) {
            continue;
          }

          words.push({
            text,

            confidence:
              typeof word.confidence ===
              "number"
                ? word.confidence
                : 0,

            boundingBox:
              normalizeBoundingBox(
                word.boundingBox
                  ?.vertices ??
                  []
              ),
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
      (
        vertex: protos.google.cloud.vision.v1.IVertex
      ) =>
        Number(
          vertex.x ?? 0
        )
    );

  const ys =
    vertices.map(
      (
        vertex: protos.google.cloud.vision.v1.IVertex
      ) =>
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
          Number.isFinite(
            value
          )
      );

  if (
    values.length === 0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    values.length
  );
}

/* =========================================================
   ページサイズ
   ========================================================= */

function getPageWidth(
  annotation:
    protos.google.cloud.vision.v1.ITextAnnotation
    | null
    | undefined
): number {
  return toNumber(
    annotation?.pages?.[0]?.width
  );
}

function getPageHeight(
  annotation:
    protos.google.cloud.vision.v1.ITextAnnotation
    | null
    | undefined
): number {
  return toNumber(
    annotation?.pages?.[0]?.height
  );
}

function toNumber(
  value: unknown
): number {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}
