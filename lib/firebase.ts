import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";

import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/* =========================================================
   Environment
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
   Validate configuration
   ========================================================= */

function validateFirebaseConfig() {
  const required = [
    [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      firebaseConfig.apiKey,
    ],

    [
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      firebaseConfig.authDomain,
    ],

    [
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      firebaseConfig.projectId,
    ],

    [
      "NEXT_PUBLIC_FIREBASE_APP_ID",
      firebaseConfig.appId,
    ],
  ] as const;

  const missing =
    required
      .filter(
        (
          [
            ,
            value,
          ]
        ) =>
          !value
      )
      .map(
        (
          [
            name,
          ]
        ) =>
          name
      );

  /*
   * ビルド時にFirebase設定が
   * 未設定でもモジュール自体は読み込めるようにする。
   *
   * 実際のFirebaseアクセス時に
   * 明確なエラーを出す。
   */
  return missing;
}

/* =========================================================
   App
   ========================================================= */

let app:
  | FirebaseApp
  | null = null;

function getFirebaseApp() {
  if (
    app
  ) {
    return app;
  }

  const missing =
    validateFirebaseConfig();

  if (
    missing.length >
    0
  ) {
    throw new Error(
      `Firebase設定が不足しています: ${missing.join(
        ", "
      )}`
    );
  }

  app =
    getApps().length >
    0
      ? getApp()
      : initializeApp(
          firebaseConfig
        );

  return app;
}

/* =========================================================
   Auth
   ========================================================= */

let authInstance:
  | Auth
  | null = null;

export function getFirebaseAuth() {
  if (
    authInstance
  ) {
    return authInstance;
  }

  const firebaseApp =
    getFirebaseApp();

  authInstance =
    getAuth(
      firebaseApp
    );

  /*
   * ログイン状態をブラウザに保持。
   *
   * 「ログイン維持」の基盤。
   */
  void setPersistence(
    authInstance,
    browserLocalPersistence
  ).catch(
    (
      error
    ) => {
      console.error(
        "Firebase Auth persistence error:",
        error
      );
    }
  );

  return authInstance;
}

/*
 * 既存コードとの互換用。
 */
export const auth =
  typeof window !==
  "undefined"
    ? getFirebaseAuth()
    : (null as unknown as Auth);

/* =========================================================
   Google Provider
   ========================================================= */

export const googleProvider =
  new GoogleAuthProvider();

googleProvider.setCustomParameters(
  {
    prompt:
      "select_account",
  }
);

/* =========================================================
   Firestore
   ========================================================= */

let firestoreInstance:
  | Firestore
  | null = null;

export function getFirebaseFirestore() {
  if (
    firestoreInstance
  ) {
    return firestoreInstance;
  }

  const firebaseApp =
    getFirebaseApp();

  firestoreInstance =
    getFirestore(
      firebaseApp
    );

  return firestoreInstance;
}

/*
 * 既存コードとの互換用。
 */
export const db =
  typeof window !==
  "undefined"
    ? getFirebaseFirestore()
    : (null as unknown as Firestore);

/* =========================================================
   Default export
   ========================================================= */

export default app;
