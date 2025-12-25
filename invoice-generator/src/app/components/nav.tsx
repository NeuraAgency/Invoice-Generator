import Link from "next/link";
import React from "react";

interface NavProps {
  href1: string;
  name1: string;
  href2: string;
  name2: string;
}

const Nav: React.FC<NavProps> = ({ href1, name1, href2, name2 }) => {
  return (
    <div className="bg-[var(--accent)] inline-flex flex-wrap rounded-xl font-semibold text-white px-4 py-2 gap-3 text-sm">
      <Link href={href1}>{name1}</Link>
      <Link href={href2}>{name2}</Link>
    </div>
  );
};

export default Nav;
