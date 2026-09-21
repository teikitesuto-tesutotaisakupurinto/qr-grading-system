import type {
  UserRole,
} from "@/types";

import type {
  ServerUser,
} from "./server-auth";

import {
  serverHasPermission,
} from "./server-permissions";

/* =========================================================
   Route rule
   ========================================================= */

type ServerRouteRule = {
  path: string;

  roles: readonly UserRole[];

  permission: Parameters<
    typeof serverHasPermission
  >[1];
};

/* =========================================================
   Rules
   ========================================================= */

const RULES: readonly ServerRouteRule[] =
  [
    {
      path:
        "/dashboard/head-office",

      roles: [
        "本部管理者",
      ],

      permission:
        "dashboard.headOffice",
    },

    {
      path:
        "/dashboard/school",

      roles: [
        "校舎管理者",
      ],

      permission:
        "dashboard.school",
    },

    {
      path:
        "/dashboard/teacher",

      roles: [
        "講師",
      ],

      permission:
        "dashboard.teacher",
    },

    {
      path:
        "/dashboard/student",

      roles: [
        "生徒",
      ],

      permission:
        "dashboard.student",
    },

    {
      path:
        "/students",

      roles: [
        "本部管理者",
        "校舎管理者",
      ],

      permission:
        "students.view",
    },

    {
      path:
        "/tests",

      roles: [
        "本部管理者",
        "校舎管理者",
        "講師",
      ],

      permission:
        "tests.view",
    },

    {
      path:
        "/answers",

      roles: [
        "本部管理者",
        "校舎管理者",
        "講師",
      ],

      permission:
        "answers.view",
    },

    {
      path:
        "/grading/review",

      roles: [
        "本部管理者",
        "校舎管理者",
        "講師",
      ],

      permission:
        "grading.firstReview",
    },

    {
      path:
        "/grading/second-review",

      roles: [
        "本部管理者",
        "校舎管理者",
        "講師",
      ],

      permission:
        "grading.secondReview",
    },

    {
      path:
        "/grading/confirm",

      roles: [
        "本部管理者",
        "校舎管理者",
        "講師",
      ],

      permission:
        "grading.confirm",
    },

    {
      path:
        "/grading",

      roles: [
        "本部管理者",
        "校舎管理者",
        "講師",
      ],

      permission:
        "grading.view",
    },

    {
      path:
        "/results/management",

      roles: [
        "本部管理者",
        "校舎管理者",
      ],

      permission:
        "results.all",
    },

    {
      path:
        "/results/teacher",

      roles: [
        "講師",
      ],

      permission:
        "results.all",
    },

    {
      path:
        "/results/student",

      roles: [
        "生徒",
      ],

      permission:
        "results.self",
    },

    {
      path:
        "/reports/management",

      roles: [
        "本部管理者",
        "校舎管理者",
      ],

      permission:
        "reports.all",
    },

    {
      path:
        "/reports/teacher",

      roles: [
        "講師",
      ],

      permission:
        "reports.all",
    },

    {
      path:
        "/reports/student",

      roles: [
        "生徒",
      ],

      permission:
        "reports.self",
    },

    {
      path:
        "/retests",

      roles: [
        "本部管理者",
        "校舎管理者",
        "講師",
      ],

      permission:
        "retests.view",
    },

    {
      path:
        "/qr-stickers",

      roles: [
        "本部管理者",
        "校舎管理者",
        "講師",
      ],

      permission:
        "qr.view",
    },

    {
      path:
        "/schools",

      roles: [
        "本部管理者",
        "校舎管理者",
      ],

      permission:
        "schools.manage",
    },

    {
      path:
        "/users",

      roles: [
        "本部管理者",
        "校舎管理者",
      ],

      permission:
        "users.manage",
    },

    {
      path:
        "/settings",

      roles: [
        "本部管理者",
        "校舎管理者",
      ],

      permission:
        "settings.manage",
    },
  ];

/* =========================================================
   Access
   ========================================================= */

export function canAccessServerRoute(
  user: ServerUser,
  pathname: string
) {
  /*
   * ルールは長いパスを優先。
   */
  const rule =
    [...RULES]
      .sort(
        (
          a,
          b
        ) =>
          b.path.length -
          a.path.length
      )
      .find(
        (
          item
        ) =>
          pathname ===
            item.path ||
          pathname.startsWith(
            `${item.path}/`
          )
      );

  /*
   * まだルールを設定していない
   * 補助ページはログイン済みなら通す。
   *
   * 最終完成時には全ページを登録する。
   */
  if (
    !rule
  ) {
    return true;
  }

  if (
    !user.role
  ) {
    return false;
  }

  if (
    !rule.roles.includes(
      user.role
    )
  ) {
    return false;
  }

  return serverHasPermission(
    user,
    rule.permission
  );
}
