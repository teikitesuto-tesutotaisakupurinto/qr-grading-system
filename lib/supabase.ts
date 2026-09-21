"use client";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client:
  | SupabaseClient
  | null = null;

export const ANSWERS_BUCKET =
  "answers";

export const SCHOOL_ASSETS_BUCKET =
  "school-assets";

export function getSupabase() {
  if (client) {
    return client;
  }

  if (
    !supabaseUrl ||
    !supabasePublishableKey
  ) {
    throw new Error(
      "Supabaseの環境変数が設定されていません。"
    );
  }

  client =
    createClient(
      supabaseUrl,
      supabasePublishableKey,
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
   Answer path
   ========================================================= */

export function createAnswerStoragePath(
  organizationId: string,
  testId: string,
  subjectId: string,
  answerId: string,
  extension: string
) {
  const safeExtension =
    extension
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .toLowerCase();

  return [
    organizationId,
    testId,
    subjectId,
    `${answerId}.${safeExtension}`,
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
    getSupabase();

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .upload(
        storagePath,
        file,
        {
          contentType:
            file.type ||
            "application/octet-stream",

          upsert:
            false,

          cacheControl:
            "3600",
        }
      );

  if (
    result.error
  ) {
    throw new Error(
      `答案画像の保存に失敗しました: ${result.error.message}`
    );
  }

  return result.data;
}

/* =========================================================
   Delete
   ========================================================= */

export async function deleteAnswerImage(
  storagePath: string
) {
  const supabase =
    getSupabase();

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .remove([
        storagePath,
      ]);

  if (
    result.error
  ) {
    throw new Error(
      `答案画像の削除に失敗しました: ${result.error.message}`
    );
  }

  return result.data;
}

/* =========================================================
   Signed URL
   ========================================================= */

export async function createAnswerSignedUrl(
  storagePath: string,
  expiresIn = 3600
) {
  const supabase =
    getSupabase();

  const result =
    await supabase.storage
      .from(
        ANSWERS_BUCKET
      )
      .createSignedUrl(
        storagePath,
        expiresIn
      );

  if (
    result.error
  ) {
    throw new Error(
      `答案画像URLの生成に失敗しました: ${result.error.message}`
    );
  }

  return result.data
    .signedUrl;
}
