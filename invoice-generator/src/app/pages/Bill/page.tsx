import Nav from "@/app/components/nav";
import React from "react";

const page = () => {
  return (
    <div className="flex w-full h-screen items-center my-24 mx-10">
      <div className="flex flex-col w-full items-start h-full gap-12">
        <Nav
          href1="./generate"
          name1="Generate"
          href2="./inquery"
          name2="Inquery"
        />
        <div>
          <div>
          <h2 className="font-bold">Enter Challan Number</h2>
          <input
            type="text"
            className="my-4 w-44 text-xl font-bold border-b-2 border-[#ff6c31] focus:outline-none transition-colors"
          />
          </div>
          <table className="min-w-[624px] border border-black text-left rounded-xl overflow-hidden my-12">
            <thead className="bg-[#ff6c31] text-white ">
              <tr>
                <th className="px-4 py-2 border-b-4 border-r-4 border-black w-[20%]">
                  Qty
                </th>
                <th className="px-4 py-2 border-b-4 border-r-4 border-black w-[80%]">
                  Description
                </th>
                <th className="px-4 py-2 border-b-4 border-black">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, idx) => (
                <tr key={idx} className="bg-[#e9c6b1] border-b-4 border-black">
                  <td className="px-4 py-4 border-r-4 border-black"></td>
                  <td className="px-4 py-4 border-r-4 border-black"></td>
                  <td className="px-4 py-4"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default page;
