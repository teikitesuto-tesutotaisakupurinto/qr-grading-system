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

const supabasePublishableKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/* =========================================================
   Client
   ========================================================= */

let client:
  | SupabaseClient
  | null = null;

export function getSupabase(): SupabaseClient {
  if (
    client
  ) {
    return client;
  }

  if (
    !supabaseUrl ||
    !supabasePublishableKey
  ) {
    throw new Error(
      "Supabaseの接続設定がありません。"
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

/*
 * 既存画面との互換用。
 */
export const supabase =
  typeof window !==
    "undefined"
    ? getSupabase()
    : null;

/* =========================================================
   Storage Buckets
   ========================================================= */

export const ANSWERS_BUCKET =
  "answers";

export const SCHOOL_ASSETS_BUCKET =
  "school-assets";

/* =========================================================
   Answer signed URL
   ========================================================= */

export async function createAnswerSignedUrl(
  fileKey: string,
  expiresIn = 3600
) {
  if (
    !fileKey
  ) {
    return null;
  }

  const storage =
    getSupabase().storage;

  const {
    data,
    error,
  } =
    await storage
      .from(
        ANSWERS_BUCKET
      )
      .createSignedUrl(
        fileKey,
        Math.min(
          Math.max(
            expiresIn,
            60
          ),
          86400
        )
      );

  if (
    error
  ) {
    throw new Error(
      `答案画像URLの取得に失敗しました: ${error.message}`
    );
  }

  return (
    data?.signedUrl ??
    null
  );
}

/* =========================================================
   Delete answer file
   ========================================================= */

export async function deleteAnswerFile(
  fileKey: string
) {
  if (
    !fileKey
  ) {
    return;
  }

  const {
    error,
  } =
    await getSupabase()
      .storage
      .from(
        ANSWERS_BUCKET
      )
      .remove([
        fileKey,
      ]);

  if (
    error
  ) {
    throw new Error(
      `答案画像の削除に失敗しました: ${error.message}`
    );
  }
}
