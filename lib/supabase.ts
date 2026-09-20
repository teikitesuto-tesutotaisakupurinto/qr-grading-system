"use client";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;

const publishableKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client:
  | SupabaseClient
  | null = null;

export function getSupabase(): SupabaseClient {
  if (client) {
    return client;
  }

  if (
    !supabaseUrl ||
    !publishableKey
  ) {
    throw new Error(
      "Supabaseの環境変数が設定されていません。"
    );
  }

  client =
    createClient(
      supabaseUrl,
      publishableKey,
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

export const supabase =
  typeof window !==
    "undefined"
    ? getSupabase()
    : null;

export const ANSWERS_BUCKET =
  "answers";
