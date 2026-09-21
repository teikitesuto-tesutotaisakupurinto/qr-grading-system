import type { Permission } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

type RoutePermission = {
  path: string;
  permission: Permission;
};

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  {
    path: "/dashboard",
    permission: "dashboard.view",
  },

  {
    path: "/students",
    permission: "students.view",
  },

  {
    path: "/tests",
    permission: "tests.view",
  },

  {
    path: "/answers",
    permission: "answers.view",
  },

  {
    path: "/grading/review",
    permission: "grading.firstReview",
  },

  {
    path: "/grading/second-review",
    permission: "grading.secondReview",
  },

  {
    path: "/results",
    permission: "results.view",
  },

  {
    path: "/report-cards",
    permission: "reportCards.view",
  },

  {
    path: "/retests",
    permission: "retests.view",
  },

  {
    path: "/qr-stickers",
    permission: "qr.view",
  },

  {
    path: "/schools",
    permission: "schools.view",
  },

  {
    path: "/teachers",
    permission: "teachers.view",
  },

  {
    path: "/roles",
    permission: "roles.view",
  },

  {
    path: "/usage",
    permission: "usage.view",
  },

  {
    path: "/logs",
    permission: "logs.view",
  },

  {
    path: "/settings",
    permission: "settings.view",
  },
];

export function getRoutePermission(
  pathname: string
): Permission | null {
  /*
   * 完全一致を優先。
   */
  const exact =
    ROUTE_PERMISSIONS.find(
      (
        route
      ) =>
        pathname ===
        route.path
    );

  if (
    exact
  ) {
    return exact.permission;
  }

  /*
   * 子ページにも親ページの権限を適用。
   *
   * 例:
   * /students/import
   * /students/history
   *
   * → students.view
   */

  const nested =
    ROUTE_PERMISSIONS
      .filter(
        (
          route
        ) =>
          pathname.startsWith(
            `${route.path}/`
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.path.length -
          a.path.length
      )[0];

  return (
    nested?.permission ??
    null
  );
}

export function canAccessRoute(
  role:
    | UserRole
    | null
    | undefined,
  pathname: string
) {
  const permission =
    getRoutePermission(
      pathname
    );

  /*
   * 権限定義がない公開ページは
   * RouteGuard側で別途処理。
   */
  if (
    !permission
  ) {
    return true;
  }

  if (
    !role
  ) {
    return false;
  }

  return hasPermissionForRoute(
    role,
    permission
  );
}

function hasPermissionForRoute(
  role: UserRole,
  permission: Permission
) {
  /*
   * lib/permissions.ts と同じ定義を
   * 二重管理しない。
   */

  /*
   * dynamic importは使わず、
   * 共通関数を直接利用。
   */

  return permissionMap(
    role
  ).includes(
    permission
  );
}

function permissionMap(
  role: UserRole
): readonly Permission[] {
  /*
   * roleごとの権限は
   * lib/permissions.tsから取得。
   *
   * 循環importを避けるため、
   * ここでは専用関数を利用。
   */

  switch (
    role
  ) {
    case "本部管理者":
      return [
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
      ];

    case "校舎管理者":
      return [
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
      ];

    case "講師":
      return [
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
      ];

    case "生徒":
      return [
        "dashboard.view",

        "results.view",
        "results.self",

        "reportCards.view",
        "reportCards.self",
      ];

    default:
      return [];
  }
}
