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
 * 既存画面用。
 */
export const supabase =
  typeof window !==
    "undefined"
    ? getSupabase()
    : null;

/* =========================================================
   Storage buckets
   ========================================================= */

export const ANSWERS_BUCKET =
  "answers";

export const SCHOOL_ASSETS_BUCKET =
  "school-assets";
