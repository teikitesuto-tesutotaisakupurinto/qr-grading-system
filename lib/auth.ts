"use client";

import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
  type Unsubscribe,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

import type {
  AppUser,
  UserRole,
} from "@/lib/types";

/* =========================================================
   Types
   ========================================================= */

export type {
  AppUser,
  UserRole,
};

export type AuthState = {
  firebaseUser:
    | FirebaseUser
    | null;

  appUser:
    | AppUser
    | null;

  loading: boolean;

  error:
    | string
    | null;
};

/* =========================================================
   Collection
   ========================================================= */

const USERS_COLLECTION =
  "users";

/* =========================================================
   Get current Firebase user
   ========================================================= */

export function getCurrentFirebaseUser() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return auth.currentUser;
}

/* =========================================================
   Get AppUser
   ========================================================= */

export async function getAppUser(
  firebaseUser?:
    | FirebaseUser
    | null
): Promise<
  AppUser | null
> {
  const currentUser =
    firebaseUser ??
    getCurrentFirebaseUser();

  if (
    !currentUser
  ) {
    return null;
  }

  const userRef =
    doc(
      db,
      USERS_COLLECTION,
      currentUser.uid
    );

  const snapshot =
    await getDoc(
      userRef
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return normalizeAppUser(
    snapshot.id,
    snapshot.data(),
    currentUser
  );
}

/* =========================================================
   Get required AppUser
   ========================================================= */

export async function requireAppUser() {
  const firebaseUser =
    getCurrentFirebaseUser();

  if (
    !firebaseUser
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  const appUser =
    await getAppUser(
      firebaseUser
    );

  if (
    !appUser
  ) {
    throw new Error(
      "アプリ側のユーザー情報が登録されていません。"
    );
  }

  if (
    appUser.active ===
    false
  ) {
    throw new Error(
      "このアカウントは利用停止されています。"
    );
  }

  return appUser;
}

/* =========================================================
   Observe auth
   ========================================================= */

export function observeAuth(
  onUser: (
    user: AppUser | null
  ) => void,
  onError?:
    | ((
        error: Error
      ) => void)
    | undefined
): Unsubscribe {
  /*
   * Firebase Authenticationの
   * セッション状態を監視。
   *
   * ログイン・ログアウト・
   * ページ再読み込みを共通処理する。
   */
  return onAuthStateChanged(
    auth,
    async (
      firebaseUser
    ) => {
      try {
        if (
          !firebaseUser
        ) {
          onUser(
            null
          );

          return;
        }

        const appUser =
          await getAppUser(
            firebaseUser
          );

        if (
          !appUser
        ) {
          onUser(
            null
          );

          return;
        }

        if (
          appUser.active ===
          false
        ) {
          onUser(
            null
          );

          return;
        }

        onUser(
          appUser
        );
      } catch (
        error
      ) {
        console.error(
          "observeAuth error:",
          error
        );

        onUser(
          null
        );

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
    },
    (
      error
    ) => {
      console.error(
        "Firebase auth observer error:",
        error
      );

      onUser(
        null
      );

      if (
        onError
      ) {
        onError(
          error
        );
      }
    }
  );
}

/* =========================================================
   Sign out
   ========================================================= */

export async function logout() {
  await signOut(
    auth
  );
}

/* =========================================================
   Create user profile
   ========================================================= */

export async function createAppUser(
  input: {
    uid: string;

    email?:
      | string
      | null;

    name: string;

    role: UserRole;

    organizationId: string;

    schoolIds?: string[];

    studentId?:
      | string
      | null;

    active?: boolean;

    photoURL?:
      | string
      | null;
  }
) {
  const currentUser =
    getCurrentFirebaseUser();

  if (
    !currentUser
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  /*
   * 原則として
   * 自分以外のユーザーを
   * クライアントから勝手に作成させない。
   *
   * 本部・校舎管理者のユーザー作成UIでは
   * Firestore Rules側でも必ず制限する。
   */
  if (
    currentUser.uid !==
    input.uid
  ) {
    const currentAppUser =
      await getAppUser(
        currentUser
      );

    if (
      !currentAppUser ||
      (
        currentAppUser.role !==
          "本部管理者" &&
        currentAppUser.role !==
          "校舎管理者"
      )
    ) {
      throw new Error(
        "ユーザーを作成する権限がありません。"
      );
    }
  }

  if (
    !input.name.trim()
  ) {
    throw new Error(
      "氏名を入力してください。"
    );
  }

  if (
    !input.organizationId
  ) {
    throw new Error(
      "organizationIdが必要です。"
    );
  }

  const schoolIds =
    normalizeSchoolIds(
      input.schoolIds
    );

  /*
   * 生徒以外はstudentId不要。
   */
  const studentId =
    input.role ===
    "生徒"
      ? normalizeNullableString(
          input.studentId
        )
      : null;

  await setDoc(
    doc(
      db,
      USERS_COLLECTION,
      input.uid
    ),
    {
      uid:
        input.uid,

      email:
        normalizeNullableString(
          input.email
        ),

      name:
        input.name.trim(),

      role:
        input.role,

      organizationId:
        input.organizationId,

      schoolIds,

      studentId,

      active:
        input.active !==
        false,

      photoURL:
        normalizeNullableString(
          input.photoURL
        ),

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   Update current AppUser
   ========================================================= */

export async function updateCurrentAppUser(
  patch: Partial<
    Pick<
      AppUser,
      | "name"
      | "photoURL"
      | "studentId"
    >
  >
) {
  const currentUser =
    getCurrentFirebaseUser();

  if (
    !currentUser
  ) {
    throw new Error(
      "ログインしてください。"
    );
  }

  const ref =
    doc(
      db,
      USERS_COLLECTION,
      currentUser.uid
    );

  const update: Record<
    string,
    unknown
  > = {
    updatedAt:
      serverTimestamp(),
  };

  if (
    patch.name !==
    undefined
  ) {
    const name =
      patch.name.trim();

    if (
      !name
    ) {
      throw new Error(
        "氏名を空にできません。"
      );
    }

    update.name =
      name;
  }

  if (
    patch.photoURL !==
    undefined
  ) {
    update.photoURL =
      normalizeNullableString(
        patch.photoURL
      );
  }

  if (
    patch.studentId !==
    undefined
  ) {
    update.studentId =
      normalizeNullableString(
        patch.studentId
      );
  }

  await setDoc(
    ref,
    update,
    {
      merge:
        true,
    }
  );

  return getAppUser(
    currentUser
  );
}

/* =========================================================
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  user:
    | AppUser
    | null
    | undefined
) {
  return (
    user?.role ===
    "本部管理者"
  );
}

export function isSchoolAdmin(
  user:
    | AppUser
    | null
    | undefined
) {
  return (
    user?.role ===
    "校舎管理者"
  );
}

export function isTeacher(
  user:
    | AppUser
    | null
    | undefined
) {
  return (
    user?.role ===
    "講師"
  );
}

export function isStudent(
  user:
    | AppUser
    | null
    | undefined
) {
  return (
    user?.role ===
    "生徒"
  );
}

/* =========================================================
   Permission helpers
   ========================================================= */

export function canManageUsers(
  user:
    | AppUser
    | null
    | undefined
) {
  return (
    user?.role ===
      "本部管理者" ||
    user?.role ===
      "校舎管理者"
  );
}

export function canManageSchools(
  user:
    | AppUser
    | null
    | undefined
) {
  return (
    user?.role ===
    "本部管理者"
  );
}

export function canManageStudents(
  user:
    | AppUser
    | null
    | undefined
) {
  return (
    user?.role ===
      "本部管理者" ||
    user?.role ===
      "校舎管理者"
  );
}

export function canManageTests(
  user:
    | AppUser
    | null
    | undefined
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

export function canManageGrading(
  user:
    | AppUser
    | null
    | undefined
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

export function canConfirmGrading(
  user:
    | AppUser
    | null
    | undefined
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

export function canManageRetests(
  user:
    | AppUser
    | null
    | undefined
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
   School access
   ========================================================= */

export function canAccessSchool(
  user:
    | AppUser
    | null
    | undefined,
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
    | AppUser
    | null
    | undefined,
  studentId: string,
  studentSchoolId?:
    | string
    | null
) {
  if (
    !user ||
    !studentId
  ) {
    return false;
  }

  if (
    user.role ===
      "本部管理者"
  ) {
    return true;
  }

  if (
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  ) {
    if (
      studentSchoolId
    ) {
      return user.schoolIds.includes(
        studentSchoolId
      );
    }

    return false;
  }

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
   Dashboard path
   ========================================================= */

export function getDashboardPath(
  role:
    | UserRole
    | null
    | undefined
) {
  switch (
    role
  ) {
    case "本部管理者":
      return "/dashboard/head-office";

    case "校舎管理者":
      return "/dashboard/school";

    case "講師":
      return "/dashboard/teacher";

    case "生徒":
      return "/dashboard/student";

    default:
      return "/login";
  }
}

/* =========================================================
   Normalize AppUser
   ========================================================= */

function normalizeAppUser(
  id: string,
  data: Record<
    string,
    unknown
  >,
  firebaseUser: FirebaseUser
): AppUser {
  const role =
    normalizeRole(
      data.role
    );

  return {
    uid:
      stringValue(
        data.uid
      ) ||
      id,

    email:
      normalizeNullableString(
        data.email
      ) ??
      firebaseUser.email,

    name:
      stringValue(
        data.name
      ) ||
      firebaseUser.displayName ||
      "",

    role,

    organizationId:
      normalizeNullableString(
        data.organizationId
      ),

    schoolIds:
      normalizeSchoolIds(
        data.schoolIds
      ),

    studentId:
      normalizeNullableString(
        data.studentId
      ),

    active:
      data.active !==
      false,

    photoURL:
      normalizeNullableString(
        data.photoURL
      ) ??
      firebaseUser.photoURL,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   Role
   ========================================================= */

function normalizeRole(
  value: unknown
): UserRole {
  switch (
    value
  ) {
    case "本部管理者":
    case "校舎管理者":
    case "講師":
    case "生徒":
      return value;

    /*
     * 未登録・不正roleを
     * 管理者権限として扱わない。
     */
    default:
      throw new Error(
        "ユーザー権限が不正です。"
      );
  }
}

/* =========================================================
   School IDs
   ========================================================= */

function normalizeSchoolIds(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (
            item
          ): item is string =>
            typeof item ===
            "string"
        )
        .map(
          (
            item
          ) =>
            item.trim()
        )
        .filter(
          Boolean
        )
    )
  );
}

/* =========================================================
   Primitive
   ========================================================= */

function stringValue(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : "";
}

function normalizeNullableString(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized ||
    null;
}
