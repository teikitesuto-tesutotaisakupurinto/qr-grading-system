"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  auth,
  db,
} from "@/lib/firebase";

export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

export type AppUserRecord = {
  uid: string;

  name: string;

  email: string;

  role: UserRole;

  schoolIds: string[];

  studentNumber?: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   ユーザー取得
   ========================================================= */

export async function getUser(
  uid: string
): Promise<AppUserRecord | null> {
  if (!uid.trim()) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "users",
        uid
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeUser(
    snapshot.id,
    snapshot.data()
  );
}

/* =========================================================
   ユーザー一覧
   ========================================================= */

export async function getUsers(
  role?: UserRole
): Promise<AppUserRecord[]> {
  const reference =
    collection(
      db,
      "users"
    );

  const userQuery = role
    ? query(
        reference,
        where(
          "role",
          "==",
          role
        ),
        orderBy(
          "name",
          "asc"
        )
      )
    : query(
        reference,
        orderBy(
          "name",
          "asc"
        )
      );

  const snapshot =
    await getDocs(
      userQuery
    );

  return snapshot.docs.map(
    (item) =>
      normalizeUser(
        item.id,
        item.data()
      )
  );
}

/* =========================================================
   校舎所属ユーザー
   ========================================================= */

export async function getUsersBySchool(
  schoolId: string
): Promise<AppUserRecord[]> {
  if (!schoolId.trim()) {
    throw new Error(
      "校舎IDがありません。"
    );
  }

  const userQuery =
    query(
      collection(
        db,
        "users"
      ),
      where(
        "schoolIds",
        "array-contains",
        schoolId
      ),
      orderBy(
        "name",
        "asc"
      )
    );

  const snapshot =
    await getDocs(
      userQuery
    );

  return snapshot.docs.map(
    (item) =>
      normalizeUser(
        item.id,
        item.data()
      )
  );
}

/* =========================================================
   ユーザー情報更新
   ========================================================= */

export async function updateUser(
  uid: string,
  changes: {
    name?: string;
    role?: UserRole;
    schoolIds?: string[];
    studentNumber?: string;
    active?: boolean;
  }
) {
  if (!uid.trim()) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  const reference =
    doc(
      db,
      "users",
      uid
    );

  const existing =
    await getDoc(
      reference
    );

  if (!existing.exists()) {
    throw new Error(
      "ユーザーが存在しません。"
    );
  }

  if (
    changes.name !== undefined &&
    !changes.name.trim()
  ) {
    throw new Error(
      "氏名を入力してください。"
    );
  }

  if (
    changes.role !==
      undefined &&
    !isValidRole(
      changes.role
    )
  ) {
    throw new Error(
      "権限が不正です。"
    );
  }

  if (
    changes.studentNumber !==
      undefined &&
    !/^\d{6}$/.test(
      changes.studentNumber
    )
  ) {
    throw new Error(
      "生徒番号は6桁数字で指定してください。"
    );
  }

  await updateDoc(
    reference,
    {
      ...(changes.name !==
      undefined
        ? {
            name:
              changes.name.trim(),
          }
        : {}),

      ...(changes.role !==
      undefined
        ? {
            role:
              changes.role,
          }
        : {}),

      ...(changes.schoolIds !==
      undefined
        ? {
            schoolIds:
              changes.schoolIds,
          }
        : {}),

      ...(changes.studentNumber !==
      undefined
        ? {
            studentNumber:
              changes.studentNumber,
          }
        : {}),

      ...(changes.active !==
      undefined
        ? {
            active:
              changes.active,
          }
        : {}),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   ユーザー停止
   ========================================================= */

export async function disableUser(
  uid: string
) {
  await updateUser(
    uid,
    {
      active: false,
    }
  );
}

/* =========================================================
   ユーザー再開
   ========================================================= */

export async function enableUser(
  uid: string
) {
  await updateUser(
    uid,
    {
      active: true,
    }
  );
}

/* =========================================================
   パスワード再設定メール
   ========================================================= */

export async function sendUserPasswordReset(
  email: string
) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

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
   自分のプロフィール更新
   ========================================================= */

export async function updateOwnProfile(
  uid: string,
  name: string
) {
  if (!uid.trim()) {
    throw new Error(
      "ユーザーIDがありません。"
    );
  }

  if (!name.trim()) {
    throw new Error(
      "氏名を入力してください。"
    );
  }

  await updateDoc(
    doc(
      db,
      "users",
      uid
    ),
    {
      name:
        name.trim(),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   権限確認
   ========================================================= */

export function isManager(
  user: AppUserRecord
): boolean {
  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者"
  );
}

export function isHeadOffice(
  user: AppUserRecord
): boolean {
  return (
    user.role ===
    "本部管理者"
  );
}

export function isGrader(
  user: AppUserRecord
): boolean {
  return (
    user.role ===
      "本部管理者" ||
    user.role ===
      "校舎管理者" ||
    user.role ===
      "講師"
  );
}

/* =========================================================
   Firestoreデータ正規化
   ========================================================= */

function normalizeUser(
  uid: string,
  data: Record<
    string,
    unknown
  >
): AppUserRecord {
  const role =
    data.role;

  if (
    !isValidRole(role)
  ) {
    throw new Error(
      `ユーザー ${uid} の権限が不正です。`
    );
  }

  return {
    uid,

    name:
      typeof data.name ===
      "string"
        ? data.name
        : "",

    email:
      typeof data.email ===
      "string"
        ? data.email
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

    active:
      data.active !==
      false,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

function isValidRole(
  value: unknown
): value is UserRole {
  return (
    value ===
      "本部管理者" ||
    value ===
      "校舎管理者" ||
    value === "講師" ||
    value === "生徒"
  );
}
