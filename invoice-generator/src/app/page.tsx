import Link from "next/link";
import { getSupabaseAdminClient } from "../lib/supabaseServer";

// quickActions removed — replaced by monthly totals graph

const timeline = [
  {
    title: "Invoice #INV-204 marked paid",
    meta: "Today • Finance Team",
    status: "Paid",
  },
  {
    title: "Quotation #Q-118 shared with client",
    meta: "Yesterday • Sales",
    status: "Sent",
  },
  {
    title: "Challan #CH-077 dispatched",
    meta: "Mon • Logistics",
    status: "In transit",
  },
  {
    title: "5 documents queued for extraction",
    meta: "Mon • Automation",
    status: "Processing",
  },
];

const page = async () => {
  const supabase = getSupabaseAdminClient();

  const [challansRes, invoicesRes] = await Promise.all([
    supabase.from("DeliveryChallan").select("challanno"),
    supabase.from("invoice")
      .select("challanno, created_at, Description")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const challans = challansRes.data ?? [];
  const invoices = invoicesRes.data ?? [];

  const challanCount = challans.length;
  const invoiceCount = invoices.length;

  const invoicedChallanSet = new Set<number>(
    invoices.map((i: any) => i.challanno).filter((c: any) => c != null)
  );

  const dueBillsCount = challans.filter((c: any) => !invoicedChallanSet.has(c.challanno)).length;

  const stats = [
    {
      label: "Invoices",
      value: String(invoiceCount),
      hint: `${dueBillsCount} due`,
      href: "/Bill",
    },
    {
      label: "Quotations",
      value: "12",
      hint: "2 awaiting approval",
      href: "/Quotation",
    },
    {
      label: "Delivery Challans",
      value: String(challanCount),
      hint: "",
      href: "/Challan",
    },
    {
      label: "Uploads",
      value: "132",
      hint: "OCR ready",
      href: "/Datacenter",
    },
  ];
  // Build monthly totals for invoices (last 12 months)
  const parseItems = (desc: any) => {
    if (!desc) return [];
    if (Array.isArray(desc)) return desc;
    return [desc];
  };

  const toNum = (v: any) => {
    if (!v) return 0;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const itemLineTotal = (d: any) => {
    const qty = toNum(d?.qty ?? d?.quantity);
    const amt = toNum(d?.amount);
    const rate = toNum(d?.rate);

    if (amt > 0) return amt;
    if (rate > 0) return qty * rate;
    return 0;
  };

  const monthsBack = 12;
  const monthKeys: string[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const totalsMap: Record<string, number> = {};
  monthKeys.forEach((k) => (totalsMap[k] = 0));

  for (const inv of invoices) {
    const created = inv?.created_at ? new Date(inv.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const items = parseItems(inv?.Description);
    const billTotal = items.reduce((s: number, it: any) => s + itemLineTotal(it), 0);
    if (key in totalsMap) totalsMap[key] += billTotal;
  }

  const chartLabels = monthKeys.map((k) => {
    const [y, m] = k.split("-");
    const mm = new Date(Number(y), Number(m) - 1).toLocaleString(undefined, { month: "short" });
    return `${mm}`;
  });
  const chartValues = monthKeys.map((k) => totalsMap[k] || 0);
  return (
    <main className="flex-1 min-h-screen bg-black text-white overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
            Invoice Generator
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight">
            ERP Billing & Accounts Receivable <span className="text-slate-500 font-medium text-xl lg:text-2xl ml-1">Module</span>
          </h1>
        </div>

        {/* Command Center Bar */}
        <div className="bg-[#ea580c] rounded-t-2xl px-6 py-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <button className="p-1 hover:bg-black/10 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <h2 className="text-lg font-bold text-white tracking-wide">Command Center</h2>
          </div>
          <div className="bg-black/20 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white">Live Data</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-[#0a0a0a]/50 border-x border-b border-white/5 rounded-b-2xl p-6 lg:p-8 space-y-10 shadow-2xl">
          {/* Stats Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group card-custom rounded-2xl p-6 ring-1 ring-white/10 hover:ring-orange-500/50 hover:bg-[#1e293b] transition-all duration-300 flex flex-col gap-4 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                  <span className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter bg-orange-500/10 rounded-md px-2 py-1 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                    View
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <p className="text-4xl font-bold text-white tracking-tighter transition-all duration-300 group-hover:scale-105 origin-left">{item.value}</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{item.hint}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Chart Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Monthly Bill Totals</h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last 12 months</span>
              </div>

              <div className="card-custom rounded-2xl p-6 ring-1 ring-white/10 shadow-inner overflow-hidden">
                <div className="w-full">
                  {(() => {
                    const maxVal = Math.max(...chartValues, 1);
                    const barW = 32;
                    const gap = 16;
                    const svgW = chartValues.length * (barW + gap) + 40;
                    const svgH = 220;
                    const chartH = svgH - 60;
                    return (
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-64">
                        <defs>
                          <linearGradient id="barGrad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#ea580c" />
                          </linearGradient>
                          <filter id="shadow-tooltip">
                            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.4" />
                          </filter>
                        </defs>
                        <style>{`
                          .bar-group .label { fill: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
                          .bar-group:hover .bar-rect { fill: #fb923c; }
                          .bar-group .tooltip { opacity: 0; pointer-events: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); filter: url(#shadow-tooltip); }
                          .bar-group:hover .tooltip { opacity: 1; }
                          .bar-group:hover .tooltip-content { transform: translateY(-8px); }
                          .tooltip-content { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                          .grid-line { stroke: #1e293b; stroke-width: 1; stroke-dasharray: 4 4; }
                        `}</style>
                        
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                          <line key={i} x1={0} y1={svgH - 40 - p * chartH} x2={svgW} y2={svgH - 40 - p * chartH} className="grid-line" />
                        ))}

                        {/* First pass: Render all bars */}
                        {chartValues.map((v, i) => {
                          const x = 20 + i * (barW + gap);
                          const h = (v / maxVal) * chartH;
                          const y = svgH - 40 - h;
                          return (
                            <rect key={`bar-${i}`} x={x} y={y} width={barW} height={h} rx={4} fill="url(#barGrad)" className="transition-all duration-300" />
                          );
                        })}

                        {/* Second pass: Render hover zones and tooltips on top */}
                        {chartValues.map((v, i) => {
                          const x = 20 + i * (barW + gap);
                          const h = (v / maxVal) * chartH;
                          const y = svgH - 40 - h;
                          return (
                            <g key={`hover-${i}`} className="bar-group">
                              {/* Invisible trigger area */}
                              <rect x={x - 4} y={0} width={barW + 8} height={svgH - 40} fill="transparent" cursor="pointer" />
                              
                              <rect x={x} y={y} width={barW} height={h} rx={4} fill="transparent" className="bar-rect transition-colors duration-200" />
                              
                              <text className="label" x={x + barW / 2} y={svgH - 15} textAnchor="middle">{chartLabels[i]}</text>
                              
                              {/* Tooltip with fixed coordinate transform */}
                              <g className="tooltip" transform={`translate(${x + barW / 2}, ${y + h / 2})`}>
                                <g className="tooltip-content">
                                  <rect x={-45} y={-14} width={90} height={28} rx={8} fill="#1e293b" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                                  <text x={0} y={5} fontSize={11} fill="#ffffff" fontWeight={800} textAnchor="middle">
                                    {v ? `Rs. ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "0"}
                                  </text>
                                </g>
                              </g>
                            </g>
                          );
                        })}
                        <line x1={0} y1={svgH - 40} x2={svgW} y2={svgH - 40} stroke="#475569" strokeWidth={1} />
                      </svg>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Sidebar Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Recent activity</h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live</span>
              </div>
              
              <div className="card-custom rounded-2xl shadow-xl ring-1 ring-white/10 divide-y divide-white/5">
                {timeline.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-4 px-6 py-5 group hover:bg-[#1e293b] transition-colors">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{item.title}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{item.meta}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status Card */}
              <div className="bg-gradient-to-br from-[#ea580c] to-[#9a3412] text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/70 font-bold">Snapshot</p>
                <div className="mt-4 space-y-1">
                  <p className="text-sm font-bold text-white/90 uppercase tracking-tight">On-time delivery</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black tracking-tighter transition-all group-hover:translate-x-1">96.4%</p>
                    <div className="h-2 w-2 rounded-full bg-green-400"></div>
                  </div>
                  <p className="text-[10px] text-white/60 font-medium leading-relaxed mt-2 uppercase tracking-wide">
                    Trending steady. Keep challans synced.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default page;
