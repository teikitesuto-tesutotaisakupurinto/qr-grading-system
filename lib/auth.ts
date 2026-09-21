"use client";

import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
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

  photoURL: string | null;

  organizationId: string | null;

  role: UserRole | null;

  schoolIds: string[];

  studentNumber?: string;

  active: boolean;
};

/* =========================================================
   Googleログイン
   =========================================================
   
   ここではFirebase Authenticationだけを処理します。

   Firestoreのusers/{uid}はここでは読みません。
   ========================================================= */

export async function loginWithGoogle(): Promise<User> {
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

  return result.user;
}

/* =========================================================
   ログアウト
   ========================================================= */

export async function logout(): Promise<void> {
  await signOut(auth);
}

/* =========================================================
   Firebase Authenticationユーザー
   ========================================================= */

export function getFirebaseUser(): User | null {
  return auth.currentUser;
}

/* =========================================================
   Firestoreからアプリユーザーを取得
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
   * Firebase Authenticationには
   * 存在するがFirestoreにはまだ
   * 登録されていないユーザー。
   *
   * ログアウトはしない。
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

      photoURL:
        firebaseUser.photoURL,

      organizationId:
        null,

      role:
        null,

      schoolIds:
        [],

      active:
        false,
    };
  }

  const data =
    snapshot.data();

  const role =
    isUserRole(
      data.role
    )
      ? data.role
      : null;

  const organizationId =
    typeof data.organizationId ===
    "string"
      ? data.organizationId
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

    photoURL:
      firebaseUser.photoURL,

    organizationId,

    role,

    schoolIds,

    studentNumber:
      typeof data.studentNumber ===
      "string"
        ? data.studentNumber
        : undefined,

    active:
      data.active !== false,
  };
}

/* =========================================================
   現在のアプリユーザー
   ========================================================= */

export async function getCurrentUser(): Promise<AppUser | null> {
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
        /*
         * ログアウト状態
         */
        if (!firebaseUser) {
          callback(null);
          return;
        }

        /*
         * Firebase Authentication
         * 成功済み。
         *
         * その後Firestoreのユーザー情報を取得。
         */
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
        if (onError) {
          onError(
            error instanceof Error
              ? error
              : new Error(
                  "認証情報の取得に失敗しました。"
                )
          );
        }
      }
    }
  );
}

/* =========================================================
   ユーザー権限確認
   ========================================================= */

export async function hasRole(
  role: UserRole
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

  return (
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
    !user.active ||
    !user.role
  ) {
    return false;
  }

  /*
   * 本部管理者は全校舎にアクセス可能。
   */
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
   組織登録済み確認
   ========================================================= */

export async function hasOrganization(): Promise<boolean> {
  const user =
    await getCurrentUser();

  return Boolean(
    user?.organizationId
  );
}

/* =========================================================
   正式ユーザー確認
   ========================================================= */

export async function isActiveUser(): Promise<boolean> {
  const user =
    await getCurrentUser();

  return Boolean(
    user &&
      user.active &&
      user.role
  );
}

/* =========================================================
   UserRole検証
   ========================================================= */

export function isUserRole(
  value: unknown
): value is UserRole {
  return (
    value ===
      "本部管理者" ||
    value ===
      "校舎管理者" ||
    value ===
      "講師" ||
    value ===
      "生徒"
  );
}
