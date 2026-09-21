"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  getCurrentUser,
  type UserRole,
} from "@/lib/auth";

type RoleGuardProps = {
  children: ReactNode;
  allowedRoles: UserRole[];
};

export default function RoleGuard({
  children,
  allowedRoles,
}: RoleGuardProps) {
  const router = useRouter();

  const [checking, setChecking] =
    useState(true);

  const [allowed, setAllowed] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkRole() {
      try {
        const user =
          await getCurrentUser();

        if (cancelled) {
          return;
        }

        /*
         * 未ログイン
         */
        if (!user) {
          setAllowed(false);
          setChecking(false);

          router.replace("/login");

          return;
        }

        /*
         * Firebase Authenticationには
         * ログインしているが、
         * Firestore側のユーザー登録が
         * 完了していない場合。
         */
        if (!user.active) {
          setAllowed(false);
          setChecking(false);

          return;
        }

        /*
         * roleが未設定の場合。
         */
        if (!user.role) {
          setAllowed(false);
          setChecking(false);

          return;
        }

        /*
         * 権限確認
         */
        if (
          !allowedRoles.includes(
            user.role
          )
        ) {
          setAllowed(false);
          setChecking(false);

          return;
        }

        /*
         * 正式に許可
         */
        setAllowed(true);
        setChecking(false);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "RoleGuard error:",
          error
        );

        setAllowed(false);
        setChecking(false);
      }
    }

    void checkRole();

    return () => {
      cancelled = true;
    };
  }, [
    allowedRoles,
    router,
  ]);

  /*
   * 認証・権限確認中は何も表示しない
   */
  if (checking) {
    return null;
  }

  /*
   * 権限なし
   */
  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
