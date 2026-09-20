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

/*
 * Next.jsの静的ビルド時にもモジュールが評価されます。
 *
 * そのときFirebaseの公開設定がGitHub Actionsから
 * 渡っていなくても、getAuth()で
 * auth/invalid-api-keyを発生させないようにします。
 *
 * ブラウザで実際にFirebaseを使う場合は、
 * NEXT_PUBLIC_FIREBASE_* の値が必要です。
 */

const isBrowser =
  typeof window !==
  "undefined";

const firebaseConfig = {
  apiKey:
    process.env
      .NEXT_PUBLIC_FIREBASE_API_KEY ??
    "build-only-placeholder",

  authDomain:
    process.env
      .NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "build-only.firebaseapp.com",

  projectId:
    process.env
      .NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    "build-only-project",

  storageBucket:
    process.env
      .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "build-only-project.firebasestorage.app",

  messagingSenderId:
    process.env
      .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    "000000000000",

  appId:
    process.env
      .NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:000000000000:web:buildonly",
};

/* =========================================================
   Firebase App
   ========================================================= */

export const app: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        firebaseConfig
      );

/* =========================================================
   Auth
   ========================================================= */

export const auth: Auth =
  getAuth(app);

/* =========================================================
   Firestore
   ========================================================= */

export const db: Firestore =
  getFirestore(app);

/* =========================================================
   Browser設定チェック
   ========================================================= */

export function assertFirebaseConfig() {
  if (!isBrowser) {
    return;
  }

  const required = {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      process.env
        .NEXT_PUBLIC_FIREBASE_API_KEY,

    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env
        .NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,

    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env
        .NEXT_PUBLIC_FIREBASE_PROJECT_ID,

    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env
        .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,

    NEXT_PUBLIC_FIREBASE_APP_ID:
      process.env
        .NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing =
    Object.entries(
      required
    )
      .filter(
        (
          [, value]
        ) =>
          !value ||
          value ===
            "undefined"
      )
      .map(
        ([key]) =>
          key
      );

  if (
    missing.length > 0
  ) {
    throw new Error(
      `Firebase設定が不足しています: ${missing.join(", ")}`
    );
  }
}

export default app;
