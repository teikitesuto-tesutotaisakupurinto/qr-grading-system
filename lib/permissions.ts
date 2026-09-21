import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Permission definitions
   ========================================================= */

export type Permission =
  /* Dashboard */
  | "dashboard.view"

  /* Students */
  | "students.view"
  | "students.create"
  | "students.update"
  | "students.csv"

  /* Tests */
  | "tests.view"
  | "tests.create"
  | "tests.update"

  /* Answers */
  | "answers.view"
  | "answers.upload"

  /* Grading */
  | "grading.firstReview"
  | "grading.secondReview"

  /* Results */
  | "results.view"
  | "results.all"
  | "results.self"

  /* Report cards */
  | "reportCards.view"
  | "reportCards.self"

  /* Learning */
  | "learning.view"
  | "learning.self"

  /* Retests */
  | "retests.view"
  | "retests.create"
  | "retests.score"
  | "retests.finalize"

  /* QR */
  | "qr.view"
  | "qr.create"

  /* Schools */
  | "schools.view"
  | "schools.create"
  | "schools.update"

  /* Teachers */
  | "teachers.view"
  | "teachers.create"
  | "teachers.update"

  /* Roles */
  | "roles.view"
  | "roles.update"

  /* Usage */
  | "usage.view"

  /* Logs */
  | "logs.view"

  /* Settings */
  | "settings.view"
  | "settings.update";

/* =========================================================
   Role permissions
   ========================================================= */

const ROLE_PERMISSIONS: Record<
  UserRole,
  readonly Permission[]
> = {
  /* =======================================================
     本部管理者
     ======================================================= */

  "本部管理者": [
    "dashboard.view",

    /*
     * 生徒
     */
    "students.view",
    "students.create",
    "students.update",
    "students.csv",

    /*
     * テスト
     */
    "tests.view",
    "tests.create",
    "tests.update",

    /*
     * 答案
     */
    "answers.view",
    "answers.upload",

    /*
     * 採点
     */
    "grading.firstReview",
    "grading.secondReview",

    /*
     * 成績
     */
    "results.view",
    "results.all",

    /*
     * 成績表
     */
    "reportCards.view",

    /*
     * 追試
     */
    "retests.view",
    "retests.create",
    "retests.score",
    "retests.finalize",

    /*
     * QR
     */
    "qr.view",
    "qr.create",

    /*
     * 校舎
     */
    "schools.view",
    "schools.create",
    "schools.update",

    /*
     * 講師
     */
    "teachers.view",
    "teachers.create",
    "teachers.update",

    /*
     * 権限
     */
    "roles.view",
    "roles.update",

    /*
     * 利用状況
     */
    "usage.view",

    /*
     * ログ
     */
    "logs.view",

    /*
     * システム設定
     */
    "settings.view",
    "settings.update",
  ],

  /* =======================================================
     校舎管理者
     ======================================================= */

  "校舎管理者": [
    "dashboard.view",

    /*
     * 生徒
     */
    "students.view",
    "students.create",
    "students.update",
    "students.csv",

    /*
     * テスト
     */
    "tests.view",
    "tests.create",
    "tests.update",

    /*
     * 答案
     */
    "answers.view",
    "answers.upload",

    /*
     * 採点
     */
    "grading.firstReview",
    "grading.secondReview",

    /*
     * 成績
     */
    "results.view",
    "results.all",

    /*
     * 成績表
     */
    "reportCards.view",

    /*
     * 追試
     */
    "retests.view",
    "retests.create",
    "retests.score",
    "retests.finalize",

    /*
     * QR
     */
    "qr.view",
    "qr.create",

    /*
     * 校舎運用
     */
    "usage.view",
    "logs.view",
  ],

  /* =======================================================
     講師
     ======================================================= */

  "講師": [
    "dashboard.view",

    /*
     * テスト
     */
    "tests.view",

    /*
     * 答案
     */
    "answers.view",
    "answers.upload",

    /*
     * 採点
     */
    "grading.firstReview",
    "grading.secondReview",

    /*
     * 成績
     */
    "results.view",
    "results.all",

    /*
     * 成績表
     */
    "reportCards.view",

    /*
     * 追試
     */
    "retests.view",
    "retests.create",
    "retests.score",
    "retests.finalize",

    /*
     * QR
     */
    "qr.view",
    "qr.create",
  ],

  /* =======================================================
     生徒
     ======================================================= */

  "生徒": [
    "dashboard.view",

    /*
     * 自分の成績だけ
     */
    "results.view",
    "results.self",

    /*
     * 自分の成績表だけ
     */
    "reportCards.view",
    "reportCards.self",

    /*
     * 自分の学習情報だけ
     */
    "learning.view",
    "learning.self",
  ],
};

/* =========================================================
   Permission check
   ========================================================= */

export function hasPermission(
  role:
    | UserRole
    | null
    | undefined,
  permission: Permission
): boolean {
  if (!role) {
    return false;
  }

  return ROLE_PERMISSIONS[
    role
  ].includes(
    permission
  );
}

/* =========================================================
   Get permissions
   ========================================================= */

export function getPermissions(
  role:
    | UserRole
    | null
    | undefined
): readonly Permission[] {
  if (!role) {
    return [];
  }

  return ROLE_PERMISSIONS[
    role
  ];
}

/* =========================================================
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return (
    role ===
    "本部管理者"
  );
}

export function isSchoolAdmin(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return (
    role ===
    "校舎管理者"
  );
}

export function isTeacher(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return (
    role ===
    "講師"
  );
}

export function isStudent(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return (
    role ===
    "生徒"
  );
}

export function isStaff(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return (
    role ===
      "本部管理者" ||
    role ===
      "校舎管理者" ||
    role ===
      "講師"
  );
}

export function isManagement(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return (
    role ===
      "本部管理者" ||
    role ===
      "校舎管理者"
  );
}

/* =========================================================
   Scope helpers
   ========================================================= */

export type PermissionScope =
  | "organization"
  | "school"
  | "student";

export function getDefaultScope(
  role:
    | UserRole
    | null
    | undefined
): PermissionScope | null {
  if (
    role ===
    "本部管理者"
  ) {
    return "organization";
  }

  if (
    role ===
      "校舎管理者" ||
    role ===
      "講師"
  ) {
    return "school";
  }

  if (
    role ===
    "生徒"
  ) {
    return "student";
  }

  return null;
}

/* =========================================================
   Self-only checks
   ========================================================= */

export function canViewOwnResults(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return hasPermission(
    role,
    "results.self"
  );
}

export function canViewAllResults(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return hasPermission(
    role,
    "results.all"
  );
}

export function canViewOwnReportCard(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return hasPermission(
    role,
    "reportCards.self"
  );
}

export function canViewLearning(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return hasPermission(
    role,
    "learning.view"
  );
}

export function canViewOwnLearning(
  role:
    | UserRole
    | null
    | undefined
): boolean {
  return hasPermission(
    role,
    "learning.self"
  );
}
