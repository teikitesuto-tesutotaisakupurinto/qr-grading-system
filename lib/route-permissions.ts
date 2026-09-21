import {
  getPermissions,
  type Permission,
} from "@/lib/permissions";

import type {
  UserRole,
} from "@/lib/types";

type RoutePermission = {
  path: string;

  permission: Permission;
};

export const ROUTE_PERMISSIONS: RoutePermission[] =
  [
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
      path: "/results",
      permission:
        "results.view",
    },

    {
      path: "/report-cards",
      permission:
        "reportCards.view",
    },

    {
      path: "/learning",
      permission:
        "learning.view",
    },

    {
      path: "/retests",
      permission:
        "retests.view",
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
      path: "/teachers",
      permission:
        "teachers.view",
    },

    {
      path: "/roles",
      permission:
        "roles.view",
    },

    {
      path: "/usage",
      permission:
        "usage.view",
    },

    {
      path: "/logs",
      permission:
        "logs.view",
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
  const exact =
    ROUTE_PERMISSIONS.find(
      (
        route
      ) =>
        pathname ===
        route.path
    );

  if (exact) {
    return exact.permission;
  }

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

  if (!permission) {
    return true;
  }

  if (!role) {
    return false;
  }

  return getPermissions(
    role
  ).includes(
    permission
  );
}
