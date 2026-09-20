"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);

      router.replace("/");
    } catch {
      setError(
        "メールアドレスまたはパスワードを確認してください。"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginLogo">
          塾ロゴ
        </div>

        <h1>QR答案採点システム</h1>

        <p className="loginSubtitle">
          ログイン
        </p>

        <form onSubmit={handleSubmit}>
          <label className="formLabel">
            メールアドレス

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />
          </label>

          <label className="formLabel">
            パスワード

            <div className="passwordInput">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
                className="passwordToggle"
              >
                {showPassword
                  ? "隠す"
                  : "表示"}
              </button>
            </div>
          </label>

          {error && (
            <div className="formError">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primaryButton loginButton"
            disabled={loading}
          >
            {loading
              ? "ログイン中..."
              : "ログイン"}
          </button>
        </form>
      </section>
    </main>
  );
}
