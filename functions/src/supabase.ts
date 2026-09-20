import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const ANSWERS_BUCKET =
  "answers";

let client:
  | SupabaseClient
  | null = null;

function getConfig() {
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

  return {
    url,
    secretKey,
  };
}

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

export async function createUploadUrl(
  fileKey: string,
  contentType: string
): Promise<string> {
  const supabase =
    getSupabaseAdmin();

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .createSignedUploadUrl(
        fileKey
      );

  if (
    result.error
  ) {
    throw new Error(
      `アップロードURLの生成に失敗しました: ${result.error.message}`
    );
  }

  return result.data
    .signedUrl;
}

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
