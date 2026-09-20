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

  role: UserRole;

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

  return getAppUser(
    result.user
  );
}

/* =========================================================
   ログアウト
   ========================================================= */

export async function logout(): Promise<void> {
  await signOut(auth);
}

/* =========================================================
   現在のFirebaseユーザー
   ========================================================= */

export function getFirebaseUser():
  User | null {
  return auth.currentUser;
}

/* =========================================================
   現在のアプリユーザー
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

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "このGoogleアカウントはシステムに登録されていません。管理者にアカウント登録を依頼してください。"
    );
  }

  const data =
    snapshot.data();

  const role =
    data.role as UserRole;

  if (
    !isValidRole(role)
  ) {
    throw new Error(
      "ユーザー権限が不正です。"
    );
  }

  const active =
    data.active !== false;

  if (!active) {
    await signOut(
      auth
    );

    throw new Error(
      "このアカウントは停止されています。"
    );
  }

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

    active,

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
          callback(null);

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
   Googleログイン後のユーザー登録確認
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
   * 初回Googleログインだけでは
   * 権限を与えない。
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
        "生徒",

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

  throw new Error(
    "Googleアカウントは認証されましたが、システムへの登録が完了していません。管理者に登録を依頼してください。"
  );
}

/* =========================================================
   権限確認
   ========================================================= */

export async function hasRole(
  role: UserRole
): Promise<boolean> {
  const user =
    await getCurrentUser();

  return (
    user?.role ===
    role
  );
}

export async function hasAnyRole(
  roles: UserRole[]
): Promise<boolean> {
  const user =
    await getCurrentUser();

  if (!user) {
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

  if (!user) {
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
   ロール検証
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
