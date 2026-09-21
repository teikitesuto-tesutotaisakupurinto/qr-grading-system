import {
  cert,
  getApps,
  initializeApp,
  getApp,
} from "firebase-admin/app";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  getFirestore,
} from "firebase-admin/firestore";

import type {
  UserRole,
} from "@/types";

/* =========================================================
   Firebase Admin
   ========================================================= */

function getAdminApp() {
  if (
    getApps().length >
    0
  ) {
    return getApp();
  }

  const projectId =
    process.env
      .FIREBASE_ADMIN_PROJECT_ID;

  const clientEmail =
    process.env
      .FIREBASE_ADMIN_CLIENT_EMAIL;

  const privateKey =
    process.env
      .FIREBASE_ADMIN_PRIVATE_KEY
      ?.replace(
        /\\n/g,
        "\n"
      );

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      "Firebase Admin SDKの環境変数が設定されていません。"
    );
  }

  return initializeApp({
    credential:
      cert({
        projectId,

        clientEmail,

        privateKey,
      }),
  });
}

/* =========================================================
   Admin clients
   ========================================================= */

function getAdminAuth() {
  return getAuth(
    getAdminApp()
  );
}

function getAdminDb() {
  return getFirestore(
    getAdminApp()
  );
}

/* =========================================================
   App user
   ========================================================= */

export type ServerUser = {
  uid: string;

  role: UserRole | null;

  organizationId:
    | string
    | null;

  schoolIds: string[];

  studentId:
    | string
    | null;

  name: string;

  email:
    | string
    | null;

  active: boolean;
};

/* =========================================================
   Role normalization
   ========================================================= */

function normalizeRole(
  value: unknown
): UserRole | null {
  switch (
    value
  ) {
    case "本部管理者":
    case "hq":
    case "head_office":
    case "headOfficeAdmin":
      return "本部管理者";

    case "校舎管理者":
    case "school_admin":
    case "schoolAdmin":
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
   Verify session cookie
   ========================================================= */

export async function getServerUser(
  sessionCookie:
    | string
    | null
    | undefined
): Promise<ServerUser | null> {
  if (
    !sessionCookie
  ) {
    return null;
  }

  try {
    const decoded =
      await getAdminAuth().verifySessionCookie(
        sessionCookie,
        true
      );

    const snapshot =
      await getAdminDb()
        .collection(
          "users"
        )
        .doc(
          decoded.uid
        )
        .get();

    if (
      !snapshot.exists
    ) {
      return null;
    }

    const data =
      snapshot.data() ??
      {};

    return {
      uid:
        decoded.uid,

      role:
        normalizeRole(
          data.role
        ),

      organizationId:
        typeof data.organizationId ===
        "string"
          ? data.organizationId
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
          : decoded.email ??
            null,

      active:
        data.active !==
        false,
    };
  } catch (
    error
  ) {
    console.error(
      "Server session verification failed:",
      error
    );

    return null;
  }
}

/* =========================================================
   Verify current request
   ========================================================= */

export async function requireServerUser(
  sessionCookie:
    | string
    | null
    | undefined
) {
  const user =
    await getServerUser(
      sessionCookie
    );

  if (
    !user
  ) {
    throw new Error(
      "UNAUTHENTICATED"
    );
  }

  if (
    !user.active
  ) {
    throw new Error(
      "USER_DISABLED"
    );
  }

  if (
    !user.role
  ) {
    throw new Error(
      "ROLE_NOT_ASSIGNED"
    );
  }

  if (
    !user.organizationId
  ) {
    throw new Error(
      "ORGANIZATION_NOT_ASSIGNED"
    );
  }

  return user;
}

/* =========================================================
   Verify role
   ========================================================= */

export async function requireServerRole(
  sessionCookie:
    | string
    | null
    | undefined,

  roles: readonly UserRole[]
) {
  const user =
    await requireServerUser(
      sessionCookie
    );

  if (
    !user.role ||
    !roles.includes(
      user.role
    )
  ) {
    throw new Error(
      "FORBIDDEN"
    );
  }

  return user;
}

/* =========================================================
   Organization access
   ========================================================= */

export function canAccessOrganization(
  user: ServerUser,
  organizationId: string
) {
  return (
    user.role ===
      "本部管理者" &&
    user.organizationId ===
      organizationId
  );
}

/* =========================================================
   School access
   ========================================================= */

export function canAccessSchool(
  user: ServerUser,
  schoolId: string
) {
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
  user: ServerUser,
  studentId: string,
  schoolId?: string
) {
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
    return Boolean(
      schoolId &&
        user.schoolIds.includes(
          schoolId
        )
    );
  }

  return (
    user.role ===
      "生徒" &&
    user.studentId ===
      studentId
  );
}
