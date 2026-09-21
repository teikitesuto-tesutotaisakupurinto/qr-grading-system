import type {
  UserRole,
} from "@/lib/types";

/* =========================================================
   Permission
   ========================================================= */

export type Permission =
  /* Dashboard */
  | "dashboard.headOffice"
  | "dashboard.school"
  | "dashboard.teacher"
  | "dashboard.student"

  /* Students */
  | "students.view"
  | "students.create"
  | "students.update"
  | "students.csv"
  | "students.history"

  /* Tests */
  | "tests.view"
  | "tests.create"
  | "tests.update"
  | "tests.delete"

  /* Answers */
  | "answers.view"
  | "answers.upload"
  | "answers.delete"

  /* Grading */
  | "grading.view"
  | "grading.firstReview"
  | "grading.secondReview"
  | "grading.confirm"

  /* Results */
  | "results.view"
  | "results.all"
  | "results.self"

  /* Reports */
  | "reports.view"
  | "reports.all"
  | "reports.self"

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

  /* Users */
  | "users.view"
  | "users.create"
  | "users.update"
  | "users.disable"

  /* Settings */
  | "settings.view"
  | "settings.update";

/* =========================================================
   本部管理者
   ========================================================= */

const HEAD_OFFICE_PERMISSIONS: readonly Permission[] = [
  "dashboard.headOffice",

  "students.view",
  "students.create",
  "students.update",
  "students.csv",
  "students.history",

  "tests.view",
  "tests.create",
  "tests.update",
  "tests.delete",

  "answers.view",
  "answers.upload",
  "answers.delete",

  "grading.view",
  "grading.firstReview",
  "grading.secondReview",
  "grading.confirm",

  "results.view",
  "results.all",

  "reports.view",
  "reports.all",

  "retests.view",
  "retests.create",
  "retests.score",
  "retests.finalize",

  "qr.view",
  "qr.create",

  "schools.view",
  "schools.create",
  "schools.update",

  "users.view",
  "users.create",
  "users.update",
  "users.disable",

  "settings.view",
  "settings.update",
];

/* =========================================================
   校舎管理者
   ========================================================= */

const SCHOOL_ADMIN_PERMISSIONS: readonly Permission[] = [
  "dashboard.school",

  "students.view",
  "students.create",
  "students.update",
  "students.csv",
  "students.history",

  "tests.view",
  "tests.create",
  "tests.update",

  "answers.view",
  "answers.upload",

  "grading.view",
  "grading.firstReview",
  "grading.secondReview",
  "grading.confirm",

  "results.view",
  "results.all",

  "reports.view",
  "reports.all",

  "retests.view",
  "retests.create",
  "retests.score",
  "retests.finalize",

  "qr.view",
  "qr.create",

  "users.view",
  "users.create",
  "users.update",

  "settings.view",
];

/* =========================================================
   講師
   ========================================================= */

const TEACHER_PERMISSIONS: readonly Permission[] = [
  "dashboard.teacher",

  "tests.view",

  "answers.view",
  "answers.upload",

  "grading.view",
  "grading.firstReview",
  "grading.secondReview",
  "grading.confirm",

  "results.view",
  "results.all",

  "reports.view",
  "reports.all",

  "retests.view",
  "retests.create",
  "retests.score",
  "retests.finalize",

  "qr.view",
  "qr.create",
];

/* =========================================================
   生徒
   ========================================================= */

const STUDENT_PERMISSIONS: readonly Permission[] = [
  "dashboard.student",

  "results.view",
  "results.self",

  "reports.view",
  "reports.self",
];

/* =========================================================
   Permission map
   ========================================================= */

const ROLE_PERMISSIONS: Record<
  UserRole,
  readonly Permission[]
> = {
  "本部管理者":
    HEAD_OFFICE_PERMISSIONS,

  "校舎管理者":
    SCHOOL_ADMIN_PERMISSIONS,

  "講師":
    TEACHER_PERMISSIONS,

  "生徒":
    STUDENT_PERMISSIONS,
};

/* =========================================================
   Has permission
   ========================================================= */

export function hasPermission(
  role:
    | UserRole
    | null
    | undefined,

  permission: Permission
) {
  if (
    !role
  ) {
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
) {
  if (
    !role
  ) {
    return [];
  }

  return ROLE_PERMISSIONS[
    role
  ];
}

/* =========================================================
   Dashboard
   ========================================================= */

export function getDashboardPermission(
  role:
    | UserRole
    | null
    | undefined
) {
  switch (
    role
  ) {
    case "本部管理者":
      return "dashboard.headOffice" as const;

    case "校舎管理者":
      return "dashboard.school" as const;

    case "講師":
      return "dashboard.teacher" as const;

    case "生徒":
      return "dashboard.student" as const;

    default:
      return null;
  }
}

/* =========================================================
   Role helpers
   ========================================================= */

export function isHeadOfficeAdmin(
  role:
    | UserRole
    | null
    | undefined
) {
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
) {
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
) {
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
) {
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
) {
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
) {
  return (
    role ===
      "本部管理者" ||
    role ===
      "校舎管理者"
  );
}

/* =========================================================
   Scope
   ========================================================= */

export type DataScope =
  | "organization"
  | "school"
  | "student";

export function getDataScope(
  role:
    | UserRole
    | null
    | undefined
): DataScope | null {
  switch (
    role
  ) {
    case "本部管理者":
      return "organization";

    case "校舎管理者":
    case "講師":
      return "school";

    case "生徒":
      return "student";

    default:
      return null;
  }
}

/* =========================================================
   Students
   ========================================================= */

export function canViewStudents(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "students.view"
  );
}

export function canCreateStudents(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "students.create"
  );
}

export function canUpdateStudents(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "students.update"
  );
}

export function canImportStudents(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "students.csv"
  );
}

/* =========================================================
   Tests
   ========================================================= */

export function canViewTests(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "tests.view"
  );
}

export function canCreateTests(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "tests.create"
  );
}

export function canUpdateTests(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "tests.update"
  );
}

export function canDeleteTests(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "tests.delete"
  );
}

/* =========================================================
   Answers
   ========================================================= */

export function canViewAnswers(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "answers.view"
  );
}

export function canUploadAnswers(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "answers.upload"
  );
}

export function canDeleteAnswers(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "answers.delete"
  );
}

/* =========================================================
   Grading
   ========================================================= */

export function canViewGrading(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "grading.view"
  );
}

export function canFirstReview(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "grading.firstReview"
  );
}

export function canSecondReview(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "grading.secondReview"
  );
}

export function canConfirmGrading(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "grading.confirm"
  );
}

/* =========================================================
   Results
   ========================================================= */

export function canViewResults(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "results.view"
  );
}

export function canViewAllResults(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "results.all"
  );
}

export function canViewOwnResults(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "results.self"
  );
}

/* =========================================================
   Reports
   ========================================================= */

export function canViewReports(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "reports.view"
  );
}

export function canViewAllReports(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "reports.all"
  );
}

export function canViewOwnReports(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "reports.self"
  );
}

/* =========================================================
   Retests
   ========================================================= */

export function canViewRetests(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "retests.view"
  );
}

export function canCreateRetests(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "retests.create"
  );
}

export function canScoreRetests(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "retests.score"
  );
}

export function canFinalizeRetests(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "retests.finalize"
  );
}

/* =========================================================
   QR
   ========================================================= */

export function canViewQR(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "qr.view"
  );
}

export function canCreateQR(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "qr.create"
  );
}

/* =========================================================
   Schools
   ========================================================= */

export function canViewSchools(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "schools.view"
  );
}

export function canCreateSchools(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "schools.create"
  );
}

export function canUpdateSchools(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "schools.update"
  );
}

/* =========================================================
   Users
   ========================================================= */

export function canViewUsers(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "users.view"
  );
}

export function canCreateUsers(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "users.create"
  );
}

export function canUpdateUsers(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "users.update"
  );
}

export function canDisableUsers(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "users.disable"
  );
}

/* =========================================================
   Settings
   ========================================================= */

export function canViewSettings(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "settings.view"
  );
}

export function canUpdateSettings(
  role:
    | UserRole
    | null
    | undefined
) {
  return hasPermission(
    role,
    "settings.update"
  );
}
