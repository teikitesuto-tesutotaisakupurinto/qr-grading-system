"use client";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/* =========================================================
   Supabase設定
   ========================================================= */

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/* =========================================================
   設定チェック
   ========================================================= */

if (
  typeof window !== "undefined" &&
  (!supabaseUrl ||
    !supabasePublishableKey)
) {
  console.error(
    "Supabaseの環境変数が設定されていません。"
  );
}

/* =========================================================
   Client
   ========================================================= */

let client:
  | SupabaseClient
  | null = null;

export function getSupabase(): SupabaseClient {
  if (client) {
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
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

  return client;
}

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
