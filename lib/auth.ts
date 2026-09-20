"use client";

import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  updatePassword,
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
   Roles
   ========================================================= */

export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

/* =========================================================
   App User
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
   Google Login
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

  const credential =
    await signInWithPopup(
      auth,
      provider
    );

  return getAppUser(
    credential.user
  );
}

/* =========================================================
   Logout
   ========================================================= */

export async function logout() {
  await signOut(auth);
}

/* =========================================================
   Current user
   ========================================================= */

export async function getCurrentUser(): Promise<
  AppUser | null
> {
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
   Firebase User → App User
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
   * Googleログイン直後にFirestoreの
   * users/{uid} が存在しない場合。
   *
   * 勝手に管理者権限を付与しない。
   */
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
   Google Login後のユーザー登録
   ========================================================= */

export async function ensureGoogleUserProfile(
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
   * 既に管理者が登録している場合。
   */
  if (
    snapshot.exists()
  ) {
    return getAppUser(
      firebaseUser
    );
  }

  /*
   * 新規Googleユーザーには
   * 権限を与えない。
   *
   * active=false
   * roleは未登録扱い。
   *
   * 管理者が後から正式登録する。
   */
  await setDoc(
    userRef,
    {
      name:
        firebaseUser.displayName ??
        "",

      email:
        firebaseUser.email,

      active:
        false,

      schoolIds:
        [],

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
    {
      merge:
        true,
    }
  );

  throw new Error(
    "Googleアカウントを認証しましたが、まだシステムに登録されていません。管理者に登録を依頼してください。"
  );
}

/* =========================================================
   Auth Observer
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
   Password Change
   ========================================================= */

export async function changePassword(
  newPassword: string
) {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "ログインしてください。"
    );
  }

  if (
    newPassword.length <
    8
  ) {
    throw new Error(
      "パスワードは8文字以上にしてください。"
    );
  }

  await updatePassword(
    user,
    newPassword
  );
}

/* =========================================================
   Role
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
   Role validation
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
