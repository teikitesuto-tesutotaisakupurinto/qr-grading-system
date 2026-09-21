import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
} from "./firebase";

import type {
  UserProfile,
  UserRole,
} from "../types";

/* =========================================================
   Role normalization
   ========================================================= */

export function normalizeUserRole(
  value: unknown
): UserRole | null {
  switch (value) {
    case "本部管理者":
    case "hq":
    case "head_office":
    case "headOfficeAdmin":
    case "本部":
      return "本部管理者";

    case "校舎管理者":
    case "school_admin":
    case "schoolAdmin":
    case "校舎":
      return "校舎管理者";

    case "講師":
    case "teacher":
      return "講師";

    case "生徒":
    case "student":
      return "生徒";

    default:
      return null;
  }
}

/* =========================================================
   Role check
   ========================================================= */

export function isUserRole(
  value: unknown
): value is UserRole {
  return (
    normalizeUserRole(
      value
    ) !== null
  );
}

/* =========================================================
   Get Tsystem user
   ========================================================= */

export async function getCurrentUserProfile(
  firebaseUser: User | null
): Promise<UserProfile | null> {
  if (!firebaseUser) {
    return null;
  }

  try {
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
        normalizeUserRole(
          data.role
        ),

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

      studentId:
        typeof data.studentId ===
        "string"
          ? data.studentId
          : null,

      name:
        typeof data.name ===
        "string"
          ? data.name
          : "",

      email:
        typeof data.email ===
        "string"
          ? data.email
          : firebaseUser.email,

      active:
        data.active !==
        false,
    };
  } catch (
    error
  ) {
    console.error(
      "getCurrentUserProfile error:",
      error
    );

    return null;
  }
}

/* =========================================================
   getAppUser
   =========================================================
   引数あり・なし両対応。
   
   getAppUser()
   getAppUser(firebaseUser)
   
   どちらでも使える。
   ========================================================= */

export async function getAppUser(
  firebaseUser?: User | null
) {
  const user =
    firebaseUser ??
    auth.currentUser;

  if (!user) {
    return null;
  }

  return getCurrentUserProfile(
    user
  );
}

/* =========================================================
   Email / Password login
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
    throw new Error(
      "メールアドレスを入力してください。"
    );
  }

  if (
    !password
  ) {
    throw new Error(
      "パスワードを入力してください。"
    );
  }

  try {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

    const profile =
      await getCurrentUserProfile(
        credential.user
      );

    if (
      !profile
    ) {
      await signOut(
        auth
      );

      throw new Error(
        "Tsystemのユーザー情報が登録されていません。"
      );
    }

    if (
      !profile.active
    ) {
      await signOut(
        auth
      );

      throw new Error(
        "このアカウントは現在利用できません。"
      );
    }

    if (
      !profile.organizationId
    ) {
      await signOut(
        auth
      );

      throw new Error(
        "所属組織が設定されていません。"
      );
    }

    if (
      !profile.role
    ) {
      await signOut(
        auth
      );

      throw new Error(
        "権限が設定されていません。"
      );
    }

    return profile;
  } catch (
    error
  ) {
    console.error(
      "Email login error:",
      error
    );

    throw normalizeAuthError(
      error
    );
  }
}

/* =========================================================
   Google login
   ========================================================= */

export async function loginWithGoogle() {
  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt:
      "select_account",
  });

  try {
    const credential =
      await signInWithPopup(
        auth,
        provider
      );

    const profile =
      await getCurrentUserProfile(
        credential.user
      );

    if (
      !profile
    ) {
      await signOut(
        auth
      );

      throw new Error(
        "このGoogleアカウントはTsystemに登録されていません。"
      );
    }

    if (
      !profile.active
    ) {
      await signOut(
        auth
      );

      throw new Error(
        "このアカウントは現在利用できません。"
      );
    }

    if (
      !profile.organizationId
    ) {
      await signOut(
        auth
      );

      throw new Error(
        "所属組織が設定されていません。"
      );
    }

    if (
      !profile.role
    ) {
      await signOut(
        auth
      );

      throw new Error(
        "権限が設定されていません。"
      );
    }

    return profile;
  } catch (
    error
  ) {
    console.error(
      "Google login error:",
      error
    );

    throw normalizeAuthError(
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
   Firebase current user
   ========================================================= */

export function getFirebaseCurrentUser() {
  return auth.currentUser;
}

/* =========================================================
   Auth state
   ========================================================= */

export function subscribeAuth(
  callback: (
    firebaseUser: User | null,
    appUser: UserProfile | null
  ) => void,
  onError?: (
    error: unknown
  ) => void
) {
  let disposed =
    false;

  const unsubscribe =
    onAuthStateChanged(
      auth,
      async (
        firebaseUser
      ) => {
        if (
          disposed
        ) {
          return;
        }

        try {
          const appUser =
            await getAppUser(
              firebaseUser
            );

          if (
            disposed
          ) {
            return;
          }

          callback(
            firebaseUser,
            appUser
          );
        } catch (
          error
        ) {
          if (
            disposed
          ) {
            return;
          }

          if (
            onError
          ) {
            onError(
              error
            );
          }
        }
      }
    );

  return () => {
    disposed =
      true;

    unsubscribe();
  };
}

/* =========================================================
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
    "本部管理者"
  );
}

export function isSchoolAdmin(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
    "校舎管理者"
  );
}

export function isTeacher(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
    "講師"
  );
}

export function isStudent(
  user:
    | UserProfile
    | null
) {
  return (
    user?.role ===
    "生徒"
  );
}

export function isStaff(
  user:
    | UserProfile
    | null
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
  user:
    | UserProfile
    | null
) {
  return Boolean(
    user?.organizationId
  );
}

/* =========================================================
   School access
   ========================================================= */

export function canAccessSchool(
  user:
    | UserProfile
    | null,
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
  user:
    | UserProfile
    | null,
  studentId: string,
  schoolId?: string
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
      !schoolId
    ) {
      return false;
    }

    return user.schoolIds.includes(
      schoolId
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
   Own student
   ========================================================= */

export function isOwnStudent(
  user:
    | UserProfile
    | null,
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
   Auth error normalization
   ========================================================= */

function normalizeAuthError(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error;
  }

  const firebaseError =
    error as {
      code?: string;
    };

  switch (
    firebaseError?.code
  ) {
    case "auth/invalid-email":
      return new Error(
        "メールアドレスの形式が正しくありません。"
      );

    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return new Error(
        "メールアドレスまたはパスワードが正しくありません。"
      );

    case "auth/user-disabled":
      return new Error(
        "このアカウントは利用停止されています。"
      );

    case "auth/too-many-requests":
      return new Error(
        "ログイン試行が多すぎます。しばらくしてから再度お試しください。"
      );

    case "auth/network-request-failed":
      return new Error(
        "ネットワークに接続できませんでした。"
      );

    case "auth/popup-closed-by-user":
      return new Error(
        "Googleログインがキャンセルされました。"
      );

    default:
      return new Error(
        "ログインできませんでした。"
      );
  }
}
