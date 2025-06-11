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
    <div className="bg-[#ff6c24] flex rounded-2xl font-bold text-white px-8 py-4 gap-4">
      <Link href={href1}>{name1}</Link>
      <Link href={href2}>{name2}</Link>
    </div>
  );
};

export default Nav;
