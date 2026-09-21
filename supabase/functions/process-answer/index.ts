import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2.57.0";

import jsQR from "npm:jsqr@1.4.0";

import jpeg from "npm:jpeg-js@0.4.4";

import {
  PNG,
} from "npm:pngjs@7.0.0";

/* =========================================================
   Environment
   ========================================================= */

const supabaseUrl =
  Deno.env.get(
    "SUPABASE_URL"
  ) ?? "";

const supabaseServiceRoleKey =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  ) ?? "";

const answersBucket =
  "answers";

/* =========================================================
   Supabase
   ========================================================= */

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

/* =========================================================
   Types
   ========================================================= */

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

  gradingStatus?: string;

  firstReviewStatus?: string;

  secondReviewStatus?: string;

  finalized?: boolean;
};

type QRResult = {
  testId: string | null;

  studentNumber: string | null;
};

/* =========================================================
   CORS
   ========================================================= */

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

/* =========================================================
   Response
   ========================================================= */

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

/* =========================================================
   Main
   ========================================================= */

Deno.serve(
  async (request) => {
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
       * Service Role Keyの確認
       */
      if (
        !supabaseUrl ||
        !supabaseServiceRoleKey
      ) {
        console.error(
          "Supabase environment variables are missing."
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

      /*
       * リクエスト
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
       * Firestoreではなく、
       * 現在のプロジェクトでは
       * Firestore REST APIを使用する。
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
       * 既に確定済みなら処理しない。
       */
      if (
        answer.finalized ===
        true
      ) {
        return json({
          ok: true,

          answerId,

          status:
            "確定済み",
        });
      }

      /*
       * 処理開始
       */
      await updateAnswer(
        answerId,
        {
          status:
            "QR解析中",

          qrStatus:
            "解析中",

          qrError:
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
       * QR解析
       */
      const qr =
        await detectQRs(
          image
        );

      /*
       * QRが見つからない
       */
      if (
        !qr.testId &&
        !qr.studentNumber
      ) {
        await updateAnswer(
          answerId,
          {
            status:
              "QR認識失敗",

            qrStatus:
              "認識失敗",

            qrError:
              "答案画像からQRコードを認識できませんでした。",

            updatedAt:
              new Date().toISOString(),
          }
        );

        return json({
          ok: false,

          answerId,

          status:
            "QR認識失敗",

          message:
            "答案画像からQRコードを認識できませんでした。",
        });
      }

      /*
       * テストID確認
       */
      let testId =
        qr.testId ??
        answer.testCode ??
        null;

      if (
        !testId
      ) {
        await updateAnswer(
          answerId,
          {
            status:
              "QR認識失敗",

            qrStatus:
              "認識失敗",

            qrError:
              "テストID QRを認識できませんでした。",

            updatedAt:
              new Date().toISOString(),
          }
        );

        return json({
          ok: false,

          answerId,

          status:
            "QR認識失敗",

          message:
            "テストID QRを認識できませんでした。",
        });
      }

      /*
       * テスト照合
       */
      const test =
        await findTest(
          answer.organizationId,
          testId
        );

      if (
        !test
      ) {
        await updateAnswer(
          answerId,
          {
            status:
              "QR認識失敗",

            qrStatus:
              "認識失敗",

            qrError:
              "認識したテストIDが登録されていません。",

            updatedAt:
              new Date().toISOString(),
          }
        );

        return json({
          ok: false,

          answerId,

          status:
            "QR認識失敗",

          message:
            "認識したテストIDが登録されていません。",
        });
      }

      /*
       * 生徒番号確認
       */
      if (
        !qr.studentNumber
      ) {
        await updateAnswer(
          answerId,
          {
            testId:
              test.id,

            testCode:
              test.testId,

            status:
              "QR認識失敗",

            qrStatus:
              "認識失敗",

            qrError:
              "生徒QRを認識できませんでした。",

            updatedAt:
              new Date().toISOString(),
          }
        );

        return json({
          ok: false,

          answerId,

          status:
            "QR認識失敗",

          message:
            "生徒QRを認識できませんでした。",
        });
      }

      /*
       * 生徒照合
       */
      const student =
        await findStudent(
          answer.organizationId,
          qr.studentNumber
        );

      if (
        !student
      ) {
        await updateAnswer(
          answerId,
          {
            testId:
              test.id,

            testCode:
              test.testId,

            studentNumber:
              qr.studentNumber,

            status:
              "QR認識失敗",

            qrStatus:
              "認識失敗",

            qrError:
              "認識した生徒番号が登録されていません。",

            updatedAt:
              new Date().toISOString(),
          }
        );

        return json({
          ok: false,

          answerId,

          status:
            "QR認識失敗",

          message:
            "認識した生徒番号が登録されていません。",
        });
      }

      /*
       * テストと生徒の校舎確認
       */
      if (
        test.schoolId !==
        student.schoolId
      ) {
        await updateAnswer(
          answerId,
          {
            testId:
              test.id,

            testCode:
              test.testId,

            studentId:
              student.id,

            studentNumber:
              student.studentNumber,

            status:
              "QR認識失敗",

            qrStatus:
              "認識失敗",

            qrError:
              "テストと生徒の所属校舎が一致しません。",

            updatedAt:
              new Date().toISOString(),
          }
        );

        return json({
          ok: false,

          answerId,

          status:
            "QR認識失敗",

          message:
            "テストと生徒の所属校舎が一致しません。",
        });
      }

      /*
       * QR解析成功
       *
       * 次はOCR待ち。
       */
      await updateAnswer(
        answerId,
        {
          testId:
            test.id,

          testCode:
            test.testId,

          studentId:
            student.id,

          studentNumber:
            student.studentNumber,

          schoolId:
            student.schoolId,

          status:
            "OCR待ち",

          qrStatus:
            "認識済み",

          qrError:
            null,

          ocrStatus:
            "未処理",

          gradingStatus:
            "未採点",

          updatedAt:
            new Date().toISOString(),
        }
      );

      /*
       * 次のOCR処理へ渡す。
       *
       * 今はここではOCRを直接実行せず、
       * 独立したprocess-ocr Functionへ
       * 引き渡す。
       */
      await enqueueOCR(
        answerId
      );

      return json({
        ok: true,

        answerId,

        status:
          "OCR待ち",

        testId:
          test.testId,

        studentNumber:
          student.studentNumber,
      });
    } catch (
      error
    ) {
      console.error(
        "process-answer error:",
        error
      );

      return json(
        {
          ok: false,

          message:
            "答案の自動処理に失敗しました。",
        },
        500
      );
    }
  }
);

/* =========================================================
   Firestore
   ========================================================= */

/*
 * 注意：
 *
 * この関数ではFirebase Admin SDKを使わず、
 * Firestore REST APIを使用する。
 *
 * 本番ではFirebase Service Accountを
 * Supabase Edge Function Secretsに保存する。
 */

async function getFirestoreAccessToken() {
  /*
   * 実際のJWT発行処理をここで行う。
   *
   * Service Account秘密鍵を
   * Supabase Secretから取得する。
   */

  const clientEmail =
    Deno.env.get(
      "FIREBASE_CLIENT_EMAIL"
    );

  const privateKey =
    Deno.env.get(
      "FIREBASE_PRIVATE_KEY"
    );

  if (
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      "Firebase Service Account設定がありません。"
    );
  }

  /*
   * Service Account JWT。
   */

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
          clientEmail,

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

  const signingInput =
    `${header}.${payload}`;

  const key =
    await importPrivateKey(
      privateKey
    );

  const signature =
    await crypto.subtle.sign(
      {
        name:
          "RSASSA-PKCS1-v1_5",
      },
      key,
      new TextEncoder().encode(
        signingInput
      )
    );

  const jwt =
    `${signingInput}.${base64UrlBytes(
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

  const token =
    await response.json();

  return token.access_token as string;
}

/* =========================================================
   Firestore GET
   ========================================================= */

async function firestoreGet(
  path: string
) {
  const token =
    await getFirestoreAccessToken();

  const projectId =
    Deno.env.get(
      "FIREBASE_PROJECT_ID"
    );

  if (
    !projectId
  ) {
    throw new Error(
      "Firebase Project IDが設定されていません。"
    );
  }

  const response =
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
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

/* =========================================================
   Firestore PATCH
   ========================================================= */

async function firestorePatch(
  path: string,
  fields: Record<
    string,
    unknown
  >
) {
  const token =
    await getFirestoreAccessToken();

  const projectId =
    Deno.env.get(
      "FIREBASE_PROJECT_ID"
    );

  if (
    !projectId
  ) {
    throw new Error(
      "Firebase Project IDが設定されていません。"
    );
  }

  const firestoreFields =
    objectToFirestoreFields(
      fields
    );

  const response =
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
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
              firestoreFields,
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

/* =========================================================
   Answer
   ========================================================= */

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

/* =========================================================
   Test
   ========================================================= */

async function findTest(
  organizationId: string,
  testId: string
) {
  const result =
    await firestoreQuery(
      "tests",
      [
        [
          "organizationId",
          "==",
          organizationId,
        ],
        [
          "testId",
          "==",
          testId,
        ],
      ]
    );

  if (
    result.length ===
    0
  ) {
    return null;
  }

  return result[0];
}

/* =========================================================
   Student
   ========================================================= */

async function findStudent(
  organizationId: string,
  studentNumber: string
) {
  const result =
    await firestoreQuery(
      "students",
      [
        [
          "organizationId",
          "==",
          organizationId,
        ],
        [
          "studentNumber",
          "==",
          studentNumber,
        ],
      ]
    );

  if (
    result.length ===
    0
  ) {
    return null;
  }

  return result[0];
}

/* =========================================================
   Firestore query
   ========================================================= */

async function firestoreQuery(
  collectionName: string,
  filters: Array<
    [
      string,
      string,
      string
    ]
  >
) {
  const token =
    await getFirestoreAccessToken();

  const projectId =
    Deno.env.get(
      "FIREBASE_PROJECT_ID"
    );

  if (
    !projectId
  ) {
    throw new Error(
      "Firebase Project IDが設定されていません。"
    );
  }

  const structuredQuery = {
    from: [
      {
        collectionId:
          collectionName,
      },
    ],

    where: {
      compositeFilter: {
        op:
          "AND",

        filters:
          filters.map(
            (
              [
                field,
                op,
                value,
              ]
            ) => ({
              fieldFilter: {
                field: {
                  fieldPath:
                    field,
                },

                op:
                  firestoreOperator(
                    op
                  ),

                value:
                  firestoreValue(
                    value
                  ),
              },
            })
          ),
      },
    },
  };

  const response =
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            structuredQuery,
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
      "Firestore検索に失敗しました。"
    );
  }

  const rows =
    await response.json();

  return rows
    .filter(
      (
        row: any
      ) =>
        row.document
    )
    .map(
      (
        row: any
      ) =>
        firestoreFieldsToObject(
          row.document.fields
        )
    );
}

/* =========================================================
   Storage
   ========================================================= */

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

/* =========================================================
   QR detection
   ========================================================= */

async function detectQRs(
  buffer: ArrayBuffer
): Promise<QRResult> {
  const bytes =
    new Uint8Array(
      buffer
    );

  /*
   * 画像デコード
   */

  const decoded =
    await decodeImage(
      bytes
    );

  if (
    !decoded
  ) {
    throw new Error(
      "画像を解析できませんでした。"
    );
  }

  /*
   * QR検出。
   *
   * 1枚の答案には、
   * テストID QRと生徒QRの
   * 複数コードが存在するため、
   * 画像全体を複数回スキャンする。
   */

  const results: string[] =
    [];

  /*
   * 通常画像
   */
  scanImage(
    decoded.data,
    decoded.width,
    decoded.height,
    results
  );

  /*
   * 上部領域
   *
   * テストID QRは答案上部に
   * 印刷される仕様。
   */
  const top =
    cropImage(
      decoded,
      0,
      0,
      decoded.width,
      Math.floor(
        decoded.height *
          0.35
      )
    );

  if (top) {
    scanImage(
      top.data,
      top.width,
      top.height,
      results
    );
  }

  /*
   * 全体を縮小して再解析。
   */
  const resized =
    resizeImage(
      decoded,
      0.6
    );

  if (resized) {
    scanImage(
      resized.data,
      resized.width,
      resized.height,
      results
    );
  }

  /*
   * 値を分類
   */

  let testId:
    | string
    | null =
    null;

  let studentNumber:
    | string
    | null =
    null;

  for (
    const value of results
  ) {
    const normalized =
      value.trim();

    /*
     * 生徒QR
     */
    if (
      /^\d{6}$/.test(
        normalized
      )
    ) {
      studentNumber =
        normalized;

      continue;
    }

    /*
     * テストID
     *
     * 登録仕様ではTから始まるIDを
     * 標準形式とする。
     */
    if (
      /^T[A-Z0-9_-]+$/i.test(
        normalized
      )
    ) {
      testId =
        normalized
          .toUpperCase();

      continue;
    }
  }

  return {
    testId,

    studentNumber,
  };
}

/* =========================================================
   Decode image
   ========================================================= */

async function decodeImage(
  bytes: Uint8Array
) {
  /*
   * JPEG
   */
  if (
    isJPEG(bytes)
  ) {
    const decoded =
      jpeg.decode(
        bytes,
        {
          useTArray:
            true,
        }
      );

    return {
      data:
        new Uint8ClampedArray(
          decoded.data
        ),

      width:
        decoded.width,

      height:
        decoded.height,
    };
  }

  /*
   * PNG
   */
  if (
    isPNG(bytes)
  ) {
    const png =
      PNG.sync.read(
        bytes
      );

    return {
      data:
        new Uint8ClampedArray(
          png.data
        ),

      width:
        png.width,

      height:
        png.height,
    };
  }

  /*
   * WebPなどは今後追加。
   */
  return null;
}

/* =========================================================
   QR scan
   ========================================================= */

function scanImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  results: string[]
) {
  const code =
    jsQR(
      data,
      width,
      height,
      {
        inversionAttempts:
          "attemptBoth",
      }
    );

  if (
    code?.data
  ) {
    if (
      !results.includes(
        code.data
      )
    ) {
      results.push(
        code.data
      );
    }
  }
}

/* =========================================================
   Image helpers
   ========================================================= */

function cropImage(
  image: {
    data: Uint8ClampedArray;

    width: number;

    height: number;
  },
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const data =
    new Uint8ClampedArray(
      width *
        height *
        4
    );

  for (
    let row = 0;
    row < height;
    row++
  ) {
    const sourceStart =
      ((y + row) *
        image.width +
        x) *
      4;

    const targetStart =
      row *
      width *
      4;

    data.set(
      image.data.subarray(
        sourceStart,
        sourceStart +
          width *
            4
      ),
      targetStart
    );
  }

  return {
    data,

    width,

    height,
  };
}

function resizeImage(
  image: {
    data: Uint8ClampedArray;

    width: number;

    height: number;
  },
  scale: number
) {
  const width =
    Math.max(
      1,
      Math.floor(
        image.width *
          scale
      )
    );

  const height =
    Math.max(
      1,
      Math.floor(
        image.height *
          scale
      )
    );

  const data =
    new Uint8ClampedArray(
      width *
        height *
        4
    );

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      const sourceX =
        Math.min(
          image.width -
            1,
          Math.floor(
            x /
              scale
          )
        );

      const sourceY =
        Math.min(
          image.height -
            1,
          Math.floor(
            y /
              scale
          )
        );

      const sourceIndex =
        (
          sourceY *
            image.width +
          sourceX
        ) *
        4;

      const targetIndex =
        (
          y *
            width +
          x
        ) *
        4;

      data[
        targetIndex
      ] =
        image.data[
          sourceIndex
        ];

      data[
        targetIndex + 1
      ] =
        image.data[
          sourceIndex + 1
        ];

      data[
        targetIndex + 2
      ] =
        image.data[
          sourceIndex + 2
        ];

      data[
        targetIndex + 3
      ] =
        image.data[
          sourceIndex + 3
        ];
    }
  }

  return {
    data,

    width,

    height,
  };
}

/* =========================================================
   Image type
   ========================================================= */

function isJPEG(
  bytes: Uint8Array
) {
  return (
    bytes[0] ===
      0xff &&
    bytes[1] ===
      0xd8
  );
}

function isPNG(
  bytes: Uint8Array
) {
  return (
    bytes[0] ===
      0x89 &&
    bytes[1] ===
      0x50 &&
    bytes[2] ===
      0x4e &&
    bytes[3] ===
      0x47
  );
}

/* =========================================================
   OCR queue
   ========================================================= */

async function enqueueOCR(
  answerId: string
) {
  /*
   * OCR Functionがまだ存在しない段階でも、
   * 答案をOCR待ちにするところまでは
   * 完了させる。
   *
   * Function URLは環境変数で指定。
   */

  const functionUrl =
    Deno.env.get(
      "PROCESS_OCR_FUNCTION_URL"
    );

  if (
    !functionUrl
  ) {
    console.warn(
      "PROCESS_OCR_FUNCTION_URL is not configured."
    );

    return;
  }

  try {
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
  } catch (
    error
  ) {
    console.error(
      "OCR enqueue error:",
      error
    );
  }
}

/* =========================================================
   Firestore conversion
   ========================================================= */

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
      value.arrayValue
        .values ?? []
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

/* =========================================================
   Firestore operator
   ========================================================= */

function firestoreOperator(
  op: string
) {
  switch (
    op
  ) {
    case "==":
      return "EQUAL";

    case "!=":
      return "NOT_EQUAL";

    default:
      return "EQUAL";
  }
}

function firestoreValue(
  value: string
) {
  return {
    stringValue:
      value,
  };
}

/* =========================================================
   Base64 URL
   ========================================================= */

function base64UrlEncode(
  value: string
) {
  const bytes =
    new TextEncoder().encode(
      value
    );

  return base64UrlBytes(
    bytes
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

/* =========================================================
   Private key
   ========================================================= */

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
