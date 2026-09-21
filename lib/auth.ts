import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
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

import type {
  UserProfile,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Firebase User → Tsystem User
   ========================================================= */

export async function getCurrentUserProfile(
  firebaseUser: User | null
): Promise<UserProfile | null> {
  if (!firebaseUser) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "users",
        firebaseUser.uid
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  const data =
    snapshot.data();

  return {
    uid:
      firebaseUser.uid,

    organizationId:
      typeof data.organizationId ===
      "string"
        ? data.organizationId
        : null,

    role:
      isUserRole(
        data.role
      )
        ? data.role
        : null,

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

    name:
      typeof data.name ===
      "string"
        ? data.name
        : "",

    studentId:
      typeof data.studentId ===
      "string"
        ? data.studentId
        : null,

    email:
      typeof data.email ===
      "string"
        ? data.email
        : firebaseUser.email,

    active:
      data.active !==
      false,
  };
}

/* =========================================================
   Current Firebase User
   ========================================================= */

export function getFirebaseCurrentUser() {
  return auth.currentUser;
}

/* =========================================================
   Login
   ========================================================= */

export async function login(
  email: string,
  password: string
) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  if (
    !normalizedEmail
  ) {
    throw createAuthError(
      "メールアドレスを入力してください。",
      "auth/invalid-email"
    );
  }

  if (
    !password
  ) {
    throw createAuthError(
      "パスワードを入力してください。",
      "auth/missing-password"
    );
  }

  try {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

    /*
     * Authentication成功後、
     * Firestoreのusers/{uid}を確認する。
     */
    const profile =
      await getCurrentUserProfile(
        credential.user
      );

    if (!profile) {
      /*
       * Firebase Authenticationには
       * ログインできても、
       * Tsystemユーザーとして登録されていない
       * 場合はログアウトする。
       */
      await signOut(
        auth
      );

      throw createAuthError(
        "このアカウントはTsystemに登録されていません。",
        "auth/user-profile-not-found"
      );
    }

    if (
      !profile.active
    ) {
      await signOut(
        auth
      );

      throw createAuthError(
        "このアカウントは現在利用できません。",
        "auth/user-disabled"
      );
    }

    if (
      !profile.organizationId
    ) {
      await signOut(
        auth
      );

      throw createAuthError(
        "所属組織が設定されていません。管理者に確認してください。",
        "auth/organization-not-found"
      );
    }

    if (
      !profile.role
    ) {
      await signOut(
        auth
      );

      throw createAuthError(
        "権限が設定されていません。管理者に確認してください。",
        "auth/role-not-found"
      );
    }

    return {
      user:
        credential.user,

      profile,
    };
  } catch (
    error
  ) {
    /*
     * 自分で作ったエラーは
     * そのまま返す。
     */
    if (
      isTsystemAuthError(
        error
      )
    ) {
      throw error;
    }

    throw normalizeFirebaseAuthError(
      error
    );
  }
}

/* =========================================================
   Logout
   ========================================================= */

export async function logout() {
  await signOut(
    auth
  );
}

/* =========================================================
   Auth state listener
   ========================================================= */

export function subscribeAuth(
  callback: (
    user: User | null,
    profile: UserProfile | null
  ) => void,
  onError?: (
    error: unknown
  ) => void
) {
  let cancelled =
    false;

  const unsubscribe =
    onAuthStateChanged(
      auth,
      async (
        firebaseUser
      ) => {
        if (
          cancelled
        ) {
          return;
        }

        try {
          if (
            !firebaseUser
          ) {
            callback(
              null,
              null
            );

            return;
          }

          const profile =
            await getCurrentUserProfile(
              firebaseUser
            );

          if (
            cancelled
          ) {
            return;
          }

          callback(
            firebaseUser,
            profile
          );
        } catch (
          error
        ) {
          if (
            cancelled
          ) {
            return;
          }

          onError?.(
            error
          );
        }
      }
    );

  return () => {
    cancelled =
      true;

    unsubscribe();
  };
}

/* =========================================================
   Role
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

/* =========================================================
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  user: UserProfile | null
) {
  return (
    user?.role ===
    "本部管理者"
  );
}

export function isSchoolAdmin(
  user: UserProfile | null
) {
  return (
    user?.role ===
    "校舎管理者"
  );
}

export function isTeacher(
  user: UserProfile | null
) {
  return (
    user?.role ===
    "講師"
  );
}

export function isStudent(
  user: UserProfile | null
) {
  return (
    user?.role ===
    "生徒"
  );
}

export function isStaff(
  user: UserProfile | null
) {
  return (
    user?.role ===
      "本部管理者" ||
    user?.role ===
      "校舎管理者" ||
    user?.role ===
      "講師"
  );
}

/* =========================================================
   Organization
   ========================================================= */

export function hasOrganization(
  user: UserProfile | null
) {
  return Boolean(
    user?.organizationId
  );
}

/* =========================================================
   School access
   ========================================================= */

export function canAccessSchool(
  user: UserProfile | null,
  schoolId: string
) {
  if (
    !user ||
    !schoolId
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
   Student access
   ========================================================= */

export function canAccessStudent(
  user: UserProfile | null,
  studentId: string,
  studentSchoolId?: string
) {
  if (
    !user ||
    !studentId
  ) {
    return false;
  }

  /*
   * 本部管理者
   */
  if (
    user.role ===
    "本部管理者"
  ) {
    return true;
  }

  /*
   * 校舎管理者・講師
   */
  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    if (
      !studentSchoolId
    ) {
      return false;
    }

    return user.schoolIds.includes(
      studentSchoolId
    );
  }

  /*
   * 生徒
   */
  if (
    user.role ===
    "生徒"
  ) {
    return (
      user.studentId ===
      studentId
    );
  }

  return false;
}

/* =========================================================
   Own student check
   ========================================================= */

export function isOwnStudent(
  user: UserProfile | null,
  studentId: string
) {
  return (
    user?.role ===
      "生徒" &&
    user.studentId ===
      studentId
  );
}

/* =========================================================
   Auth error
   ========================================================= */

export type TsystemAuthError =
  Error & {
    code: string;
  };

function createAuthError(
  message: string,
  code: string
): TsystemAuthError {
  const error =
    new Error(
      message
    ) as TsystemAuthError;

  error.code =
    code;

  return error;
}

function isTsystemAuthError(
  error: unknown
): error is TsystemAuthError {
  return (
    error instanceof Error &&
    typeof (
      error as {
        code?: unknown;
      }
    ).code ===
      "string" &&
    (
      error as {
        code: string;
      }
    ).code.startsWith(
      "auth/"
    )
  );
}

/* =========================================================
   Firebase Auth error normalization
   ========================================================= */

function normalizeFirebaseAuthError(
  error: unknown
): TsystemAuthError {
  const code =
    getErrorCode(
      error
    );

  switch (
    code
  ) {
    case "auth/invalid-email":
      return createAuthError(
        "メールアドレスの形式が正しくありません。",
        code
      );

    case "auth/user-disabled":
      return createAuthError(
        "このアカウントは利用停止されています。",
        code
      );

    case "auth/user-not-found":
      return createAuthError(
        "メールアドレスまたはパスワードが正しくありません。",
        code
      );

    case "auth/wrong-password":
      return createAuthError(
        "メールアドレスまたはパスワードが正しくありません。",
        code
      );

    case "auth/invalid-credential":
      return createAuthError(
        "メールアドレスまたはパスワードが正しくありません。",
        code
      );

    case "auth/too-many-requests":
      return createAuthError(
        "ログイン試行が多すぎます。しばらくしてから再度お試しください。",
        code
      );

    case "auth/network-request-failed":
      return createAuthError(
        "ネットワークに接続できませんでした。",
        code
      );

    case "auth/operation-not-allowed":
      return createAuthError(
        "このログイン方法は現在利用できません。",
        code
      );

    case "auth/invalid-api-key":
      return createAuthError(
        "Firebaseの設定を確認してください。",
        code
      );

    case "auth/app-deleted":
      return createAuthError(
        "Firebaseアプリの設定を確認してください。",
        code
      );

    default:
      return createAuthError(
        "ログインできませんでした。設定を確認してください。",
        code ||
          "auth/unknown"
      );
  }
}

/* =========================================================
   Error code
   ========================================================= */

function getErrorCode(
  error: unknown
) {
  if (
    typeof error ===
      "object" &&
    error !== null &&
    "code" in error
  ) {
    const code =
      (
        error as {
          code?: unknown;
        }
      ).code;

    if (
      typeof code ===
      "string"
    ) {
      return code;
    }
  }

  return "auth/unknown";
}
