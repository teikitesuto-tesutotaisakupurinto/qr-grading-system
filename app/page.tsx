import Link from "next/link";

const functions = [
  { name: "QRコード発行", href: "/qr" },
  { name: "答案アップロード", href: "/answers" },
  { name: "生徒一覧", href: "/students" },
  { name: "答案画像ダウンロード", href: "/answers/download" },
  { name: "テスト管理", href: "/tests" },
  { name: "採点管理", href: "/grading" },
  { name: "成績管理", href: "/results" },
  { name: "成績表", href: "/reports" },
  { name: "CSV管理", href: "/csv" },
  { name: "年度更新", href: "/year" },
  { name: "校舎・クラス管理", href: "/schools" },
  { name: "講師・権限管理", href: "/users" },
  { name: "設定", href: "/settings" }
];

export default function HomePage() {
  return (
    <main className="page">
      <header className="appHeader">
        <div className="appTitle">
          QR答案採点システム
        </div>

        <div className="schoolLogo">
          塾ロゴ
        </div>
      </header>

      <section className="functionSection">
        <h1>機能一覧</h1>

        <div className="functionGrid">
          {functions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="functionCard"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
