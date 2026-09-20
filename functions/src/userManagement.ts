import {
  getAuth,
} from "firebase-admin/auth";

import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";

import {
  requireManager,
} from "./auth";

const adminAuth =
  getAuth();

const db =
  getFirestore();

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

type ManagedUser = {
  uid: string;

  role: UserRole;

  schoolIds: string[];

  email: string;
};

/* =========================================================
   ユーザー作成
   ========================================================= */

export const createManagedUser =
  onCall(
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireManager(
        request.auth.uid
      );

      const data =
        request.data ?? {};

      const email =
        typeof data.email ===
        "string"
          ? data.email
              .trim()
              .toLowerCase()
          : "";

      const password =
        typeof data.password ===
        "string"
          ? data.password
          : "";

      const name =
        typeof data.name ===
        "string"
          ? data.name.trim()
          : "";

      const role =
        data.role as UserRole;

      const schoolIds =
        normalizeSchoolIds(
          data.schoolIds
        );

      const studentNumber =
        typeof data.studentNumber ===
        "string"
          ? data.studentNumber.trim()
          : undefined;

      validateRole(
        role
      );

      if (!email) {
        throw new HttpsError(
          "invalid-argument",
          "メールアドレスを入力してください。"
        );
      }

      if (
        password.length < 8
      ) {
        throw new HttpsError(
          "invalid-argument",
          "パスワードは8文字以上にしてください。"
        );
      }

      if (!name) {
        throw new HttpsError(
          "invalid-argument",
          "氏名を入力してください。"
        );
      }

      if (
        studentNumber &&
        !/^\d{6}$/.test(
          studentNumber
        )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "生徒番号は6桁数字で指定してください。"
        );
      }

      const requesterSnapshot =
        await db
          .collection(
            "users"
          )
          .doc(
            request.auth.uid
          )
          .get();

      const requester =
        requesterSnapshot.data();

      if (
        requester?.role ===
        "校舎管理者"
      ) {
        const requesterSchools =
          normalizeSchoolIds(
            requester.schoolIds
          );

        if (
          role ===
            "本部管理者" ||
          schoolIds.some(
            (
              schoolId: string
            ) =>
              !requesterSchools.includes(
                schoolId
              )
          )
        ) {
          throw new HttpsError(
            "permission-denied",
            "このユーザーを作成する権限がありません。"
          );
        }
      }

      let firebaseUser;

      try {
        firebaseUser =
          await adminAuth.createUser({
            email,

            password,

            displayName:
              name,

            disabled:
              false,
          });
      } catch (error) {
        throw new HttpsError(
          "already-exists",
          error instanceof Error
            ? error.message
            : "ユーザーを作成できませんでした。"
        );
      }

      try {
        await db
          .collection(
            "users"
          )
          .doc(
            firebaseUser.uid
          )
          .set({
            uid:
              firebaseUser.uid,

            name,

            email,

            role,

            schoolIds,

            ...(studentNumber
              ? {
                  studentNumber,
                }
              : {}),

            active: true,

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),

            createdBy:
              request.auth.uid,
          });

        await writeAuditLog({
          actorUid:
            request.auth.uid,

          action:
            "USER_CREATED",

          targetUid:
            firebaseUser.uid,

          metadata: {
            role,

            schoolIds,
          },
        });
      } catch (error) {
        await adminAuth.deleteUser(
          firebaseUser.uid
        );

        throw error;
      }

      return {
        success: true,

        uid:
          firebaseUser.uid,
      };
    }
  );

/* =========================================================
   ユーザー停止
   ========================================================= */

export const disableManagedUser =
  onCall(
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireManager(
        request.auth.uid
      );

      const uid =
        getUid(
          request.data?.uid
        );

      if (
        uid ===
        request.auth.uid
      ) {
        throw new HttpsError(
          "failed-precondition",
          "自分自身を停止することはできません。"
        );
      }

      const target =
        await getTargetUser(
          uid
        );

      await checkTargetPermission(
        request.auth.uid,
        target
      );

      await adminAuth.updateUser(
        uid,
        {
          disabled: true,
        }
      );

      await db
        .collection(
          "users"
        )
        .doc(uid)
        .update({
          active: false,

          updatedAt:
            FieldValue.serverTimestamp(),
        });

      await writeAuditLog({
        actorUid:
          request.auth.uid,

        action:
          "USER_DISABLED",

        targetUid:
          uid,
      });

      return {
        success: true,
      };
    }
  );

/* =========================================================
   ユーザー再開
   ========================================================= */

export const enableManagedUser =
  onCall(
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireManager(
        request.auth.uid
      );

      const uid =
        getUid(
          request.data?.uid
        );

      const target =
        await getTargetUser(
          uid
        );

      await checkTargetPermission(
        request.auth.uid,
        target
      );

      await adminAuth.updateUser(
        uid,
        {
          disabled: false,
        }
      );

      await db
        .collection(
          "users"
        )
        .doc(uid)
        .update({
          active: true,

          updatedAt:
            FieldValue.serverTimestamp(),
        });

      await writeAuditLog({
        actorUid:
          request.auth.uid,

        action:
          "USER_ENABLED",

        targetUid:
          uid,
      });

      return {
        success: true,
      };
    }
  );

/* =========================================================
   パスワードリセット
   ========================================================= */

export const generateManagedPasswordResetLink =
  onCall(
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireManager(
        request.auth.uid
      );

      const uid =
        getUid(
          request.data?.uid
        );

      const target =
        await getTargetUser(
          uid
        );

      await checkTargetPermission(
        request.auth.uid,
        target
      );

      if (!target.email) {
        throw new HttpsError(
          "failed-precondition",
          "メールアドレスが登録されていません。"
        );
      }

      const link =
        await adminAuth.generatePasswordResetLink(
          target.email
        );

      await writeAuditLog({
        actorUid:
          request.auth.uid,

        action:
          "PASSWORD_RESET_LINK_GENERATED",

        targetUid:
          uid,
      });

      return {
        success: true,

        email:
          target.email,

        link,
      };
    }
  );

/* =========================================================
   権限変更
   ========================================================= */

export const updateManagedUserRole =
  onCall(
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "ログインが必要です。"
        );
      }

      await requireManager(
        request.auth.uid
      );

      const uid =
        getUid(
          request.data?.uid
        );

      const role =
        request.data
          ?.role as UserRole;

      validateRole(
        role
      );

      const schoolIds =
        normalizeSchoolIds(
          request.data
            ?.schoolIds
        );

      const target =
        await getTargetUser(
          uid
        );

      await checkTargetPermission(
        request.auth.uid,
        target
      );

      if (
        target.role ===
          "本部管理者" &&
        uid ===
          request.auth.uid
      ) {
        throw new HttpsError(
          "failed-precondition",
          "自分自身の本部管理者権限は変更できません。"
        );
      }

      const requesterSnapshot =
        await db
          .collection(
            "users"
          )
          .doc(
            request.auth.uid
          )
          .get();

      const requester =
        requesterSnapshot.data();

      if (
        requester?.role ===
          "校舎管理者" &&
        role ===
          "本部管理者"
      ) {
        throw new HttpsError(
          "permission-denied",
          "校舎管理者は本部管理者を設定できません。"
        );
      }

      await db
        .collection(
          "users"
        )
        .doc(uid)
        .update({
          role,

          schoolIds,

          updatedAt:
            FieldValue.serverTimestamp(),
        });

      await writeAuditLog({
        actorUid:
          request.auth.uid,

        action:
          "USER_ROLE_UPDATED",

        targetUid:
          uid,

        metadata: {
          role,

          schoolIds,
        },
      });

      return {
        success: true,
      };
    }
  );

/* =========================================================
   対象ユーザー
   ========================================================= */

async function getTargetUser(
  uid: string
): Promise<ManagedUser> {
  const snapshot =
    await db
      .collection(
        "users"
      )
      .doc(uid)
      .get();

  if (!snapshot.exists) {
    throw new HttpsError(
      "not-found",
      "ユーザーが存在しません。"
    );
  }

  const data =
    snapshot.data();

  if (!data) {
    throw new HttpsError(
      "not-found",
      "ユーザー情報がありません。"
    );
  }

  return {
    uid,

    role:
      normalizeRole(
        data.role
      ),

    schoolIds:
      normalizeSchoolIds(
        data.schoolIds
      ),

    email:
      typeof data.email ===
      "string"
        ? data.email
        : "",
  };
}

/* =========================================================
   権限確認
   ========================================================= */

async function checkTargetPermission(
  actorUid: string,
  target: ManagedUser
) {
  const snapshot =
    await db
      .collection(
        "users"
      )
      .doc(actorUid)
      .get();

  const actor =
    snapshot.data();

  if (!actor) {
    throw new HttpsError(
      "permission-denied",
      "操作者の権限情報がありません。"
    );
  }

  const actorRole =
    normalizeRole(
      actor.role
    );

  if (
    actorRole ===
    "本部管理者"
  ) {
    return;
  }

  if (
    actorRole !==
    "校舎管理者"
  ) {
    throw new HttpsError(
      "permission-denied",
      "この操作を行う権限がありません。"
    );
  }

  if (
    target.role ===
    "本部管理者"
  ) {
    throw new HttpsError(
      "permission-denied",
      "本部管理者を操作できません。"
    );
  }

  const actorSchools =
    normalizeSchoolIds(
      actor.schoolIds
    );

  const sameSchool =
    target.schoolIds.some(
      (
        schoolId: string
      ) =>
        actorSchools.includes(
          schoolId
        )
    );

  if (!sameSchool) {
    throw new HttpsError(
      "permission-denied",
      "所属校舎が異なるため操作できません。"
    );
  }
}

/* =========================================================
   監査ログ
   ========================================================= */

async function writeAuditLog(
  input: {
    actorUid: string;

    action: string;

    targetUid?: string;

    metadata?: Record<
      string,
      unknown
    >;
  }
) {
  await db
    .collection(
      "auditLogs"
    )
    .add({
      actorUid:
        input.actorUid,

      action:
        input.action,

      targetUid:
        input.targetUid ??
        null,

      metadata:
        input.metadata ??
        {},

      createdAt:
        FieldValue.serverTimestamp(),
    });
}

/* =========================================================
   補助
   ========================================================= */

function normalizeSchoolIds(
  value: unknown
): string[] {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value.filter(
    (
      item: unknown
    ): item is string =>
      typeof item ===
      "string"
  );
}

function getUid(
  value: unknown
): string {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new HttpsError(
      "invalid-argument",
      "対象ユーザーが指定されていません。"
    );
  }

  return value.trim();
}

function normalizeRole(
  value: unknown
): UserRole {
  validateRole(
    value
  );

  return value;
}

function validateRole(
  value: unknown
): asserts value is UserRole {
  if (
    value !==
      "本部管理者" &&
    value !==
      "校舎管理者" &&
    value !== "講師" &&
    value !== "生徒"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "不正な権限です。"
    );
  }
}
