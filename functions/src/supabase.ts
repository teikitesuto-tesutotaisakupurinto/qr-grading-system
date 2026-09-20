import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/* =========================================================
   Supabase
   ========================================================= */

const ANSWERS_BUCKET = "answers";

let client:
  | SupabaseClient
  | null = null;

/* =========================================================
   Admin Client
   ========================================================= */

export function getSupabaseAdmin(): SupabaseClient {
  if (client) {
    return client;
  }

  const url =
    process.env.SUPABASE_URL;

  const secretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error(
      "SUPABASE_URL が設定されていません。"
    );
  }

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY が設定されていません。"
    );
  }

  client =
    createClient(
      url,
      secretKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,

          detectSessionInUrl:
            false,
        },
      }
    );

  return client;
}

/* =========================================================
   答案ファイル保存
   ========================================================= */

export async function uploadAnswerFile(
  fileKey: string,
  data: Buffer,
  contentType: string
) {
  const supabase =
    getSupabaseAdmin();

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .upload(
        fileKey,
        data,
        {
          contentType,

          upsert: false,

          cacheControl:
            "3600",
        }
      );

  if (
    result.error
  ) {
    throw new Error(
      `答案ファイルの保存に失敗しました: ${result.error.message}`
    );
  }

  return result.data;
}

/* =========================================================
   答案ファイル取得
   ========================================================= */

export async function downloadAnswerFile(
  fileKey: string
): Promise<Buffer> {
  const supabase =
    getSupabaseAdmin();

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .download(
        fileKey
      );

  if (
    result.error
  ) {
    throw new Error(
      `答案ファイルの取得に失敗しました: ${result.error.message}`
    );
  }

  const arrayBuffer =
    await result.data.arrayBuffer();

  return Buffer.from(
    arrayBuffer
  );
}

/* =========================================================
   署名付き閲覧URL
   ========================================================= */

export async function createAnswerSignedUrl(
  fileKey: string,
  expiresIn = 3600
): Promise<string> {
  const supabase =
    getSupabaseAdmin();

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .createSignedUrl(
        fileKey,
        expiresIn
      );

  if (
    result.error
  ) {
    throw new Error(
      `答案閲覧URLの生成に失敗しました: ${result.error.message}`
    );
  }

  return result.data.signedUrl;
}

/* =========================================================
   答案ファイル削除
   ========================================================= */

export async function deleteAnswerFile(
  fileKey: string
) {
  const supabase =
    getSupabaseAdmin();

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .remove([
        fileKey,
      ]);

  if (
    result.error
  ) {
    throw new Error(
      `答案ファイルの削除に失敗しました: ${result.error.message}`
    );
  }

  return result.data;
}

/* =========================================================
   ファイル存在確認
   ========================================================= */

export async function answerFileExists(
  fileKey: string
): Promise<boolean> {
  const supabase =
    getSupabaseAdmin();

  const parts =
    fileKey.split("/");

  const fileName =
    parts.pop();

  if (!fileName) {
    return false;
  }

  const directory =
    parts.join("/");

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .list(
        directory,
        {
          search:
            fileName,

          limit: 10,
        }
      );

  if (
    result.error
  ) {
    throw new Error(
      `答案ファイルの存在確認に失敗しました: ${result.error.message}`
    );
  }

  return result.data.some(
    (file) =>
      file.name ===
      fileName
  );
}
