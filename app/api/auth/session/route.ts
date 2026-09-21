import {
  NextResponse,
} from "next/server";

import {
  cert,
  getApps,
  initializeApp,
  getApp,
} from "firebase-admin/app";

import {
  getAuth,
} from "firebase-admin/auth";

/* =========================================================
   Firebase Admin
   ========================================================= */

function getAdminApp() {
  if (
    getApps().length >
    0
  ) {
    return getApp();
  }

  const projectId =
    process.env
      .FIREBASE_ADMIN_PROJECT_ID;

  const clientEmail =
    process.env
      .FIREBASE_ADMIN_CLIENT_EMAIL;

  const privateKey =
    process.env
      .FIREBASE_ADMIN_PRIVATE_KEY
      ?.replace(
        /\\n/g,
        "\n"
      );

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      "Firebase Admin SDKの環境変数が設定されていません。"
    );
  }

  return initializeApp({
    credential:
      cert({
        projectId,

        clientEmail,

        privateKey,
      }),
  });
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const idToken =
      typeof body.idToken ===
      "string"
        ? body.idToken
        : "";

    if (
      !idToken
    ) {
      return NextResponse.json(
        {
          error:
            "ID Tokenがありません。",
        },
        {
          status:
            400,
        }
      );
    }

    const adminAuth =
      getAuth(
        getAdminApp()
      );

    /*
     * まずID Tokenを検証。
     */
    const decoded =
      await adminAuth.verifyIdToken(
        idToken
      );

    /*
     * セッションCookieを作成。
     *
     * 5日間。
     * Firebase側のセッション期限と
     * 運用要件に合わせて変更可能。
     */
    const expiresIn =
      5 *
      24 *
      60 *
      60 *
      1000;

    const sessionCookie =
      await adminAuth.createSessionCookie(
        idToken,
        {
          expiresIn,
        }
      );

    const response =
      NextResponse.json({
        success:
          true,

        uid:
          decoded.uid,
      });

    response.cookies.set(
      "test-system-session",
      sessionCookie,
      {
        httpOnly:
          true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite:
          "lax",

        path:
          "/",

        maxAge:
          5 *
          24 *
          60 *
          60,
      }
    );

    return response;
  } catch (
    error
  ) {
    console.error(
      "Session creation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "セッションを作成できませんでした。",
      },
      {
        status:
          401,
      }
    );
  }
}

/* =========================================================
   DELETE
   ========================================================= */

export async function DELETE() {
  const response =
    NextResponse.json({
      success:
        true,
    });

  response.cookies.set(
    "test-system-session",
    "",
    {
      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        0,
    }
  );

  return response;
}
