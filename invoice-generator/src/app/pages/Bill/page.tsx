import Generate from "./components/generate";
import Preview from "./components/preview";
import React from "react";

const page = () => {
  return (
    <div className="flex w-full h-screen items-center mx-14 gap-24">
      <Generate />
      <Preview />
      
    </div>
  );
};

export default page;
