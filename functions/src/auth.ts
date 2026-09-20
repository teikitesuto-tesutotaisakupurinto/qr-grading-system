import {
  getFirestore,
} from "firebase-admin/firestore";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  HttpsError,
} from "firebase-functions/v2/https";

const db = getFirestore();
const adminAuth = getAuth();

export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

const allRoles: UserRole[] = [
  "本部管理者",
  "校舎管理者",
  "講師",
  "生徒",
];

/**
 * Firestore users/{uid} の権限を取得
 */
export async function getUserRole(
  uid: string
): Promise<UserRole> {
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .get();

  if (!snapshot.exists) {
    throw new HttpsError(
      "permission-denied",
      "ユーザー情報が登録されていません。"
    );
  }

  const data =
    snapshot.data();

  const role =
    data?.role as UserRole | undefined;

  if (
    !role ||
    !allRoles.includes(role)
  ) {
    throw new HttpsError(
      "permission-denied",
      "有効な権限が設定されていません。"
    );
  }

  return role;
}

/**
 * 指定された権限を持っているか確認
 */
export async function requireRole(
  uid: string,
  allowedRoles: UserRole[]
): Promise<UserRole> {
  const role =
    await getUserRole(uid);

  if (
    !allowedRoles.includes(role)
  ) {
    throw new HttpsError(
      "permission-denied",
      "この操作を行う権限がありません。"
    );
  }

  return role;
}

/**
 * ユーザーが所属する校舎を取得
 */
export async function getUserSchoolIds(
  uid: string
): Promise<string[]> {
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .get();

  if (!snapshot.exists) {
    throw new HttpsError(
      "permission-denied",
      "ユーザー情報がありません。"
    );
  }

  const data =
    snapshot.data();

  const schoolIds =
    data?.schoolIds;

  if (!Array.isArray(schoolIds)) {
    return [];
  }

  return schoolIds.filter(
    (value): value is string =>
      typeof value === "string"
  );
}

/**
 * 本部管理者か確認
 */
export async function requireHeadOffice(
  uid: string
) {
  return requireRole(
    uid,
    ["本部管理者"]
  );
}

/**
 * 本部または校舎管理者か確認
 */
export async function requireManager(
  uid: string
) {
  return requireRole(
    uid,
    [
      "本部管理者",
      "校舎管理者",
    ]
  );
}

/**
 * 採点操作が可能か確認
 */
export async function requireGradingRole(
  uid: string
) {
  return requireRole(
    uid,
    [
      "本部管理者",
      "校舎管理者",
      "講師",
    ]
  );
}

/**
 * ユーザーが停止されていないか確認
 */
export async function requireActiveUser(
  uid: string
) {
  try {
    const user =
      await adminAuth.getUser(uid);

    if (user.disabled) {
      throw new HttpsError(
        "permission-denied",
        "このアカウントは停止されています。"
      );
    }

    return user;
  } catch (error) {
    if (
      error instanceof HttpsError
    ) {
      throw error;
    }

    throw new HttpsError(
      "permission-denied",
      "ユーザーを確認できません。"
    );
  }
}
