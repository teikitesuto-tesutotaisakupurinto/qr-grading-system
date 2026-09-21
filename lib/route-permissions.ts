import {
  getPermissions,
  type Permission,
} from "@/lib/permissions";

import type {
  UserRole,
} from "@/lib/types";

const ROUTES: Array<{
  path: string;
  permission: Permission;
}> = [
  {
    path: "/dashboard",
    permission:
      "dashboard.view",
  },

  {
    path: "/students",
    permission:
      "students.view",
  },

  {
    path: "/tests",
    permission:
      "tests.view",
  },

  {
    path: "/answers",
    permission:
      "answers.view",
  },

  {
    path: "/grading",
    permission:
      "answers.view",
  },

  {
    path: "/grading/review",
    permission:
      "grading.firstReview",
  },

  {
    path: "/grading/second-review",
    permission:
      "grading.secondReview",
  },

  {
    path: "/grading/confirm",
    permission:
      "grading.secondReview",
  },

  {
    path: "/results",
    permission:
      "results.view",
  },

  {
    path: "/reports",
    permission:
      "reportCards.view",
  },

  {
    path: "/report-cards",
    permission:
      "reportCards.view",
  },

  {
    path: "/retests",
    permission:
      "retests.view",
  },

  {
    path: "/qr",
    permission:
      "qr.view",
  },

  {
    path: "/qr-stickers",
    permission:
      "qr.view",
  },

  {
    path: "/schools",
    permission:
      "schools.view",
  },

  {
    path: "/users",
    permission:
      "teachers.view",
  },

  {
    path: "/settings",
    permission:
      "settings.view",
  },
];

export function getRoutePermission(
  pathname: string
): Permission | null {
  const route =
    ROUTES
      .filter(
        (
          item
        ) =>
          pathname ===
            item.path ||
          pathname.startsWith(
            `${item.path}/`
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
    route?.permission ??
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
  /*
   * ログイン・403等は
   * AppShell側で処理する。
   */
  if (
    pathname ===
      "/login" ||
    pathname ===
      "/403"
  ) {
    return true;
  }

  const permission =
    getRoutePermission(
      pathname
    );

  /*
   * まだ権限定義していない
   * 補助ページは通す。
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

  return getPermissions(
    role
  ).includes(
    permission
  );
}
