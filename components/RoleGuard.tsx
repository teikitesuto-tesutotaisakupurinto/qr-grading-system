"use client";

import {
  ReactNode,
} from "react";

import {
  Permission,
  hasPermission,
} from "@/lib/permissions";

import type {
  UserRole,
} from "@/lib/types";

type RoleGuardProps = {
  role:
    | UserRole
    | null
    | undefined;

  permission: Permission;

  children: ReactNode;

  fallback?: ReactNode;
};

export default function RoleGuard({
  role,
  permission,
  children,
  fallback,
}: RoleGuardProps) {
  if (
    !hasPermission(
      role,
      permission
    )
  ) {
    return (
      fallback ?? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
          }}
        >
          <h2>
            権限がありません
          </h2>

          <p
            style={{
              color: "#666",
            }}
          >
            この機能を利用する権限がありません。
          </p>
        </div>
      )
    );
  }

  return (
    <>
      {children}
    </>
  );
}
