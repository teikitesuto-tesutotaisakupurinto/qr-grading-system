type SchoolHeaderProps = {
  title?: string;
  logoText?: string;
};

export default function SchoolHeader({
  title = "QR答案採点システム",
  logoText = "塾ロゴ",
}: SchoolHeaderProps) {
  return (
    <header className="appHeader">
      <div className="appTitle">
        {title}
      </div>

      <div className="schoolLogo">
        {logoText}
      </div>
    </header>
  );
}
