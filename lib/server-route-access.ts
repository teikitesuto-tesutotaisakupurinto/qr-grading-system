import type {
  UserRole,
} from "@/lib/types";

import type {
  ServerUser,
} from "@/lib/server-permissions";

/* =========================================================
   Route Access
   ========================================================= */

export type RouteAccessRule = {
  prefix: string;

  roles: UserRole[];
};

/* =========================================================
   Protected routes
   ========================================================= */

export const ROUTE_ACCESS_RULES:
  RouteAccessRule[] = [
  {
    prefix:
      "/dashboard/head-office",

    roles: [
      "本部管理者",
    ],
  },

  {
    prefix:
      "/dashboard/school",

    roles: [
      "校舎管理者",
    ],
  },

  {
    prefix:
      "/dashboard/teacher",

    roles: [
      "講師",
    ],
  },

  {
    prefix:
      "/dashboard/student",

    roles: [
      "生徒",
    ],
  },

  {
    prefix:
      "/schools",

    roles: [
      "本部管理者",
    ],
  },

  {
    prefix:
      "/users",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    prefix:
      "/students",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    prefix:
      "/tests",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/answers",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/grading",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/results",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/reports",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/retests",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    prefix:
      "/qr-stickers",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    prefix:
      "/settings",

    roles: [
      "本部管理者",
    ],
  },
];

/* =========================================================
   Find rule
   ========================================================= */

export function findRouteAccessRule(
  pathname: string
):
  | RouteAccessRule
  | null {
  const rules =
    [
      ...ROUTE_ACCESS_RULES,
    ].sort(
      (
        a,
        b
      ) =>
        b.prefix.length -
        a.prefix.length
    );

  return (
    rules.find(
      (
        rule
      ) =>
        pathname ===
          rule.prefix ||
        pathname.startsWith(
          `${rule.prefix}/`
        )
    ) ??
    null
  );
}

/* =========================================================
   Check role
   ========================================================= */

export function canAccessRoute(
  user:
    | ServerUser
    | null
    | undefined,
  pathname: string
) {
  if (
    !user ||
    !user.active
  ) {
    return false;
  }

  const rule =
    findRouteAccessRule(
      pathname
    );

  /*
   * 保護対象として登録されていない
   * ルートは、この関数では許可する。
   *
   * ログイン必須かどうかはAuthGuard側で確認。
   */
  if (
    !rule
  ) {
    return true;
  }

  return rule.roles.includes(
    user.role
  );
}

/* =========================================================
   Require route access
   ========================================================= */

export function assertRouteAccess(
  user:
    | ServerUser
    | null
    | undefined,
  pathname: string
) {
  if (
    !user ||
    !user.active
  ) {
    throw new Error(
      "認証が必要です。"
    );
  }

  const rule =
    findRouteAccessRule(
      pathname
    );

  if (
    !rule
  ) {
    return true;
  }

  if (
    !rule.roles.includes(
      user.role
    )
  ) {
    throw new Error(
      "この画面を利用する権限がありません。"
    );
  }

  return true;
}

/* =========================================================
   Role-specific route
   ========================================================= */

export function getRoleHomePath(
  role: UserRole
) {
  switch (
    role
  ) {
    case "本部管理者":
      return "/dashboard/head-office";

    case "校舎管理者":
      return "/dashboard/school";

    case "講師":
      return "/dashboard/teacher";

    case "生徒":
      return "/dashboard/student";

    default:
      return "/login";
  }
}

/* =========================================================
   Public routes
   ========================================================= */

export function isPublicRoute(
  pathname: string
) {
  return (
    pathname ===
      "/login" ||
    pathname.startsWith(
      "/login/"
    ) ||
    pathname ===
      "/onboarding" ||
    pathname.startsWith(
      "/onboarding/"
    )
  );
}

/* =========================================================
   Authentication required
   ========================================================= */

export function requiresAuthentication(
  pathname: string
) {
  return !isPublicRoute(
    pathname
  );
}
