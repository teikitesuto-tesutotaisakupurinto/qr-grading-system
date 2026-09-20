
"use client";

import {
  getFunctions,
} from "firebase/functions";

import {
  app,
} from "@/lib/firebase";

export const functions =
  getFunctions(
    app,
    "asia-northeast1"
  );
