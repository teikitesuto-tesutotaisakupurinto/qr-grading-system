import type {
  UserRole,
} from "@/types";

import type {
  ServerUser,
} from "./server-auth";

/* =========================================================
   Server permissions
   ========================================================= */

export type ServerPermission =
  | "dashboard.headOffice"
  | "dashboard.school"
  | "dashboard.teacher"
  | "dashboard.student"

  | "students.view"
  | "students.manage"

  | "tests.view"
  | "tests.manage"

  | "answers.view"
  | "answers.upload"

  | "grading.view"
  | "grading.firstReview"
  | "grading.secondReview"
  | "grading.confirm"

  | "results.all"
  | "results.self"

  | "reports.all"
  | "reports.self"

  | "retests.view"
  | "retests.manage"

  | "qr.view"
  | "qr.manage"

  | "schools.manage"

  | "users.manage"

  | "settings.manage";

/* =========================================================
   Permissions
   ========================================================= */

const PERMISSIONS: Record<
  UserRole,
  readonly ServerPermission[]
> = {
  "本部管理者": [
    "dashboard.headOffice",

    "students.view",
    "students.manage",

    "tests.view",
    "tests.manage",

    "answers.view",
    "answers.upload",

    "grading.view",
    "grading.firstReview",
    "grading.secondReview",
    "grading.confirm",

    "results.all",

    "reports.all",

    "retests.view",
    "retests.manage",

    "qr.view",
    "qr.manage",

    "schools.manage",

    "users.manage",

    "settings.manage",
  ],

  "校舎管理者": [
    "dashboard.school",

    "students.view",
    "students.manage",

    "tests.view",
    "tests.manage",

    "answers.view",
    "answers.upload",

    "grading.view",
    "grading.firstReview",
    "grading.secondReview",
    "grading.confirm",

    "results.all",

    "reports.all",

    "retests.view",
    "retests.manage",

    "qr.view",
    "qr.manage",

    "users.manage",

    "settings.manage",
  ],

  "講師": [
    "dashboard.teacher",

    "tests.view",

    "answers.view",
    "answers.upload",

    "grading.view",
    "grading.firstReview",
    "grading.secondReview",
    "grading.confirm",

    "results.all",

    "reports.all",

    "retests.view",
    "retests.manage",

    "qr.view",
    "qr.manage",
  ],

  "生徒": [
    "dashboard.student",

    "results.self",

    "reports.self",
  ],
};

/* =========================================================
   Has permission
   ========================================================= */

export function serverHasPermission(
  user: ServerUser,
  permission: ServerPermission
) {
  if (
    !user.role
  ) {
    return false;
  }

  return PERMISSIONS[
    user.role
  ].includes(
    permission
  );
}

/* =========================================================
   Require permission
   ========================================================= */

export function requireServerPermission(
  user: ServerUser,
  permission: ServerPermission
) {
  if (
    !serverHasPermission(
      user,
      permission
    )
  ) {
    throw new Error(
      "FORBIDDEN"
    );
  }

  return user;
}

/* =========================================================
   Role
   ========================================================= */

export function requireRole(
  user: ServerUser,
  roles: readonly UserRole[]
) {
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
