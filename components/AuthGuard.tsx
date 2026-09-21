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

  const pathname =
    usePathname();

  const [user, setUser] =
    useState<AppUser | null>(
      null
    );

  const [checking, setChecking] =
    useState(true);

  useEffect(() => {
    /*
     * ログインページは
     * 認証ガードの対象外。
     */
    if (
      pathname === "/login"
    ) {
      setChecking(false);

      return;
    }

    const unsubscribe =
      observeAuth(
        (appUser) => {
          /*
           * 未ログイン
           */
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

          /*
           * ログイン済み
           */
          setUser(
            appUser
          );

          setChecking(false);
        },
        () => {
          /*
           * 認証エラー
           */
          setUser(null);

          setChecking(false);

          router.replace(
            "/login"
          );
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
   * ログインページ
   */
  if (
    pathname === "/login"
  ) {
    return <>{children}</>;
  }

  /*
   * 認証確認中は何も表示しない。
   */
  if (checking) {
    return null;
  }

  /*
   * 未ログイン時は何も表示しない。
   *
   * router.replace("/login")
   * がログイン画面へ移動させる。
   */
  if (!user) {
    return null;
  }

  /*
   * 認証済み
   */
  return <>{children}</>;
}
