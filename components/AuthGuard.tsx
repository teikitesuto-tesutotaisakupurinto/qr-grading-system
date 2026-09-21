"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  observeAuth,
  type AppUser,
} from "@/lib/auth";

type AuthGuardProps = {
  children: ReactNode;
};

export default function AuthGuard({
  children,
}: AuthGuardProps) {
  const router = useRouter();

  const pathname = usePathname();

  const [user, setUser] =
    useState<AppUser | null>(null);

  const [checking, setChecking] =
    useState(true);

  useEffect(() => {
    /*
     * ログイン画面は認証チェック対象外
     */
    if (pathname === "/login") {
      setChecking(false);
      return;
    }

    const unsubscribe =
      observeAuth(
        (appUser) => {
          if (!appUser) {
            setUser(null);
            setChecking(false);

            router.replace(
              `/login?next=${encodeURIComponent(
                pathname
              )}`
            );

            return;
          }

          setUser(appUser);
          setChecking(false);
        },
        () => {
          setUser(null);
          setChecking(false);

          router.replace("/login");
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    pathname,
    router,
  ]);

  /*
   * ログインページはそのまま表示
   */
  if (pathname === "/login") {
    return <>{children}</>;
  }

  /*
   * 認証確認中は何も表示しない
   */
  if (checking) {
    return null;
  }

  /*
   * 未ログインなら何も表示しない。
   * router.replace()で/loginへ移動する。
   */
  if (!user) {
    return null;
  }

  /*
   * ログイン済み
   */
  return <>{children}</>;
}
