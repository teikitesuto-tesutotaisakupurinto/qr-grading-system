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
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
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
   ========================================================= */

export async function loginWithGoogle(): Promise<User> {
  await setPersistence(
    auth,
    browserLocalPersistence
  );

  const provider =
    new GoogleAuthProvider();

  provider.addScope(
    "email"
  );

  provider.addScope(
    "profile"
  );

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
   Firestore users/{uid} 取得
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
   * 存在するが、Firestoreにはまだ
   * 登録されていない。
   *
   * ここではログアウトしない。
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
   現在のユーザー
   ========================================================= */

export async function getCurrentUser(): Promise<AppUser | null> {
  const firebaseUser =
    auth.currentUser;

  if (
    !firebaseUser
  ) {
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
        if (
          onError
        ) {
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
   Googleアカウントに対応する招待を検索
   ========================================================= */

export async function findInvitationForGoogleUser(
  firebaseUser: User
) {
  const email =
    firebaseUser.email
      ?.trim()
      .toLowerCase();

  if (
    !email
  ) {
    return null;
  }

  const invitationQuery =
    query(
      collection(
        db,
        "userInvitations"
      ),
      where(
        "email",
        "==",
        email
      ),
      where(
        "active",
        "==",
        true
      )
    );

  const snapshot =
    await getDocs(
      invitationQuery
    );

  if (
    snapshot.empty
  ) {
    return null;
  }

  const invitation =
    snapshot.docs[0];

  return {
    id:
      invitation.id,

    ...invitation.data(),
  };
}

/* =========================================================
   Google初回ログイン時のユーザー確認
   ========================================================= */

export async function resolveGoogleUser(
  firebaseUser: User
): Promise<AppUser> {
  /*
   * ① 既存ユーザーを確認
   */

  const existingUser =
    await getAppUser(
      firebaseUser
    );

  if (
    existingUser.organizationId &&
    existingUser.role
  ) {
    return existingUser;
  }

  /*
   * ② 招待を確認
   */

  const invitation =
    await findInvitationForGoogleUser(
      firebaseUser
    );

  if (
    !invitation
  ) {
    return existingUser;
  }

  /*
   * 招待がある場合でも、
   * クライアント側から勝手に
   * users/{uid}を書き換える処理は
   * ここでは行わない。
   *
   * 本番では管理権限を持つ
   * サーバー処理で確定する。
   */

  return existingUser;
}

/* =========================================================
   権限確認
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
   本部管理者確認
   ========================================================= */

export async function isHeadOfficeAdmin(): Promise<boolean> {
  return hasRole(
    "本部管理者"
  );
}

/* =========================================================
   校舎管理者確認
   ========================================================= */

export async function isSchoolAdmin(): Promise<boolean> {
  return hasRole(
    "校舎管理者"
  );
}

/* =========================================================
   講師確認
   ========================================================= */

export async function isTeacher(): Promise<boolean> {
  return hasRole(
    "講師"
  );
}

/* =========================================================
   生徒確認
   ========================================================= */

export async function isStudent(): Promise<boolean> {
  return hasRole(
    "生徒"
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
   * 本部管理者は全校舎へアクセス可能
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
      user.role &&
      user.organizationId
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
