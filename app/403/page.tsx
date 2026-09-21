"use client";

import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main
      style={{
        minHeight:
          "100vh",

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding:
          24,

        background:
          "#f5f6f8",
      }}
    >
      <section
        style={{
          width:
            "100%",

          maxWidth:
            480,

          padding:
            36,

          background:
            "#fff",

          border:
            "1px solid #e1e4e8",

          borderRadius:
            12,

          textAlign:
            "center",
        }}
      >
        <div
          style={{
            fontSize:
              48,

            fontWeight:
              800,

            marginBottom:
              12,
          }}
        >
          403
        </div>

        <h1
          style={{
            margin:
              "0 0 10px",
          }}
        >
          権限がありません
        </h1>

        <p
          style={{
            margin:
              "0 0 24px",

            color:
              "#666",

            lineHeight:
              1.8,
          }}
        >
          このページを利用する権限がありません。
          <br />
          必要な場合は管理者に確認してください。
        </p>

        <Link
          href="/dashboard"
          style={{
            display:
              "inline-block",

            padding:
              "11px 24px",

            borderRadius:
              7,

            background:
              "#111",

            color:
              "#fff",

            textDecoration:
              "none",

            fontWeight:
              600,
          }}
        >
          ダッシュボードへ戻る
        </Link>
      </section>
    </main>
  );
}
