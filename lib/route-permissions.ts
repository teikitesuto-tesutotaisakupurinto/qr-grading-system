import type {
  UserRole,
} from "@/lib/types";

import {
  hasPermission,
  type Permission,
} from "@/lib/permissions";

/* =========================================================
   Route definition
   ========================================================= */

export type RouteDefinition = {
  path: string;

  permission: Permission;

  /*
   * 画面そのものを権限別に分けるための
   * 対象ロール。
   */
  roles: readonly UserRole[];

  /*
   * 完全一致を優先するか。
   */
  exact?: boolean;
};

/* =========================================================
   Dashboard
   ========================================================= */

const DASHBOARD_ROUTES: readonly RouteDefinition[] = [
  {
    path: "/dashboard/head-office",

    permission:
      "dashboard.headOffice",

    roles: [
      "本部管理者",
    ],
  },

  {
    path: "/dashboard/school",

    permission:
      "dashboard.school",

    roles: [
      "校舎管理者",
    ],
  },

  {
    path: "/dashboard/teacher",

    permission:
      "dashboard.teacher",

    roles: [
      "講師",
    ],
  },

  {
    path: "/dashboard/student",

    permission:
      "dashboard.student",

    roles: [
      "生徒",
    ],
  },

  /*
   * 旧URL。
   *
   * 新しい画面へリダイレクトする用途。
   * 実画面としては使用しない。
   */
  {
    path: "/dashboard",

    permission:
      "dashboard.student",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
      "生徒",
    ],
  },
];

/* =========================================================
   Management
   ========================================================= */

const MANAGEMENT_ROUTES: readonly RouteDefinition[] = [
  {
    path: "/students",

    permission:
      "students.view",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    path: "/students/import",

    permission:
      "students.csv",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    path: "/tests",

    permission:
      "tests.view",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/answers",

    permission:
      "answers.view",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/grading",

    permission:
      "grading.view",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/grading/review",

    permission:
      "grading.firstReview",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/grading/second-review",

    permission:
      "grading.secondReview",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/grading/confirm",

    permission:
      "grading.confirm",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
];

/* =========================================================
   Results
   ========================================================= */

const RESULT_ROUTES: readonly RouteDefinition[] = [
  /*
   * 管理・講師向け
   */
  {
    path: "/results/management",

    permission:
      "results.all",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    path: "/results/teacher",

    permission:
      "results.all",

    roles: [
      "講師",
    ],
  },

  /*
   * 生徒専用
   */
  {
    path: "/results/student",

    permission:
      "results.self",

    roles: [
      "生徒",
    ],
  },

  /*
   * 旧URL。
   *
   * 実画面としての利用は推奨しない。
   */
  {
    path: "/results",

    permission:
      "results.view",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
      "生徒",
    ],
  },
];

/* =========================================================
   Reports
   ========================================================= */

const REPORT_ROUTES: readonly RouteDefinition[] = [
  /*
   * 管理者・講師
   */
  {
    path: "/reports/management",

    permission:
      "reports.all",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    path: "/reports/teacher",

    permission:
      "reports.all",

    roles: [
      "講師",
    ],
  },

  /*
   * 生徒
   */
  {
    path: "/reports/student",

    permission:
      "reports.self",

    roles: [
      "生徒",
    ],
  },

  /*
   * 旧URL
   */
  {
    path: "/reports",

    permission:
      "reports.view",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
      "生徒",
    ],
  },
];

/* =========================================================
   Retests
   ========================================================= */

const RETEST_ROUTES: readonly RouteDefinition[] = [
  {
    path: "/retests",

    permission:
      "retests.view",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/retests/create",

    permission:
      "retests.create",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/retests/score",

    permission:
      "retests.score",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/retests/finalize",

    permission:
      "retests.finalize",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
];

/* =========================================================
   QR
   ========================================================= */

const QR_ROUTES: readonly RouteDefinition[] = [
  {
    path: "/qr-stickers",

    permission:
      "qr.view",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },

  {
    path: "/qr-stickers/create",

    permission:
      "qr.create",

    roles: [
      "本部管理者",
      "校舎管理者",
      "講師",
    ],
  },
];

/* =========================================================
   Administration
   ========================================================= */

const ADMIN_ROUTES: readonly RouteDefinition[] = [
  {
    path: "/schools",

    permission:
      "schools.view",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    path: "/schools/create",

    permission:
      "schools.create",

    roles: [
      "本部管理者",
    ],
  },

  {
    path: "/users",

    permission:
      "users.view",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    path: "/users/create",

    permission:
      "users.create",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },

  {
    path: "/settings",

    permission:
      "settings.view",

    roles: [
      "本部管理者",
      "校舎管理者",
    ],
  },
];

/* =========================================================
   All routes
   ========================================================= */

export const ROUTE_DEFINITIONS: readonly RouteDefinition[] =
  [
    ...DASHBOARD_ROUTES,

    ...MANAGEMENT_ROUTES,

    ...RESULT_ROUTES,

    ...REPORT_ROUTES,

    ...RETEST_ROUTES,

    ...QR_ROUTES,

    ...ADMIN_ROUTES,
  ];

/* =========================================================
   Find route
   ========================================================= */

export function findRouteDefinition(
  pathname: string
) {
  /*
   * 長いパスを優先。
   *
   * /grading
   * より
   *
   * /grading/review
   *
   * を優先する。
   */
  return (
    [...ROUTE_DEFINITIONS]
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
          route
        ) =>
          pathname ===
            route.path ||
          pathname.startsWith(
            `${route.path}/`
          )
      ) ??
    null
  );
}

/* =========================================================
   Role route access
   ========================================================= */

export function canAccessRoute(
  role:
    | UserRole
    | null
    | undefined,

  pathname: string
) {
  /*
   * 公開ページ
   */
  if (
    pathname ===
      "/login" ||
    pathname.startsWith(
      "/login/"
    )
  ) {
    return true;
  }

  /*
   * 権限定義がない補助ページは、
   * ここだけでは拒否しない。
   *
   * 実際の画面ではAuthGuardを使う。
   */
  const route =
    findRouteDefinition(
      pathname
    );

  if (
    !route
  ) {
    return true;
  }

  if (
    !role
  ) {
    return false;
  }

  /*
   * ロール自体をチェック。
   */
  if (
    !route.roles.includes(
      role
    )
  ) {
    return false;
  }

  /*
   * Permissionもチェック。
   */
  return hasPermission(
    role,
    route.permission
  );
}

/* =========================================================
   Route permission
   ========================================================= */

export function getRoutePermission(
  pathname: string
): Permission | null {
  const route =
    findRouteDefinition(
      pathname
    );

  return (
    route?.permission ??
    null
  );
}

/* =========================================================
   Allowed roles
   ========================================================= */

export function getRouteRoles(
  pathname: string
): readonly UserRole[] {
  const route =
    findRouteDefinition(
      pathname
    );

  return (
    route?.roles ??
    []
  );
}

/* =========================================================
   Route exists
   ========================================================= */

export function isProtectedRoute(
  pathname: string
) {
  return (
    findRouteDefinition(
      pathname
    ) !== null
  );
}

/* =========================================================
   Role dashboard
   ========================================================= */

export function getDashboardRoute(
  role:
    | UserRole
    | null
    | undefined
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
   Role-specific result route
   ========================================================= */

export function getResultsRoute(
  role:
    | UserRole
    | null
    | undefined
) {
  switch (
    role
  ) {
    case "本部管理者":
    case "校舎管理者":
      return "/results/management";

    case "講師":
      return "/results/teacher";

    case "生徒":
      return "/results/student";

    default:
      return "/login";
  }
}

/* =========================================================
   Role-specific report route
   ========================================================= */

export function getReportsRoute(
  role:
    | UserRole
    | null
    | undefined
) {
  switch (
    role
  ) {
    case "本部管理者":
    case "校舎管理者":
      return "/reports/management";

    case "講師":
      return "/reports/teacher";

    case "生徒":
      return "/reports/student";

    default:
      return "/login";
  }
}
