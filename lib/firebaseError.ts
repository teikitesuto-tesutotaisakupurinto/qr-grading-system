export function getFirebaseErrorMessage(
  error: unknown
): string {
  const firebaseError =
    error as {
      code?: string;
      message?: string;
    };

  const code =
    firebaseError?.code ?? "";

  switch (code) {
    case "permission-denied":
      return "この操作を行う権限がありません。";

    case "auth/permission-denied":
      return "この操作を行う権限がありません。";

    case "failed-precondition":
      return "現在この操作を実行できません。設定を確認してください。";

    case "not-found":
      return "指定されたデータが見つかりません。";

    case "already-exists":
      return "同じデータがすでに登録されています。";

    case "unauthenticated":
      return "ログイン状態を確認できません。もう一度ログインしてください。";

    case "unavailable":
      return "サーバーに接続できませんでした。しばらくしてからもう一度お試しください。";

    case "deadline-exceeded":
      return "処理に時間がかかりすぎています。もう一度お試しください。";

    case "resource-exhausted":
      return "現在アクセスが集中しています。しばらくしてからお試しください。";

    case "auth/unauthorized-domain":
      return "このサイトは認証用ドメインとして登録されていません。管理者に確認してください。";

    case "auth/invalid-api-key":
      return "認証設定に問題があります。管理者に確認してください。";

    case "auth/argument-error":
    case "auth/invalid-argument":
      return "認証設定に問題があります。管理者に確認してください。";

    default:
      return "処理に失敗しました。もう一度お試しください。";
  }
}
