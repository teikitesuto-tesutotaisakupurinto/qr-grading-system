import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/* =========================================================
   Supabase設定
   ========================================================= */

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;

const ANSWERS_BUCKET =
  "answers";

/* =========================================================
   設定チェック
   ========================================================= */

function getConfig() {
  if (
    !supabaseUrl ||
    !supabaseSecretKey
  ) {
    throw new Error(
      "Supabase Functions用の環境変数が設定されていません。"
    );
  }

  return {
    url:
      supabaseUrl,

    secretKey:
      supabaseSecretKey,
  };
}

/* =========================================================
   Admin Client
   ========================================================= */

let client:
  | SupabaseClient
  | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) {
    return client;
  }

  const config =
    getConfig();

  client =
    createClient(
      config.url,
      config.secretKey,
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
   答案アップロード
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
   答案ダウンロード
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
   署名付きダウンロードURL
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

  return result.data
    .signedUrl;
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

  /*
   * Storage APIにはオブジェクト単体の
   * existsがないため、親ディレクトリの
   *一覧から確認する。
   */
  const parts =
    fileKey.split("/");

  const fileName =
    parts.pop();

  if (
    !fileName
  ) {
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

/* =========================================================
   Key生成
   ========================================================= */

export function createAnswerFileKey(
  testId: string,
  subjectId: string,
  answerId: string,
  extension: string
): string {
  const safeExtension =
    extension
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .toLowerCase();

  return [
    "answers",
    testId,
    subjectId,
    `${answerId}.${safeExtension}`,
  ].join("/");
}
