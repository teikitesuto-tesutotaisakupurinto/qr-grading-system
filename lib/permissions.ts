import type { UserRole } from "@/lib/types";

export type Permission =
  | "dashboard.view"

  | "students.view"
  | "students.create"
  | "students.update"
  | "students.csv"

  | "tests.view"
  | "tests.create"
  | "tests.update"

  | "answers.view"
  | "answers.upload"

  | "grading.firstReview"
  | "grading.secondReview"

  | "results.view"
  | "results.all"
  | "results.self"

  | "reportCards.view"
  | "reportCards.self"

  | "retests.view"
  | "retests.create"
  | "retests.score"
  | "retests.finalize"

  | "qr.view"
  | "qr.create"

  | "schools.view"
  | "schools.create"
  | "schools.update"

  | "teachers.view"
  | "teachers.create"
  | "teachers.update"

  | "roles.view"
  | "roles.update"

  | "usage.view"

  | "logs.view"

  | "settings.view"
  | "settings.update";

const ROLE_PERMISSIONS: Record<
  UserRole,
  readonly Permission[]
> = {
  "本部管理者": [
    "dashboard.view",

    "students.view",
    "students.create",
    "students.update",
    "students.csv",

    "tests.view",
    "tests.create",
    "tests.update",

    "answers.view",
    "answers.upload",

    "grading.firstReview",
    "grading.secondReview",

    "results.view",
    "results.all",

    "reportCards.view",

    "retests.view",
    "retests.create",
    "retests.score",
    "retests.finalize",

    "qr.view",
    "qr.create",

    "schools.view",
    "schools.create",
    "schools.update",

    "teachers.view",
    "teachers.create",
    "teachers.update",

    "roles.view",
    "roles.update",

    "usage.view",

    "logs.view",

    "settings.view",
    "settings.update",
  ],

  "校舎管理者": [
    "dashboard.view",

    "students.view",
    "students.create",
    "students.update",
    "students.csv",

    "tests.view",
    "tests.create",
    "tests.update",

    "answers.view",
    "answers.upload",

    "grading.firstReview",
    "grading.secondReview",

    "results.view",
    "results.all",

    "reportCards.view",

    "retests.view",
    "retests.create",
    "retests.score",
    "retests.finalize",

    "qr.view",
    "qr.create",

    "usage.view",

    "logs.view",
  ],

  "講師": [
    "dashboard.view",

    "tests.view",

    "answers.view",
    "answers.upload",

    "grading.firstReview",
    "grading.secondReview",

    "results.view",
    "results.all",

    "reportCards.view",

    "retests.view",
    "retests.create",
    "retests.score",
    "retests.finalize",

    "qr.view",
    "qr.create",
  ],

  "生徒": [
    "dashboard.view",

    "results.view",
    "results.self",

    "reportCards.view",
    "reportCards.self",
  ],
};

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) {
    return false;
  }

  return ROLE_PERMISSIONS[
    role
  ].includes(permission);
}

export function getPermissions(
  role: UserRole | null | undefined
): readonly Permission[] {
  if (!role) {
    return [];
  }

  return ROLE_PERMISSIONS[
    role
  ];
}

export function isAdminRole(
  role: UserRole | null | undefined
) {
  return (
    role === "本部管理者" ||
    role === "校舎管理者"
  );
}

export function isStaffRole(
  role: UserRole | null | undefined
) {
  return (
    role === "本部管理者" ||
    role === "校舎管理者" ||
    role === "講師"
  );
}

export function isStudentRole(
  role: UserRole | null | undefined
) {
  return role === "生徒";
}
