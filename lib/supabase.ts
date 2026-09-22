"use client";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/* =========================================================
   Environment
   ========================================================= */

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* =========================================================
   Bucket
   ========================================================= */

export const ANSWER_BUCKET =
  "answers";

/* =========================================================
   Client
   ========================================================= */

let client:
  | SupabaseClient
  | null = null;

export function getSupabaseClient() {
  if (
    client
  ) {
    return client;
  }

  if (
    !supabaseUrl
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL が設定されていません。"
    );
  }

  if (
    !supabaseAnonKey
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。"
    );
  }

  client =
    createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession:
            true,

          autoRefreshToken:
            true,

          detectSessionInUrl:
            true,
        },
      }
    );

  return client;
}

/* =========================================================
   Answer path
   ========================================================= */

export function createAnswerStoragePath(
  organizationId: string,
  testId: string,
  subjectId: string,
  answerId: string,
  extension: string
) {
  const organization =
    sanitizePathSegment(
      organizationId
    );

  const test =
    sanitizePathSegment(
      testId
    );

  const subject =
    sanitizePathSegment(
      subjectId
    );

  const answer =
    sanitizePathSegment(
      answerId
    );

  const ext =
    sanitizeExtension(
      extension
    );

  return [
    organization,
    "tests",
    test,
    "subjects",
    subject,
    "answers",
    `${answer}.${ext}`,
  ].join("/");
}

/* =========================================================
   Upload
   ========================================================= */

export async function uploadAnswerImage(
  file: File,
  storagePath: string
) {
  const supabase =
    getSupabaseClient();

  if (
    !file
  ) {
    throw new Error(
      "答案ファイルがありません。"
    );
  }

  if (
    !storagePath
  ) {
    throw new Error(
      "Storageパスがありません。"
    );
  }

  const validation =
    validateAnswerFile(
      file
    );

  if (
    !validation.valid
  ) {
    throw new Error(
      validation.message
    );
  }

  const {
    error,
  } =
    await supabase.storage
      .from(
        ANSWER_BUCKET
      )
      .upload(
        storagePath,
        file,
        {
          cacheControl:
            "3600",

          upsert:
            false,

          contentType:
            file.type,
        }
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer upload error:",
      error
    );

    throw new Error(
      `答案画像のアップロードに失敗しました。${error.message}`
    );
  }

  return {
    bucket:
      ANSWER_BUCKET,

    path:
      storagePath,
  };
}

/* =========================================================
   Signed URL
   ========================================================= */

export async function createAnswerSignedUrl(
  storagePath: string,
  expiresIn = 3600
) {
  const supabase =
    getSupabaseClient();

  if (
    !storagePath
  ) {
    throw new Error(
      "Storageパスがありません。"
    );
  }

  const seconds =
    normalizeExpiresIn(
      expiresIn
    );

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(
        ANSWER_BUCKET
      )
      .createSignedUrl(
        storagePath,
        seconds
      );

  if (
    error
  ) {
    console.error(
      "Supabase signed URL error:",
      error
    );

    throw new Error(
      `答案画像URLの取得に失敗しました。${error.message}`
    );
  }

  if (
    !data?.signedUrl
  ) {
    throw new Error(
      "答案画像URLが取得できませんでした。"
    );
  }

  return data.signedUrl;
}

/* =========================================================
   Delete
   ========================================================= */

export async function deleteAnswerImage(
  storagePath: string
) {
  const supabase =
    getSupabaseClient();

  if (
    !storagePath
  ) {
    return;
  }

  const {
    error,
  } =
    await supabase.storage
      .from(
        ANSWER_BUCKET
      )
      .remove([
        storagePath,
      ]);

  if (
    error
  ) {
    console.error(
      "Supabase answer delete error:",
      error
    );

    throw new Error(
      `答案画像の削除に失敗しました。${error.message}`
    );
  }
}

/* =========================================================
   Move
   ========================================================= */

export async function moveAnswerImage(
  oldPath: string,
  newPath: string
) {
  const supabase =
    getSupabaseClient();

  if (
    !oldPath
  ) {
    throw new Error(
      "移動元のStorageパスがありません。"
    );
  }

  if (
    !newPath
  ) {
    throw new Error(
      "移動先のStorageパスがありません。"
    );
  }

  const {
    error,
  } =
    await supabase.storage
      .from(
        ANSWER_BUCKET
      )
      .move(
        oldPath,
        newPath
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer move error:",
      error
    );

    throw new Error(
      `答案画像の移動に失敗しました。${error.message}`
    );
  }

  return {
    bucket:
      ANSWER_BUCKET,

    path:
      newPath,
  };
}

/* =========================================================
   Copy
   ========================================================= */

export async function copyAnswerImage(
  sourcePath: string,
  destinationPath: string
) {
  const supabase =
    getSupabaseClient();

  if (
    !sourcePath ||
    !destinationPath
  ) {
    throw new Error(
      "コピー元またはコピー先のStorageパスがありません。"
    );
  }

  const {
    error,
  } =
    await supabase.storage
      .from(
        ANSWER_BUCKET
      )
      .copy(
        sourcePath,
        destinationPath
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer copy error:",
      error
    );

    throw new Error(
      `答案画像のコピーに失敗しました。${error.message}`
    );
  }

  return {
    bucket:
      ANSWER_BUCKET,

    path:
      destinationPath,
  };
}

/* =========================================================
   List
   ========================================================= */

export async function listAnswerImages(
  folderPath = ""
) {
  const supabase =
    getSupabaseClient();

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(
        ANSWER_BUCKET
      )
      .list(
        folderPath,
        {
          limit:
            1000,

          offset:
            0,

          sortBy: {
            column:
              "created_at",

            order:
              "desc",
          },
        }
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer list error:",
      error
    );

    throw new Error(
      `答案画像一覧の取得に失敗しました。${error.message}`
    );
  }

  return (
    data ??
    []
  );
}

/* =========================================================
   File validation
   ========================================================= */

export function validateAnswerFile(
  file: File
):
  | {
      valid: true;

      message: string;
    }
  | {
      valid: false;

      message: string;
    } {
  if (
    !file
  ) {
    return {
      valid:
        false,

      message:
        "ファイルがありません。",
    };
  }

  /*
   * 許可形式。
   */
  const allowedTypes =
    new Set([
      "image/jpeg",

      "image/png",

      "image/webp",

      "application/pdf",
    ]);

  if (
    !allowedTypes.has(
      file.type
    )
  ) {
    return {
      valid:
        false,

      message:
        "答案はJPG・PNG・WebP・PDFのみ登録できます。",
    };
  }

  /*
   * 画像・PDFのサイズ上限。
   *
   * 20MB。
   */
  const maxSize =
    20 *
    1024 *
    1024;

  if (
    file.size >
    maxSize
  ) {
    return {
      valid:
        false,

      message:
        "答案ファイルは20MB以下にしてください。",
    };
  }

  if (
    file.size <=
    0
  ) {
    return {
      valid:
        false,

      message:
        "空のファイルは登録できません。",
    };
  }

  return {
    valid:
      true,

    message:
      "OK",
  };
}

/* =========================================================
   Extension
   ========================================================= */

export function getStorageExtension(
  file: File
) {
  const name =
    file.name
      .split(
        "."
      )
      .pop()
      ?.toLowerCase();

  if (
    name &&
    isAllowedExtension(
      name
    )
  ) {
    return name;
  }

  switch (
    file.type
  ) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "application/pdf":
      return "pdf";

    default:
      return "bin";
  }
}

/* =========================================================
   MIME
   ========================================================= */

export function isImageContentType(
  contentType: string
) {
  return (
    contentType ===
      "image/jpeg" ||
    contentType ===
      "image/png" ||
    contentType ===
      "image/webp"
  );
}

export function isPdfContentType(
  contentType: string
) {
  return (
    contentType ===
    "application/pdf"
  );
}

/* =========================================================
   Filename
   ========================================================= */

export function sanitizeFileName(
  fileName: string
) {
  const name =
    fileName
      .trim()
      .replace(
        /[\\/:*?"<>|]/g,
        "_"
      )
      .replace(
        /\s+/g,
        "_"
      );

  if (
    !name
  ) {
    return "answer";
  }

  return name.slice(
    0,
    180
  );
}

/* =========================================================
   Path sanitizer
   ========================================================= */

function sanitizePathSegment(
  value: string
) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    )
    .slice(
      0,
      120
    );
}

function sanitizeExtension(
  value: string
) {
  const extension =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );

  if (
    isAllowedExtension(
      extension
    )
  ) {
    return extension;
  }

  return "bin";
}

function isAllowedExtension(
  extension: string
) {
  return [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "pdf",
  ].includes(
    extension
  );
}

/* =========================================================
   Expiration
   ========================================================= */

function normalizeExpiresIn(
  value: number
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 3600;
  }

  /*
   * Supabaseの署名URLを
   * 長時間固定で公開し続けない。
   */
  return Math.min(
    Math.max(
      Math.floor(
        value
      ),
      60
    ),
    86400
  );
}
