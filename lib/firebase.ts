import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";

import {
  getAuth,
  type Auth,
} from "firebase/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/* =========================================================
   Firebase Configuration
   ========================================================= */

const apiKey =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";

const authDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";

const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

const messagingSenderId =
  process.env
    .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "";

const appId =
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";

const storageBucket =
  process.env
    .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";

/* =========================================================
   Firebase App
   ========================================================= */

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

export const app: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        firebaseConfig
      );

/* =========================================================
   Authentication
   ========================================================= */

export const auth: Auth =
  getAuth(app);

/* =========================================================
   Firestore
   ========================================================= */

export const db: Firestore =
  getFirestore(app);

/* =========================================================
   Configuration check
   ========================================================= */

export function assertFirebaseConfig() {
  const missing: string[] = [];

  if (!apiKey.trim()) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_API_KEY"
    );
  }

  if (!authDomain.trim()) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    );
  }

  if (!projectId.trim()) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    );
  }

  if (!messagingSenderId.trim()) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    );
  }

  if (!appId.trim()) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_APP_ID"
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Firebase環境変数が不足しています: ${missing.join(
        ", "
      )}`
    );
  }
}

export default app;
