import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";

import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/* =========================================================
   Firebase設定
   ========================================================= */

const firebaseConfig = {
  apiKey:
    process.env
      .NEXT_PUBLIC_FIREBASE_API_KEY ?? "",

  authDomain:
    process.env
      .NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",

  projectId:
    process.env
      .NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",

  storageBucket:
    process.env
      .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",

  messagingSenderId:
    process.env
      .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",

  appId:
    process.env
      .NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
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
   Firebase Authentication
   =========================================================
   
   ブラウザではLocal Persistenceを使用。

   Googleログイン後も、
   ブラウザを再読み込みしても
   Firebase Authenticationのログイン状態を保持する。
   ========================================================= */

function createAuth(): Auth {
  /*
   * ブラウザ
   */
  if (
    typeof window !==
    "undefined"
  ) {
    try {
      return initializeAuth(
        app,
        {
          persistence:
            browserLocalPersistence,
        }
      );
    } catch {
      /*
       * 既にAuthが初期化されている場合
       */
      return getAuth(app);
    }
  }

  /*
   * Next.jsのサーバー側
   */
  return getAuth(app);
}

export const auth: Auth =
  createAuth();

/* =========================================================
   Firestore
   ========================================================= */

export const db: Firestore =
  getFirestore(app);

/* =========================================================
   Firebase設定確認
   ========================================================= */

export function assertFirebaseConfig(): void {
  const required = {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      firebaseConfig.apiKey,

    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      firebaseConfig.authDomain,

    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      firebaseConfig.projectId,

    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      firebaseConfig.messagingSenderId,

    NEXT_PUBLIC_FIREBASE_APP_ID:
      firebaseConfig.appId,
  };

  const missing =
    Object.entries(
      required
    )
      .filter(
        ([, value]) =>
          !value ||
          value.trim() === ""
      )
      .map(
        ([key]) =>
          key
      );

  if (
    missing.length > 0
  ) {
    throw new Error(
      `Firebase設定が不足しています: ${missing.join(
        ", "
      )}`
    );
  }
}

/* =========================================================
   ブラウザ専用設定確認
   ========================================================= */

export function assertBrowserFirebaseConfig(): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  assertFirebaseConfig();
}

/* =========================================================
   Firebase App
   ========================================================= */

export default app;
