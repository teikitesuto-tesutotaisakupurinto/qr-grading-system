import Link from "next/link";

export type FunctionMenuItem = {
  name: string;
  href: string;
};

type FunctionMenuProps = {
  items: FunctionMenuItem[];
};

export default function FunctionMenu({
  items,
}: FunctionMenuProps) {
  return (
    <div className="functionGrid">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="functionCard"
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
}
