"use client";

import {
  getFunctions,
} from "firebase/functions";

import {
  app,
} from "@/lib/firebase";

/*
 * Cloud Functionsは
 * firebase.json / Functions側と同じ
 * asia-northeast1 を使用。
 */
export const functions =
  getFunctions(
    app,
    "asia-northeast1"
  );
