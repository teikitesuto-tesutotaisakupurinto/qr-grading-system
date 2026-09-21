import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getServerUser,
} from "@/lib/server-auth";

import {
  canAccessServerRoute,
} from "@/lib/server-route-access";

/* =========================================================
   Middleware
   ========================================================= */

export async function middleware(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  /*
   * Next内部・静的ファイル・APIの一部は除外。
   */
  if (
    pathname.startsWith(
      "/_next/"
    ) ||
    pathname.startsWith(
      "/favicon"
    ) ||
    pathname.startsWith(
      "/api/auth/"
    ) ||
    pathname.includes(
      "."
    )
  ) {
    return NextResponse.next();
  }

  /*
   * ログインページ。
   */
  if (
    pathname ===
      "/login" ||
    pathname.startsWith(
      "/login/"
    )
  ) {
    return NextResponse.next();
  }

  const session =
    request.cookies.get(
      "test-system-session"
    )?.value;

  /*
   * セッションなし。
   */
  if (
    !session
  ) {
    const loginUrl =
      new URL(
        "/login",
        request.url
      );

    loginUrl.searchParams.set(
      "next",
      pathname
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  /*
   * サーバーでセッション検証。
   */
  const user =
    await getServerUser(
      session
    );

  if (
    !user
  ) {
    const response =
      NextResponse.redirect(
        new URL(
          "/login",
          request.url
        )
      );

    response.cookies.delete(
      "test-system-session"
    );

    return response;
  }

  /*
   * 権限チェック。
   */
  const allowed =
    canAccessServerRoute(
      user,
      pathname
    );

  if (
    !allowed
  ) {
    return NextResponse.redirect(
      new URL(
        "/403",
        request.url
      )
    );
  }

  return NextResponse.next();
}

/* =========================================================
   Matcher
   ========================================================= */

export const config = {
  matcher: [
    /*
     * API auth以外のアプリページ。
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
