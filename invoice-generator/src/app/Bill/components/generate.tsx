"use client";
import Nav from "@/app/components/nav";
import React, { useEffect, useState } from "react";

export interface RowData { qty: string; description: string; rate?: string; amount?: string; }
interface GenerateProps { rows: RowData[]; setRows: React.Dispatch<React.SetStateAction<RowData[]>>; onConfirm: () => void; }

const Generate: React.FC<GenerateProps> = ({ rows, setRows, onConfirm }) => {
  const [challanQuery, setChallanQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [billNumber, setBillNumber] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w[0].toUpperCase())
      .join('');
  };

  const generateBillNo = (name: string, lastNumericPart: number) => {
    if (!name) return "";
    const initials = getInitials(name);
    return initials ? `${initials}-${String(lastNumericPart + 1).padStart(4, '0')}` : "";
  };

  useEffect(() => {
    if (!companyName) return;
    const initials = getInitials(companyName);
    if (!initials) return;

    // Fetch latest invoice to find the last numeric part for this company
    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/invoice?limit=100');
        if (res.ok) {
          const data = await res.json();
          const companyInvoices = data.filter((inv: any) => 
            inv.DeliveryChallan?.Industry === companyName || 
            (inv.billno && String(inv.billno).startsWith(initials))
          );
          
          let maxNum = 0;
          companyInvoices.forEach((inv: any) => {
            const numPart = String(inv.billno).split('-')[1] || String(inv.billno).match(/\d+$/)?.[0];
            if (numPart) {
              const n = parseInt(numPart);
              if (!isNaN(n)) maxNum = Math.max(maxNum, n);
            }
          });
          
          setBillNumber(generateBillNo(companyName, maxNum));
        }
      } catch (err) {
        console.error("Failed to fetch latest bill number", err);
      }
    };
    fetchLatest();
  }, [companyName]);

  const handleRowChange = (idx: number, field: keyof RowData, value: string) => {
    setRows(prev => {
      const next = [...prev];
      const updated = { ...next[idx], [field]: value } as RowData;

      // Keep `amount` as the per-piece rate for preview (preview multiplies qty * amount).
      // `rate` is the editable field; when rate changes, reflect it into `amount` for preview display.
      if (field === 'rate') {
        updated.amount = value;
      }

      next[idx] = updated;
      return next;
    });
  };
  const handleDelete = (idx: number) => { setRows(rows.filter((_, i) => i !== idx)); onConfirm(); };

  const handleGenerate = async () => {
    try {
      const challanNoNumeric = Number(challanQuery.replace(/\D/g, ''));
      if (!challanNoNumeric) return;
      const payload = { 
        challanno: challanNoNumeric, 
        billno: billNumber,
        lines: rows.map(r => {
          const q = Number(String(r.qty ?? '').replace(/,/g, '')) || 0;
          const rate = Number(String(r.rate ?? '').replace(/,/g, '')) || 0;
          const total = Math.round((q * rate + Number.EPSILON) * 100) / 100;
          return { qty: r.qty, description: r.description, rate: r.rate ?? '', amount: String(total.toFixed(2)) };
        })
      };
      const res = await fetch('/api/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { 
        const errData = await res.json().catch(()=>({}));
        console.error('Invoice save failed', errData); 
        alert(`Error: ${errData.error || 'Failed to save invoice'}`);
        return; 
      }
      const body = await res.json(); 
      const billStr = body?.bill; 
      if (billStr) { 
        try { 
          localStorage.setItem('latestBill', String(billStr)); 
          setBillNumber(billStr);
        } catch {} 
      }
      setSuccessMsg(`Invoice ${billStr || ''} generated and saved successfully!`);
      setTimeout(() => setSuccessMsg(null), 5000);
      onConfirm();
    } catch (e) { 
      console.error(e); 
      alert('An unexpected error occurred');
    }
  };

  useEffect(() => {
    if (!challanQuery) { setSuggestions([]); return; }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try { setLoading(true); const res = await fetch(`/api/challan?challan=${encodeURIComponent(challanQuery)}&limit=10&exact=1`, { signal: controller.signal }); if (!res.ok) throw new Error('Failed'); const data = await res.json(); setSuggestions(Array.isArray(data) ? data : []); setShowSuggestions(true); }
      catch (e:any) { if (e?.name !== 'AbortError') setSuggestions([]); }
      finally { setLoading(false); }
    }, 250);
    return () => { controller.abort(); clearTimeout(id); };
  }, [challanQuery]);

  useEffect(()=>{
    try{ const stored = localStorage.getItem('invoiceCompanyName'); if(stored) setCompanyName(stored); const storedBill = localStorage.getItem('latestBill'); if(storedBill) setBillNumber(storedBill);}catch{}
  },[]);

  const handleSelectChallan = (item: any) => {
    const challanNo = item?.challanno ?? item?.challan ?? '';
    const challanStr = String(challanNo); setChallanQuery(challanStr); setShowSuggestions(false);
    
    // Propagate company name and generate bill no if industry exists
    const industry = item?.Industry ?? item?.industry ?? item?.Industry_Name ?? '';
    if (industry) {
      setCompanyName(industry);
      try { localStorage.setItem('invoiceCompanyName', industry); } catch {}
    }

    try {
      const padded = challanStr && /\d/.test(challanStr) ? String(Number(challanStr)).padStart(5,'0') : challanStr;
      localStorage.setItem('latestInvoiceChallan', padded);
      if (item?.GP) localStorage.setItem('latestInvoiceGP', String(item.GP));
      if (item?.PO ?? item?.po) localStorage.setItem('latestInvoicePO', String(item?.PO ?? item?.po));
    } catch {}
    const desc = item?.Description ?? item?.description ?? [];
    let mapped: RowData[] = [];
    if (Array.isArray(desc)) mapped = desc.map((d:any) => {
      if (typeof d === 'string') return { qty: '', description: d, rate: '', amount: '' };
      const qty = String(d?.qty ?? d?.quantity ?? '');
      const rawRate = d?.rate ?? '';
      const rawAmount = d?.amount ?? '';
      // Prefer explicit rate; otherwise derive per-piece rate from amount/qty when possible
      let perPieceRate = '';
      const qn = Number(qty);
      const rn = Number(String(rawRate ?? ''));
      const an = Number(String(rawAmount ?? ''));
      if (!Number.isNaN(rn) && rn) perPieceRate = String((Math.round((rn + Number.EPSILON) * 100) / 100).toFixed(2));
      else if (!Number.isNaN(qn) && qn && !Number.isNaN(an)) perPieceRate = String((Math.round((an / qn + Number.EPSILON) * 100) / 100).toFixed(2));
      return { qty, description: String(d?.description ?? d?.materialDescription ?? ''), rate: perPieceRate, amount: perPieceRate };
    });
    else if (desc) {
      const qty = String((desc as any)?.qty ?? (desc as any)?.quantity ?? '');
      const rawRate = (desc as any)?.rate ?? '';
      const rawAmount = (desc as any)?.amount ?? '';
      const qn = Number(qty);
      const rn = Number(String(rawRate ?? ''));
      const an = Number(String(rawAmount ?? ''));
      let perPieceRate = '';
      if (!Number.isNaN(rn) && rn) perPieceRate = String((Math.round((rn + Number.EPSILON) * 100) / 100).toFixed(2));
      else if (!Number.isNaN(qn) && qn && !Number.isNaN(an)) perPieceRate = String((Math.round((an / qn + Number.EPSILON) * 100) / 100).toFixed(2));
      mapped = [{ qty, description: String((desc as any)?.description ?? ''), rate: perPieceRate, amount: perPieceRate }];
    }
    if (mapped.length === 0) mapped = rows; setRows(mapped); onConfirm();
  };

  return (
    <div className='flex flex-col items-start px-4 sm:px-6 py-4 w-full relative'>
      {successMsg && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-green-400/30 backdrop-blur-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
        </div>
      )}
      <Nav href1='/Bill' name1='Generate' href2='/Bill/inquery' name2='Inquery' />
      <div className='w-full mt-8 space-y-4 sm:space-y-6'>
        {/* Company Name - Full width on all sizes */}
        <div className='w-full'>
          <h2 className='font-semibold text-xs text-white'>Company Name</h2>
          <input
            value={companyName}
            onChange={e => {
              const newName = e.target.value;
              setCompanyName(newName);
              try {
                localStorage.setItem('invoiceCompanyName', newName);
              } catch {}
            }}
            className='mt-1 w-full sm:max-w-md text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white'
            placeholder="Enter Company Name"
          />
        </div>

        {/* Input Grid: Bill No and Challan Number */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-8 w-full'>
          {/* BILL NUMBER */}
          <div className='w-full'>
            <div className='bg-white/5 border-[1px] border-white/10 rounded-md p-3 w-full h-20 flex flex-col justify-start transition-all duration-150 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] focus-within:ring-opacity-20 focus-within:shadow-[0_6px_18px_rgba(255,165,0,0.12)]'>
              <h2 className='font-semibold text-xs text-white'>Bill No</h2>
              <input
                value={billNumber}
                onChange={e=>{ setBillNumber(e.target.value); try{ localStorage.setItem('latestBill', e.target.value);}catch{} }}
                className='my-2 w-full text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white'
                placeholder="Enter Bill No"
              />
            </div>
          </div>

          {/* CHALLAN NUMBER SEARCH */}
          <div className='relative w-full'>
            <div className='bg-white/5 border-[1px] border-white/10 rounded-md p-3 w-full h-20 flex flex-col justify-start transition-all duration-150 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] focus-within:ring-opacity-20 focus-within:shadow-[0_6px_18px_rgba(255,165,0,0.12)]'>
              <h2 className='font-semibold text-xs text-white'>Enter Challan Number</h2>
              <input
                type='text'
                value={challanQuery}
                onChange={e=>setChallanQuery(e.target.value)}
                onFocus={()=>challanQuery && setShowSuggestions(true)}
                className='my-2 w-full text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/50'
                placeholder='Search Challan'
              />
            </div>
            {showSuggestions && (
              <div className='absolute left-0 z-10 mt-1 w-full max-h-60 overflow-auto bg-white text-black rounded-md shadow border border-gray-200'>
                {loading ? (
                  <div className='px-3 py-2 text-xs text-gray-500'>Searching…</div>
                ) : suggestions.length === 0 ? (
                  <div className='px-3 py-2 text-xs text-gray-500'>No results</div>
                ) : (
                  <ul className='divide-y divide-gray-200'>
                    {suggestions.map((s:any,i:number)=>(
                      <li key={i}>
                        <button type='button' onMouseDown={e=>e.preventDefault()} onClick={()=>handleSelectChallan(s)} className='w-full text-left px-3 py-2 hover:bg-gray-100'>
                          <div className='text-xs font-medium'>Challan No: {String(s?.challanno ?? '-')}</div>
                          {s?.GP && <div className='text-[11px] text-gray-600'>GP: {String(s.GP)}</div>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className='w-full overflow-x-auto mt-8 lg:overflow-x-visible'>
          {/* MAIN EDITABLE TABLE */}
          <table className='generate w-full min-w-[500px] lg:min-w-0 border border-black text-left rounded-xl overflow-hidden text-xs'>
            <thead className='bg-[var(--accent)] text-white text-[11px] uppercase'>
              <tr>
                <th className='px-2.5 py-1 border-b-2 border-r-2 border-black w-[15%]'>Qty</th>
                <th className='px-2.5 py-1 border-b-2 border-r-2 border-black w-[55%]'>Description</th>
                <th className='px-2.5 py-1 border-b-2 border-r-2 border-black w-[20%]'>Rate</th>
                <th className='px-2.5 py-1 border-b-2 border-black text-center w-[10%]'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,idx)=>(
                <tr key={idx} className='bg-[#e9c6b1] text-black border-b-2 border-black h-6'>
                  <td className='px-2.5 py-1 border-r-2 border-black'>
                    <input type='text' value={row.qty} onChange={e=>handleRowChange(idx, 'qty', e.target.value)} className='w-full text-xs outline-none bg-transparent text-center' />
                  </td>
                  <td className='px-2.5 py-1 border-r-2 border-black'>
                    <input type='text' value={row.description} onChange={e=>handleRowChange(idx, 'description', e.target.value)} className='w-full text-xs outline-none bg-transparent' />
                  </td>
                  <td className='px-2.5 py-1 border-r-2 border-black'>
                    <input type='text' value={row.rate} onChange={e=>handleRowChange(idx, 'rate', e.target.value)} className='w-full text-xs outline-none bg-transparent' />
                  </td>
                  <td className='px-2 py-1 flex justify-center gap-2'>
                    <button onClick={()=>handleDelete(idx)}>
                      <img src='/delete.png' alt='Delete' className='w-5 h-5' />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className='mt-6 w-full'>
        <div className='flex flex-wrap gap-3'>
          <button className='flex-1 sm:flex-none bg-[var(--accent)] py-2 px-4 rounded-lg text-xs font-medium text-white hover:opacity-90 transition' onClick={onConfirm}>Update Preview</button>
          <button className='flex-1 sm:flex-none bg-[var(--accent)] py-2 px-5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition' onClick={handleGenerate}>Generate</button>
        </div>
      </div>
    </div>
  );
};
export default Generate;
