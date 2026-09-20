"use client";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
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

export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

export type AppUser = {
  uid: string;

  email: string | null;

  name: string;

  role: UserRole;

  schoolIds: string[];

  studentNumber?: string;

  active: boolean;
};

/* =========================================================
   ログイン
   ========================================================= */

export async function login(
  email: string,
  password: string
): Promise<AppUser> {
  const normalizedEmail =
    email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "メールアドレスを入力してください。"
    );
  }

  if (!password) {
    throw new Error(
      "パスワードを入力してください。"
    );
  }

  await setPersistence(
    auth,
    browserLocalPersistence
  );

  const credential =
    await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    );

  return getAppUser(
    credential.user
  );
}

/* =========================================================
   ログアウト
   ========================================================= */

export async function logout() {
  await signOut(auth);
}

/* =========================================================
   新規ユーザー作成
   ========================================================= */

export async function createAccount(
  email: string,
  password: string,
  userData: {
    name: string;
    role: UserRole;
    schoolIds?: string[];
    studentNumber?: string;
  }
): Promise<AppUser> {
  const normalizedEmail =
    email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "メールアドレスを入力してください。"
    );
  }

  if (
    password.length < 8
  ) {
    throw new Error(
      "パスワードは8文字以上にしてください。"
    );
  }

  if (!userData.name.trim()) {
    throw new Error(
      "氏名を入力してください。"
    );
  }

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    );

  const uid =
    credential.user.uid;

  const userRef =
    doc(
      db,
      "users",
      uid
    );

  await setDoc(
    userRef,
    {
      name:
        userData.name.trim(),

      email:
        normalizedEmail,

      role:
        userData.role,

      schoolIds:
        userData.schoolIds ??
        [],

      ...(userData.studentNumber
        ? {
            studentNumber:
              userData.studentNumber,
          }
        : {}),

      active: true,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    uid,

    email:
      credential.user.email,

    name:
      userData.name.trim(),

    role:
      userData.role,

    schoolIds:
      userData.schoolIds ??
      [],

    studentNumber:
      userData.studentNumber,

    active: true,
  };
}

/* =========================================================
   現在ログイン中のユーザー
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
   Firebase User → アプリユーザー
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

  if (!snapshot.exists()) {
    throw new Error(
      "ユーザー情報が登録されていません。"
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
    await signOut(auth);

    throw new Error(
      "このアカウントは停止されています。"
    );
  }

  return {
    uid:
      firebaseUser.uid,

    email:
      firebaseUser.email,

    name:
      typeof data.name ===
      "string"
        ? data.name
        : "",

    role,

    schoolIds:
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
        : [],

    studentNumber:
      typeof data.studentNumber ===
      "string"
        ? data.studentNumber
        : undefined,

    active,
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

        callback(appUser);
      } catch (error) {
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
   パスワード再設定メール
   ========================================================= */

export async function resetPassword(
  email: string
) {
  const normalizedEmail =
    email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "メールアドレスを入力してください。"
    );
  }

  await sendPasswordResetEmail(
    auth,
    normalizedEmail
  );
}

/* =========================================================
   ログイン中ユーザーのパスワード変更
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
    newPassword.length < 8
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
   権限確認
   ========================================================= */

export async function hasRole(
  role: UserRole
): Promise<boolean> {
  const user =
    await getCurrentUser();

  return (
    user?.role === role
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
    role === "講師" ||
    role === "生徒"
  );
}
