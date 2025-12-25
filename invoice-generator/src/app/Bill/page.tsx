'use client';
import React, { useState } from 'react';
import Generate from './components/generate';
import dynamic from 'next/dynamic';

const Preview = dynamic(() => import('./components/preview'), { ssr: false });

const BillPage = () => {
  const [rows, setRows] = useState(
    Array(7).fill(0).map(() => ({ qty: '', description: '', amount: '' }))
  );
  const [confirmedRows, setConfirmedRows] = useState(rows);
  const handleConfirm = () => setConfirmedRows([...rows]);

  return (
    <div className='flex flex-col lg:flex-row h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 pt-20 lg:pt-6 overflow-y-auto lg:overflow-hidden bg-black text-white'>
      <div className='w-full lg:w-[560px] xl:w-[620px] shrink-0'>
        <Generate rows={rows} setRows={setRows} onConfirm={handleConfirm} />
      </div>
      <div className='w-full lg:flex-1'>
        <Preview rows={confirmedRows} />
      </div>
    </div>
  );
};

export default BillPage;
