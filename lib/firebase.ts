import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";

import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/* =========================================================
   Firebase Configuration
   ========================================================= */

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",

  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",

  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",

  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",

  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",

  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
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
   Authentication
   ========================================================= */

export const auth: Auth =
  getAuth(app);

/* =========================================================
   Google Authentication
   ========================================================= */

export const googleProvider =
  new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt:
    "select_account",
});

/* =========================================================
   Firestore
   ========================================================= */

export const db: Firestore =
  getFirestore(app);

/* =========================================================
   Firebase configuration validation
   ========================================================= */

export function assertFirebaseConfig() {
  const missing: string[] = [];

  if (
    !firebaseConfig.apiKey.trim()
  ) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_API_KEY"
    );
  }

  if (
    !firebaseConfig.authDomain.trim()
  ) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    );
  }

  if (
    !firebaseConfig.projectId.trim()
  ) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    );
  }

  if (
    !firebaseConfig.messagingSenderId.trim()
  ) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    );
  }

  if (
    !firebaseConfig.appId.trim()
  ) {
    missing.push(
      "NEXT_PUBLIC_FIREBASE_APP_ID"
    );
  }

  if (
    missing.length > 0
  ) {
    throw new Error(
      `Firebase環境変数が不足しています: ${missing.join(
        ", "
      )}`
    );
  }
}

/* =========================================================
   Default export
   ========================================================= */

export default app;
