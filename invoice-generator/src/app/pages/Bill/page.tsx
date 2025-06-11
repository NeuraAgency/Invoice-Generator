import Nav from "@/app/components/nav";
import React from "react";

const page = () => {
  return (
    <div className="flex w-full h-screen items-center ">
      <div className="flex flex-col w-full items-start h-full gap-12">
        <Nav
          href1="./generate"
          name1="Generate"
          href2="./inquery"
          name2="Inquery"
        />
        <div>
          <h2 className="font-bold">Enter Challan Number</h2>
          <input type="text" className="px-4 border-b-2 border-[#ff6c31]" />
        </div>
      </div>
    </div>
  );
};

export default page;
