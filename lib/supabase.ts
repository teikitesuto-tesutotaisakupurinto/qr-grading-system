"use client";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/* =========================================================
   Configuration
   ========================================================= */

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL ??
  "";

const supabaseAnonKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/*
 * 答案画像専用Bucket。
 *
 * Supabase側で、この名前のBucketを作成する。
 */
export const ANSWER_BUCKET =
  "answers";

/* =========================================================
   Client
   ========================================================= */

let client:
  SupabaseClient | null =
  null;

export function getSupabaseClient() {
  if (
    client
  ) {
    return client;
  }

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    throw new Error(
      "Supabaseの環境変数が設定されていません。"
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
            false,
        },
      }
    );

  return client;
}

export const supabase =
  typeof window !==
  "undefined"
    ? getSupabaseClient()
    : null;

/* =========================================================
   Storage path
   ========================================================= */

export function createAnswerStoragePath(
  organizationId: string,
  testId: string,
  subjectId: string,
  answerId: string,
  extension: string
) {
  const organization =
    sanitizePathPart(
      organizationId
    );

  const test =
    sanitizePathPart(
      testId
    );

  const subject =
    sanitizePathPart(
      subjectId
    );

  const answer =
    sanitizePathPart(
      answerId
    );

  const ext =
    sanitizeExtension(
      extension
    );

  return [
    organization,
    test,
    subject,
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
      "答案画像の保存先がありません。"
    );
  }

  const client =
    getSupabaseClient();

  const {
    error,
  } =
    await client.storage
      .from(
        ANSWER_BUCKET
      )
      .upload(
        storagePath,
        file,
        {
          cacheControl:
            "3600",

          contentType:
            file.type ||
            "application/octet-stream",

          upsert:
            false,
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
      `答案画像のアップロードに失敗しました: ${error.message}`
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
  if (
    !storagePath
  ) {
    return null;
  }

  const client =
    getSupabaseClient();

  const safeExpires =
    Math.min(
      Math.max(
        Math.floor(
          expiresIn
        ),
        60
      ),
      86400
    );

  const {
    data,
    error,
  } =
    await client.storage
      .from(
        ANSWER_BUCKET
      )
      .createSignedUrl(
        storagePath,
        safeExpires
      );

  if (
    error
  ) {
    console.error(
      "Supabase signed URL error:",
      error
    );

    throw new Error(
      `答案画像URLの発行に失敗しました: ${error.message}`
    );
  }

  return (
    data?.signedUrl ??
    null
  );
}

/* =========================================================
   Delete
   ========================================================= */

export async function deleteAnswerImage(
  storagePath: string
) {
  if (
    !storagePath
  ) {
    return;
  }

  const client =
    getSupabaseClient();

  const {
    error,
  } =
    await client.storage
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
      `答案画像の削除に失敗しました: ${error.message}`
    );
  }
}

/* =========================================================
   Exists
   ========================================================= */

export async function answerImageExists(
  storagePath: string
) {
  if (
    !storagePath
  ) {
    return false;
  }

  const client =
    getSupabaseClient();

  const parts =
    storagePath.split(
      "/"
    );

  const fileName =
    parts.pop();

  if (
    !fileName
  ) {
    return false;
  }

  const directory =
    parts.join(
      "/"
    );

  const {
    data,
    error,
  } =
    await client.storage
      .from(
        ANSWER_BUCKET
      )
      .list(
        directory,
        {
          search:
            fileName,
        }
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer existence check error:",
      error
    );

    return false;
  }

  return (
    data?.some(
      (
        item
      ) =>
        item.name ===
        fileName
    ) ??
    false
  );
}

/* =========================================================
   Replace
   ========================================================= */

export async function replaceAnswerImage(
  file: File,
  storagePath: string
) {
  if (
    !file
  ) {
    throw new Error(
      "答案ファイルがありません。"
    );
  }

  const client =
    getSupabaseClient();

  const {
    error,
  } =
    await client.storage
      .from(
        ANSWER_BUCKET
      )
      .upload(
        storagePath,
        file,
        {
          cacheControl:
            "3600",

          contentType:
            file.type ||
            "application/octet-stream",

          upsert:
            true,
        }
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer replace error:",
      error
    );

    throw new Error(
      `答案画像の更新に失敗しました: ${error.message}`
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
   Move
   ========================================================= */

export async function moveAnswerImage(
  fromPath: string,
  toPath: string
) {
  if (
    !fromPath ||
    !toPath
  ) {
    throw new Error(
      "答案画像の移動元または移動先がありません。"
    );
  }

  const client =
    getSupabaseClient();

  const {
    error,
  } =
    await client.storage
      .from(
        ANSWER_BUCKET
      )
      .move(
        fromPath,
        toPath
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer move error:",
      error
    );

    throw new Error(
      `答案画像の移動に失敗しました: ${error.message}`
    );
  }
}

/* =========================================================
   Copy
   ========================================================= */

export async function copyAnswerImage(
  fromPath: string,
  toPath: string
) {
  if (
    !fromPath ||
    !toPath
  ) {
    throw new Error(
      "答案画像のコピー元またはコピー先がありません。"
    );
  }

  const client =
    getSupabaseClient();

  const {
    error,
  } =
    await client.storage
      .from(
        ANSWER_BUCKET
      )
      .copy(
        fromPath,
        toPath
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer copy error:",
      error
    );

    throw new Error(
      `答案画像のコピーに失敗しました: ${error.message}`
    );
  }
}

/* =========================================================
   List answer files
   ========================================================= */

export async function listAnswerFiles(
  directory = "",
  limit = 100
) {
  const client =
    getSupabaseClient();

  const safeLimit =
    Math.min(
      Math.max(
        Math.floor(
          limit
        ),
        1
      ),
      1000
    );

  const {
    data,
    error,
  } =
    await client.storage
      .from(
        ANSWER_BUCKET
      )
      .list(
        directory,
        {
          limit:
            safeLimit,

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
      `答案画像一覧の取得に失敗しました: ${error.message}`
    );
  }

  return data ?? [];
}

/* =========================================================
   Download
   ========================================================= */

export async function downloadAnswerImage(
  storagePath: string
) {
  if (
    !storagePath
  ) {
    throw new Error(
      "答案画像のパスがありません。"
    );
  }

  const client =
    getSupabaseClient();

  const {
    data,
    error,
  } =
    await client.storage
      .from(
        ANSWER_BUCKET
      )
      .download(
        storagePath
      );

  if (
    error
  ) {
    console.error(
      "Supabase answer download error:",
      error
    );

    throw new Error(
      `答案画像の取得に失敗しました: ${error.message}`
    );
  }

  return data;
}

/* =========================================================
   Validate image
   ========================================================= */

export function validateAnswerFile(
  file: File
) {
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
        "JPEG、PNG、WebP、PDFの答案のみ登録できます。",
    };
  }

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
      "",
  };
}

/* =========================================================
   Path sanitization
   ========================================================= */

function sanitizePathPart(
  value: string
) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );
}

function sanitizeExtension(
  value: string
) {
  const cleaned =
    value
      .replace(
        /^\./,
        ""
      )
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .toLowerCase();

  return (
    cleaned ||
    "bin"
  );
}
