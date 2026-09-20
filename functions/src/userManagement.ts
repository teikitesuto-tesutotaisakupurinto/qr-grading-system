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
  requireHeadOffice,
} from "./auth";

const adminAuth = getAuth();
const db = getFirestore();

type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

/* =========================================================
   管理者によるユーザー作成
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

      const studentNumber =
        typeof data.studentNumber ===
        "string"
          ? data.studentNumber
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

      /*
       * 校舎管理者は、自校舎の権限しか
       * 作成できない。
       */
      const requesterSnapshot =
        await db
          .collection("users")
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
        if (
          role ===
            "本部管理者" ||
          schoolIds.some(
            (schoolId) =>
              !(
                requester.schoolIds ??
                []
              ).includes(
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
          await adminAuth.createUser(
            {
              email,
              password,

              displayName:
                name,

              disabled:
                false,
            }
          );
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
          .collection("users")
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
        /*
         * Firestore登録に失敗した場合、
         * Authentication側に孤児アカウントを残さない。
         */
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
        request.data?.uid;

      if (
        typeof uid !==
        "string" ||
        !uid.trim()
      ) {
        throw new HttpsError(
          "invalid-argument",
          "対象ユーザーが指定されていません。"
        );
      }

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
        .collection("users")
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

        targetUid: uid,
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
        request.data?.uid;

      if (
        typeof uid !==
        "string" ||
        !uid.trim()
      ) {
        throw new HttpsError(
          "invalid-argument",
          "対象ユーザーが指定されていません。"
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
          disabled: false,
        }
      );

      await db
        .collection("users")
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

        targetUid: uid,
      });

      return {
        success: true,
      };
    }
  );

/* =========================================================
   パスワードリセットリンク生成
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
        request.data?.uid;

      if (
        typeof uid !==
        "string" ||
        !uid.trim()
      ) {
        throw new HttpsError(
          "invalid-argument",
          "対象ユーザーが指定されていません。"
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

        targetUid: uid,
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
   ユーザー権限変更
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
        request.data?.uid;

      const role =
        request.data
          ?.role as UserRole;

      const schoolIds =
        Array.isArray(
          request.data
            ?.schoolIds
        )
          ? request.data.schoolIds
          : [];

      validateRole(
        role
      );

      if (
        typeof uid !==
        "string" ||
        !uid.trim()
      ) {
        throw new HttpsError(
          "invalid-argument",
          "対象ユーザーが指定されていません。"
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

      /*
       * 校舎管理者は本部管理者を作れない。
       */
      const requesterSnapshot =
        await db
          .collection("users")
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
        .collection("users")
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

        targetUid: uid,

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
   対象ユーザー取得
   ========================================================= */

async function getTargetUser(
  uid: string
) {
  const snapshot =
    await db
      .collection("users")
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
      "ユーザー情報を取得できません。"
    );
  }

  return {
    uid,

    role:
      data.role as UserRole,

    schoolIds:
      Array.isArray(
        data.schoolIds
      )
        ? data.schoolIds
        : [],

    email:
      typeof data.email ===
      "string"
        ? data.email
        : "",
  };
}

/* =========================================================
   操作対象の権限確認
   ========================================================= */

async function checkTargetPermission(
  actorUid: string,
  target: {
    uid: string;
    role: UserRole;
    schoolIds: string[];
  }
) {
  const actorSnapshot =
    await db
      .collection("users")
      .doc(actorUid)
      .get();

  const actor =
    actorSnapshot.data();

  if (!actor) {
    throw new HttpsError(
      "permission-denied",
      "操作者の権限情報がありません。"
    );
  }

  if (
    actor.role ===
    "本部管理者"
  ) {
    return;
  }

  if (
    actor.role !==
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
    Array.isArray(
      actor.schoolIds
    )
      ? actor.schoolIds
      : [];

  const sameSchool =
    target.schoolIds.some(
      (schoolId) =>
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
    .collection("auditLogs")
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
   権限値検証
   ========================================================= */

function validateRole(
  role: unknown
): asserts role is UserRole {
  if (
    role !==
      "本部管理者" &&
    role !==
      "校舎管理者" &&
    role !== "講師" &&
    role !== "生徒"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "不正な権限です。"
    );
  }
}
