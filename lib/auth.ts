"use client";

import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

/* =========================================================
   権限
   ========================================================= */

export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

/* =========================================================
   アプリユーザー
   ========================================================= */

export type AppUser = {
  uid: string;

  email: string | null;

  name: string;

  role: UserRole | null;

  schoolIds: string[];

  studentNumber?: string;

  active: boolean;

  photoURL?: string | null;
};

/* =========================================================
   Googleログイン
   ========================================================= */

export async function loginWithGoogle(): Promise<AppUser> {
  await setPersistence(
    auth,
    browserLocalPersistence
  );

  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  const result =
    await signInWithPopup(
      auth,
      provider
    );

  /*
   * Google Authentication自体は
   * 成功している。
   *
   * ここでは勝手にsignOutしない。
   */
  return getAppUser(
    result.user
  );
}

/* =========================================================
   ログアウト
   ========================================================= */

export async function logout() {
  await signOut(auth);
}

/* =========================================================
   Firebase User取得
   ========================================================= */

export function getFirebaseUser():
  User | null {
  return auth.currentUser;
}

/* =========================================================
   現在のユーザー
   ========================================================= */

export async function getCurrentUser():
  Promise<AppUser | null> {
  const firebaseUser =
    auth.currentUser;

  if (!firebaseUser) {
    return null;
  }

  return getAppUser(
    firebaseUser
  );
}

/* =========================================================
   Firebase User → AppUser
   ========================================================= */

export async function getAppUser(
  firebaseUser: User
): Promise<AppUser> {
  const userRef =
    doc(
      db,
      "users",
      firebaseUser.uid
    );

  const snapshot =
    await getDoc(
      userRef
    );

  /*
   * Firestoreにユーザーが存在しない。
   *
   * Google Authenticationには
   * 正常にログインしている。
   *
   * ここでFirebaseからログアウト
   * させない。
   */
  if (
    !snapshot.exists()
  ) {
    return {
      uid:
        firebaseUser.uid,

      email:
        firebaseUser.email,

      name:
        firebaseUser.displayName ??
        "",

      role:
        null,

      schoolIds:
        [],

      active:
        false,

      photoURL:
        firebaseUser.photoURL,
    };
  }

  const data =
    snapshot.data();

  const role =
    isValidRole(
      data.role
    )
      ? data.role
      : null;

  const schoolIds =
    Array.isArray(
      data.schoolIds
    )
      ? data.schoolIds.filter(
          (
            value
          ): value is string =>
            typeof value ===
            "string"
        )
      : [];

  return {
    uid:
      firebaseUser.uid,

    email:
      firebaseUser.email,

    name:
      typeof data.name ===
      "string"
        ? data.name
        : firebaseUser.displayName ??
          "",

    role,

    schoolIds,

    studentNumber:
      typeof data.studentNumber ===
      "string"
        ? data.studentNumber
        : undefined,

    /*
     * active=falseでも
     * signOutしない。
     */
    active:
      data.active !== false,

    photoURL:
      firebaseUser.photoURL,
  };
}

/* =========================================================
   認証状態監視
   ========================================================= */

export function observeAuth(
  callback: (
    user: AppUser | null
  ) => void,

  onError?: (
    error: Error
  ) => void
) {
  return onAuthStateChanged(
    auth,
    async (
      firebaseUser
    ) => {
      try {
        if (
          !firebaseUser
        ) {
          callback(
            null
          );

          return;
        }

        const appUser =
          await getAppUser(
            firebaseUser
          );

        callback(
          appUser
        );
      } catch (
        error
      ) {
        onError?.(
          error instanceof Error
            ? error
            : new Error(
                "認証情報を取得できません。"
              )
        );
      }
    }
  );
}

/* =========================================================
   初回Googleユーザー登録
   ========================================================= */

export async function ensureUserProfile(
  firebaseUser: User
): Promise<AppUser> {
  const userRef =
    doc(
      db,
      "users",
      firebaseUser.uid
    );

  const snapshot =
    await getDoc(
      userRef
    );

  if (
    snapshot.exists()
  ) {
    return getAppUser(
      firebaseUser
    );
  }

  /*
   * 初回ログインしたGoogleアカウント。
   *
   * 自動で管理者権限は与えない。
   */
  await setDoc(
    userRef,
    {
      name:
        firebaseUser.displayName ??
        "",

      email:
        firebaseUser.email,

      role:
        null,

      schoolIds:
        [],

      active:
        false,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    uid:
      firebaseUser.uid,

    email:
      firebaseUser.email,

    name:
      firebaseUser.displayName ??
      "",

    role:
      null,

    schoolIds:
      [],

    active:
      false,

    photoURL:
      firebaseUser.photoURL,
  };
}

/* =========================================================
   権限確認
   ========================================================= */

export async function hasRole(
  role: UserRole
): Promise<boolean> {
  const user =
    await getCurrentUser();

  if (!user) {
    return false;
  }

  return (
    user.active &&
    user.role ===
      role
  );
}

/* =========================================================
   複数権限確認
   ========================================================= */

export async function hasAnyRole(
  roles: UserRole[]
): Promise<boolean> {
  const user =
    await getCurrentUser();

  if (
    !user ||
    !user.active ||
    !user.role
  ) {
    return false;
  }

  return roles.includes(
    user.role
  );
}

/* =========================================================
   校舎アクセス確認
   ========================================================= */

export async function canAccessSchool(
  schoolId: string
): Promise<boolean> {
  const user =
    await getCurrentUser();

  if (
    !user ||
    !user.active
  ) {
    return false;
  }

  if (
    user.role ===
    "本部管理者"
  ) {
    return true;
  }

  return user.schoolIds.includes(
    schoolId
  );
}

/* =========================================================
   権限検証
   ========================================================= */

function isValidRole(
  role: unknown
): role is UserRole {
  return (
    role ===
      "本部管理者" ||
    role ===
      "校舎管理者" ||
    role ===
      "講師" ||
    role ===
      "生徒"
  );
}
