import React from 'react'
import Link from 'next/link'
import "./styles.css"

const Navbar = () => {
  return (
    <div className='min-w-[365px] h-screen bg-[#ff6c24] flex flex-col items-center roundborder '>
        <img src="/logo.png" alt="logo" className=''/>
        <div className="flex flex-col justify-center mt-10 font-bold text-white pl-8">
          <Link href='/Datacenter' className='focus:bg-black focus:text-[#ff6c31] py-6 px-12 roundborder2 '>Purchase Order and Gate Pass</Link>
          <Link href='/pages/Challan'className='focus:bg-black focus:text-[#ff6c31] py-6 px-12 roundborder2 ' >Generate Delivery Challan</Link>
          <Link href='/pages/Bill' className='focus:bg-black focus:text-[#ff6c31] py-6 px-12 roundborder2 '>Generate Invoices</Link>
          <Link href='/pages/Quotation' className='focus:bg-black focus:text-[#ff6c31] py-6 px-12 roundborder2 '>Generate Quotation</Link>
        </div>
    </div>
  )
}
 
export default Navbar