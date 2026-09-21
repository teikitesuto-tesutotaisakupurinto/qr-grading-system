import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2.57.0";

/*
 * =========================================================
 * Environment
 * =========================================================
 */

const supabaseUrl =
  Deno.env.get(
    "SUPABASE_URL"
  ) ?? "";

const supabaseServiceRoleKey =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  ) ?? "";

const firebaseProjectId =
  Deno.env.get(
    "FIREBASE_PROJECT_ID"
  ) ?? "";

const firebaseClientEmail =
  Deno.env.get(
    "FIREBASE_CLIENT_EMAIL"
  ) ?? "";

const firebasePrivateKey =
  Deno.env.get(
    "FIREBASE_PRIVATE_KEY"
  ) ?? "";

const ocrProviderUrl =
  Deno.env.get(
    "OCR_PROVIDER_URL"
  ) ?? "";

const ocrProviderApiKey =
  Deno.env.get(
    "OCR_PROVIDER_API_KEY"
  ) ?? "";

const answersBucket =
  "answers";

/*
 * =========================================================
 * Supabase
 * =========================================================
 */

const supabase =
  createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );

/*
 * =========================================================
 * Types
 * =========================================================
 */

type AnswerDocument = {
  organizationId: string;

  testId: string;

  testCode?: string;

  schoolId?: string;

  studentId?: string | null;

  studentNumber?: string | null;

  storagePath: string;

  status?: string;

  qrStatus?: string;

  qrError?: string | null;

  ocrStatus?: string;

  ocrError?: string | null;

  gradingStatus?: string;

  firstReviewStatus?: string;

  secondReviewStatus?: string;

  finalized?: boolean;
};

type OCRBlock = {
  text: string;

  confidence:
    | number
    | null;

  boundingBox:
    | BoundingBox
    | null;

  page:
    | number
    | null;
};

type BoundingBox = {
  x: number;

  y: number;

  width: number;

  height: number;
};

type OCRResponse = {
  blocks: OCRBlock[];

  fullText: string;

  provider: string;
};

/*
 * =========================================================
 * CORS
 * =========================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

/*
 * =========================================================
 * Response
 * =========================================================
 */

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(
      body
    ),
    {
      status,

      headers: {
        ...corsHeaders,

        "Content-Type":
          "application/json",
      },
    }
  );
}

/*
 * =========================================================
 * Main
 * =========================================================
 */

Deno.serve(
  async (
    request
  ) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return json(
        {
          ok: false,

          message:
            "POSTで実行してください。",
        },
        405
      );
    }

    try {
      /*
       * 必須設定
       */

      if (
        !supabaseUrl ||
        !supabaseServiceRoleKey
      ) {
        console.error(
          "Supabase configuration is missing."
        );

        return json(
          {
            ok: false,

            message:
              "サーバー設定を確認してください。",
          },
          500
        );
      }

      if (
        !firebaseProjectId ||
        !firebaseClientEmail ||
        !firebasePrivateKey
      ) {
        console.error(
          "Firebase service account configuration is missing."
        );

        return json(
          {
            ok: false,

            message:
              "Firebaseサーバー設定を確認してください。",
          },
          500
        );
      }

      if (
        !ocrProviderUrl ||
        !ocrProviderApiKey
      ) {
        console.error(
          "OCR provider configuration is missing."
        );

        return json(
          {
            ok: false,

            message:
              "OCRサービスの設定が完了していません。",
          },
          500
        );
      }

      /*
       * Request
       */

      const body =
        await request.json();

      const answerId =
        typeof body.answerId ===
        "string"
          ? body.answerId
          : "";

      if (
        !answerId
      ) {
        return json(
          {
            ok: false,

            message:
              "答案IDが指定されていません。",
          },
          400
        );
      }

      /*
       * Answer
       */

      const answer =
        await getAnswer(
          answerId
        );

      if (
        !answer
      ) {
        return json(
          {
            ok: false,

            message:
              "答案情報が見つかりません。",
          },
          404
        );
      }

      /*
       * QR解析が終わっていない答案は
       * OCRしない。
       */

      if (
        answer.qrStatus !==
        "認識済み"
      ) {
        await updateAnswer(
          answerId,
          {
            status:
              "QR解析待ち",

            ocrStatus:
              "未処理",

            updatedAt:
              new Date().toISOString(),
          }
        );

        return json(
          {
            ok: false,

            answerId,

            status:
              "QR解析待ち",

            message:
              "QR解析が完了していません。",
          },
          409
        );
      }

      /*
       * 二重処理防止
       */

      if (
        answer.ocrStatus ===
        "処理中"
      ) {
        return json({
          ok: true,

          answerId,

          status:
            "OCR処理中",
        });
      }

      if (
        answer.ocrStatus ===
        "完了"
      ) {
        return json({
          ok: true,

          answerId,

          status:
            "OCR完了",
        });
      }

      /*
       * OCR開始
       */

      await updateAnswer(
        answerId,
        {
          status:
            "OCR処理中",

          ocrStatus:
            "処理中",

          ocrError:
            null,

          updatedAt:
            new Date().toISOString(),
        }
      );

      /*
       * Storageから答案画像取得
       */

      const image =
        await downloadAnswerImage(
          answer.storagePath
        );

      /*
       * OCR実行
       */

      const ocr =
        await runOCR(
          image,
          answer
        );

      if (
        ocr.blocks.length ===
        0 &&
        !ocr.fullText.trim()
      ) {
        await updateAnswer(
          answerId,
          {
            status:
              "OCR失敗",

            ocrStatus:
              "失敗",

            ocrError:
              "答案画像から文字を認識できませんでした。",

            updatedAt:
              new Date().toISOString(),
          }
        );

        return json(
          {
            ok: false,

            answerId,

            status:
              "OCR失敗",

            message:
              "答案画像から文字を認識できませんでした。",
          },
          422
        );
      }

      /*
       * OCR結果保存
       */

      await saveOCRResult(
        answerId,
        ocr
      );

      /*
       * OCR完了
       *
       * 自動採点へ渡す。
       */

      await updateAnswer(
        answerId,
        {
          status:
            "採点待ち",

          ocrStatus:
            "完了",

          ocrError:
            null,

          gradingStatus:
            "未採点",

          updatedAt:
            new Date().toISOString(),
        }
      );

      /*
       * 自動採点Functionへ渡す。
       */

      await enqueueGrading(
        answerId
      );

      return json({
        ok: true,

        answerId,

        status:
          "採点待ち",

        ocrStatus:
          "完了",

        blockCount:
          ocr.blocks.length,

        provider:
          ocr.provider,
      });
    } catch (
      error
    ) {
      console.error(
        "process-ocr error:",
        error
      );

      return json(
        {
          ok: false,

          message:
            "OCR処理に失敗しました。",
        },
        500
      );
    }
  }
);

/*
 * =========================================================
 * OCR Provider
 * =========================================================
 *
 * OCR_PROVIDER_URL に登録したOCRサービスへ
 * multipart/form-dataで画像を送る。
 *
 * OCRサービス側のレスポンスは、
 * 以下の形式に正規化する。
 *
 * {
 *   "fullText": "...",
 *   "blocks": [
 *     {
 *       "text": "...",
 *       "confidence": 0.98,
 *       "boundingBox": {
 *         "x": 10,
 *         "y": 20,
 *         "width": 100,
 *         "height": 30
 *       },
 *       "page": 1
 *     }
 *   ]
 * }
 *
 * この形式にすることで、OCR業者を変更しても
 * 採点側のデータ構造を変更しなくて済む。
 */

async function runOCR(
  image: ArrayBuffer,
  answer: AnswerDocument
): Promise<OCRResponse> {
  const form =
    new FormData();

  const blob =
    new Blob(
      [
        image,
      ],
      {
        type:
          detectImageType(
            image
          ),
      }
    );

  form.append(
    "file",
    blob,
    getFileName(
      answer.storagePath
    )
  );

  form.append(
    "language",
    "ja"
  );

  form.append(
    "answerId",
    "unknown"
  );

  form.append(
    "testId",
    answer.testCode ??
      answer.testId
  );

  const response =
    await fetch(
      ocrProviderUrl,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${ocrProviderApiKey}`,
        },

        body:
          form,
      }
    );

  if (
    !response.ok
  ) {
    const text =
      await response.text();

    console.error(
      "OCR provider error:",
      text
    );

    throw new Error(
      "OCRサービスの処理に失敗しました。"
    );
  }

  const data =
    await response.json();

  return normalizeOCRResponse(
    data
  );
}

/*
 * =========================================================
 * OCR response normalization
 * =========================================================
 */

function normalizeOCRResponse(
  data: any
): OCRResponse {
  const fullText =
    typeof data.fullText ===
    "string"
      ? data.fullText
      : typeof data.text ===
        "string"
        ? data.text
        : "";

  const rawBlocks =
    Array.isArray(
      data.blocks
    )
      ? data.blocks
      : Array.isArray(
          data.words
        )
        ? data.words
        : [];

  const blocks: OCRBlock[] =
    rawBlocks
      .map(
        (
          block: any
        ): OCRBlock => {
          const text =
            typeof block.text ===
            "string"
              ? block.text
              : "";

          const confidence =
            typeof block.confidence ===
            "number"
              ? block.confidence
              : null;

          const boundingBox =
            normalizeBoundingBox(
              block.boundingBox ??
                block.boundingPoly
            );

          const page =
            typeof block.page ===
            "number"
              ? block.page
              : null;

          return {
            text,

            confidence,

            boundingBox,

            page,
          };
        }
      )
      .filter(
        (
          block
        ) =>
          block.text.trim()
            .length > 0
      );

  return {
    blocks,

    fullText,

    provider:
      "configured-ocr-provider",
  };
}

/*
 * =========================================================
 * Bounding box
 * =========================================================
 */

function normalizeBoundingBox(
  value: any
): BoundingBox | null {
  if (
    !value
  ) {
    return null;
  }

  if (
    typeof value.x ===
      "number" &&
    typeof value.y ===
      "number" &&
    typeof value.width ===
      "number" &&
    typeof value.height ===
      "number"
  ) {
    return {
      x:
        value.x,

      y:
        value.y,

      width:
        value.width,

      height:
        value.height,
    };
  }

  if (
    Array.isArray(
      value.vertices
    ) &&
    value.vertices.length >
      0
  ) {
    const points =
      value.vertices
        .map(
          (
            point: any
          ) => ({
            x:
              typeof point.x ===
              "number"
                ? point.x
                : 0,

            y:
              typeof point.y ===
              "number"
                ? point.y
                : 0,
          })
        );

    const minX =
      Math.min(
        ...points.map(
          (
            point: any
          ) =>
            point.x
        )
      );

    const maxX =
      Math.max(
        ...points.map(
          (
            point: any
          ) =>
            point.x
        )
      );

    const minY =
      Math.min(
        ...points.map(
          (
            point: any
          ) =>
            point.y
        )
      );

    const maxY =
      Math.max(
        ...points.map(
          (
            point: any
          ) =>
            point.y
        )
      );

    return {
      x:
        minX,

      y:
        minY,

      width:
        maxX -
        minX,

      height:
        maxY -
        minY,
    };
  }

  return null;
}

/*
 * =========================================================
 * Storage
 * =========================================================
 */

async function downloadAnswerImage(
  storagePath: string
) {
  const result =
    await supabase.storage
      .from(
        answersBucket
      )
      .download(
        storagePath
      );

  if (
    result.error
  ) {
    console.error(
      result.error
    );

    throw new Error(
      "答案画像を取得できませんでした。"
    );
  }

  return await result.data.arrayBuffer();
}

/*
 * =========================================================
 * Firestore
 * =========================================================
 */

async function getFirestoreAccessToken() {
  if (
    !firebaseClientEmail ||
    !firebasePrivateKey ||
    !firebaseProjectId
  ) {
    throw new Error(
      "Firebase Service Account設定がありません。"
    );
  }

  const now =
    Math.floor(
      Date.now() /
        1000
    );

  const header =
    base64UrlEncode(
      JSON.stringify({
        alg:
          "RS256",

        typ:
          "JWT",
      })
    );

  const payload =
    base64UrlEncode(
      JSON.stringify({
        iss:
          firebaseClientEmail,

        scope:
          "https://www.googleapis.com/auth/datastore",

        aud:
          "https://oauth2.googleapis.com/token",

        iat:
          now,

        exp:
          now + 3600,
      })
    );

  const input =
    `${header}.${payload}`;

  const key =
    await importPrivateKey(
      firebasePrivateKey
    );

  const signature =
    await crypto.subtle.sign(
      {
        name:
          "RSASSA-PKCS1-v1_5",
      },
      key,
      new TextEncoder().encode(
        input
      )
    );

  const jwt =
    `${input}.${base64UrlBytes(
      new Uint8Array(
        signature
      )
    )}`;

  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            grant_type:
              "urn:ietf:params:oauth:grant-type:jwt-bearer",

            assertion:
              jwt,
          }),
      }
    );

  if (
    !response.ok
  ) {
    console.error(
      await response.text()
    );

    throw new Error(
      "Firestore認証に失敗しました。"
    );
  }

  const data =
    await response.json();

  return data.access_token as string;
}

/*
 * =========================================================
 * Firestore GET
 * =========================================================
 */

async function firestoreGet(
  path: string
) {
  const token =
    await getFirestoreAccessToken();

  const response =
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

  if (
    response.status ===
    404
  ) {
    return null;
  }

  if (
    !response.ok
  ) {
    console.error(
      await response.text()
    );

    throw new Error(
      "Firestoreからデータを取得できませんでした。"
    );
  }

  return response.json();
}

/*
 * =========================================================
 * Firestore PATCH
 * =========================================================
 */

async function firestorePatch(
  path: string,
  fields: Record<
    string,
    unknown
  >
) {
  const token =
    await getFirestoreAccessToken();

  const response =
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/${path}`,
      {
        method:
          "PATCH",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            fields:
              objectToFirestoreFields(
                fields
              ),
          }),
      }
    );

  if (
    !response.ok
  ) {
    console.error(
      await response.text()
    );

    throw new Error(
      "Firestoreの更新に失敗しました。"
    );
  }

  return response.json();
}

/*
 * =========================================================
 * Answer
 * =========================================================
 */

async function getAnswer(
  answerId: string
): Promise<AnswerDocument | null> {
  const document =
    await firestoreGet(
      `answers/${answerId}`
    );

  if (
    !document?.fields
  ) {
    return null;
  }

  return firestoreFieldsToObject(
    document.fields
  ) as AnswerDocument;
}

async function updateAnswer(
  answerId: string,
  fields: Record<
    string,
    unknown
  >
) {
  await firestorePatch(
    `answers/${answerId}`,
    fields
  );
}

/*
 * =========================================================
 * OCR result
 * =========================================================
 */

async function saveOCRResult(
  answerId: string,
  result: OCRResponse
) {
  /*
   * OCR全体結果
   */

  await firestorePatch(
    `answerOcrResults/${answerId}`,
    {
      answerId,

      provider:
        result.provider,

      fullText:
        result.fullText,

      blockCount:
        result.blocks.length,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    }
  );

  /*
   * 問題別解析ができるよう、
   * 各OCRブロックも保存。
   */

  for (
    let i = 0;
    i < result.blocks.length;
    i++
  ) {
    const block =
      result.blocks[i];

    await firestorePatch(
      `answerOcrResults/${answerId}/blocks/block-${i + 1}`,
      {
        answerId,

        blockIndex:
          i,

        text:
          block.text,

        confidence:
          block.confidence,

        boundingBox:
          block.boundingBox,

        page:
          block.page,

        createdAt:
          new Date().toISOString(),
      }
    );
  }
}

/*
 * =========================================================
 * Grading queue
 * =========================================================
 */

async function enqueueGrading(
  answerId: string
) {
  const functionUrl =
    Deno.env.get(
      "PROCESS_GRADING_FUNCTION_URL"
    );

  if (
    !functionUrl
  ) {
    /*
     * Functionがまだデプロイされていない
     * 状態でもOCR結果自体は保持する。
     */

    console.warn(
      "PROCESS_GRADING_FUNCTION_URL is not configured."
    );

    return;
  }

  try {
    const response =
      await fetch(
        functionUrl,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              answerId,
            }),
        }
      );

    if (
      !response.ok
    ) {
      console.error(
        "Grading enqueue failed:",
        await response.text()
      );
    }
  } catch (
    error
  ) {
    console.error(
      "Grading enqueue error:",
      error
    );
  }
}

/*
 * =========================================================
 * File helpers
 * =========================================================
 */

function detectImageType(
  buffer: ArrayBuffer
) {
  const bytes =
    new Uint8Array(
      buffer
    );

  /*
   * JPEG
   */
  if (
    bytes[0] ===
      0xff &&
    bytes[1] ===
      0xd8
  ) {
    return "image/jpeg";
  }

  /*
   * PNG
   */
  if (
    bytes[0] ===
      0x89 &&
    bytes[1] ===
      0x50 &&
    bytes[2] ===
      0x4e &&
    bytes[3] ===
      0x47
  ) {
    return "image/png";
  }

  return "application/octet-stream";
}

function getFileName(
  path: string
) {
  const parts =
    path.split(
      "/"
    );

  return (
    parts[
      parts.length - 1
    ] ??
    "answer-image"
  );
}

/*
 * =========================================================
 * Firestore conversion
 * =========================================================
 */

function firestoreFieldsToObject(
  fields: Record<
    string,
    any
  >
) {
  const result:
    Record<
      string,
      unknown
    > = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      fields
    )
  ) {
    result[key] =
      firestoreValueToJS(
        value
      );
  }

  return result;
}

function firestoreValueToJS(
  value: any
): unknown {
  if (
    value.stringValue !==
    undefined
  ) {
    return value.stringValue;
  }

  if (
    value.integerValue !==
    undefined
  ) {
    return Number(
      value.integerValue
    );
  }

  if (
    value.doubleValue !==
    undefined
  ) {
    return value.doubleValue;
  }

  if (
    value.booleanValue !==
    undefined
  ) {
    return value.booleanValue;
  }

  if (
    value.timestampValue !==
    undefined
  ) {
    return value.timestampValue;
  }

  if (
    value.nullValue !==
    undefined
  ) {
    return null;
  }

  if (
    value.arrayValue
  ) {
    return (
      value.arrayValue.values ??
      []
    ).map(
      (
        item: any
      ) =>
        firestoreValueToJS(
          item
        )
    );
  }

  if (
    value.mapValue
  ) {
    return firestoreFieldsToObject(
      value.mapValue.fields ??
        {}
    );
  }

  return null;
}

function objectToFirestoreFields(
  data: Record<
    string,
    unknown
  >
) {
  const fields:
    Record<
      string,
      unknown
    > = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      data
    )
  ) {
    fields[key] =
      jsToFirestoreValue(
        value
      );
  }

  return fields;
}

function jsToFirestoreValue(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    value ===
    null
  ) {
    return {
      nullValue:
        null,
    };
  }

  if (
    typeof value ===
    "string"
  ) {
    return {
      stringValue:
        value,
    };
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return {
      booleanValue:
        value,
    };
  }

  if (
    typeof value ===
    "number"
  ) {
    if (
      Number.isInteger(
        value
      )
    ) {
      return {
        integerValue:
          String(
            value
          ),
      };
    }

    return {
      doubleValue:
        value,
    };
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return {
      arrayValue: {
        values:
          value.map(
            (
              item
            ) =>
              jsToFirestoreValue(
                item
              )
          ),
      },
    };
  }

  if (
    typeof value ===
    "object"
  ) {
    return {
      mapValue: {
        fields:
          objectToFirestoreFields(
            value as Record<
              string,
              unknown
            >
          ),
      },
    };
  }

  return {
    nullValue:
      null,
  };
}

/*
 * =========================================================
 * Base64
 * =========================================================
 */

function base64UrlEncode(
  value: string
) {
  return base64UrlBytes(
    new TextEncoder().encode(
      value
    )
  );
}

function base64UrlBytes(
  bytes: Uint8Array
) {
  let binary =
    "";

  for (
    const byte of bytes
  ) {
    binary += String.fromCharCode(
      byte
    );
  }

  return btoa(
    binary
  )
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/,
      ""
    );
}

/*
 * =========================================================
 * Private key
 * =========================================================
 */

async function importPrivateKey(
  pem: string
) {
  const normalized =
    pem
      .replace(
        /\\n/g,
        "\n"
      )
      .replace(
        "-----BEGIN PRIVATE KEY-----",
        ""
      )
      .replace(
        "-----END PRIVATE KEY-----",
        ""
      )
      .replace(
        /\s/g,
        ""
      );

  const binary =
    atob(
      normalized
    );

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(
        i
      );
  }

  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    {
      name:
        "RSASSA-PKCS1-v1_5",

      hash:
        "SHA-256",
    },
    false,
    [
      "sign",
    ]
  );
}
