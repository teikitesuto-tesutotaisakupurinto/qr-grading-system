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

export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

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

export async function logout() {
  await signOut(auth);
}

/* =========================================================
   Firebase User
   ========================================================= */

export function getFirebaseUser(): User | null {
  return auth.currentUser;
}

/* =========================================================
   AppUser取得
   ========================================================= */

export async function getAppUser(
  firebaseUser: User
): Promise<AppUser> {
  const ref = doc(
    db,
    "users",
    firebaseUser.uid
  );

  const snapshot =
    await getDoc(ref);

  if (!snapshot.exists()) {
    return {
      uid: firebaseUser.uid,

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

      schoolIds: [],

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

    organizationId:
      typeof data.organizationId ===
      "string"
        ? data.organizationId
        : null,

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
   現在のユーザー
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
        if (!firebaseUser) {
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
                "認証情報の取得に失敗しました。"
              )
        );
      }
    }
  );
}

/* =========================================================
   権限
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

export async function hasRole(
  role: UserRole
): Promise<boolean> {
  const user =
    await getCurrentUser();

  return (
    user !== null &&
    user.active &&
    user.role === role
  );
}

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
