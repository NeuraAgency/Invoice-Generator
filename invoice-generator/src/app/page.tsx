import Link from "next/link";
import { getSupabaseAdminClient } from "../lib/supabaseServer";

// quickActions removed — replaced by monthly totals graph
// timeline will be built dynamically from database data

const page = async () => {
  const supabase = getSupabaseAdminClient();

  const [challansRes, invoicesRes, whatsappRes, contactsRes] = await Promise.all([
    supabase.from("DeliveryChallan").select("challanno"),
    supabase.from("invoice")
      .select("challanno, created_at, Description, DeliveryChallan(Industry)")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("whatsapp_messages")
      .select("id, message, created_at, contactId, event, status")
      .or("status.eq.false,status.is.null")  // Fetch unread (false) or null messages
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("contacts")
      .select("contactId, company_name, User_name")
  ]);

  const challans = challansRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const whatsappMessages = whatsappRes.data ?? [];
  const contacts = contactsRes.data ?? [];

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

  // Build monthly totals for invoices by company/industry (last 12 months)
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

  const getIndustry = (inv: any) => {
    const embedded = inv?.DeliveryChallan;
    const industry = Array.isArray(embedded) ? embedded?.[0]?.Industry : embedded?.Industry;
    const name = industry != null ? String(industry).trim() : "";
    return name || "Unknown";
  };

  const monthIndustryTotals: Record<string, Record<string, number>> = {};
  monthKeys.forEach((k) => (monthIndustryTotals[k] = {}));

  for (const inv of invoices) {
    const created = inv?.created_at ? new Date(inv.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    if (!(key in monthIndustryTotals)) continue;

    const items = parseItems(inv?.Description);
    const billTotal = items.reduce((s: number, it: any) => s + itemLineTotal(it), 0);
    if (billTotal <= 0) continue;

    const industry = getIndustry(inv);
    monthIndustryTotals[key][industry] = (monthIndustryTotals[key][industry] || 0) + billTotal;
  }

  const industryTotals: Record<string, number> = {};
  for (const k of monthKeys) {
    const per = monthIndustryTotals[k] || {};
    for (const [industry, val] of Object.entries(per)) {
      industryTotals[industry] = (industryTotals[industry] || 0) + (val || 0);
    }
  }

  const sortedIndustries = Object.entries(industryTotals)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .map(([name]) => name);

  const MAX_SERIES = 5;
  const topIndustries = sortedIndustries.slice(0, MAX_SERIES);
  const hasOther = sortedIndustries.length > MAX_SERIES;
  const series = hasOther ? [...topIndustries, "Other"] : topIndustries;

  const stackedValuesByMonth = monthKeys.map((k) => {
    const per = monthIndustryTotals[k] || {};
    const picked: Record<string, number> = {};
    let otherSum = 0;
    for (const [industry, val] of Object.entries(per)) {
      if (topIndustries.includes(industry)) {
        picked[industry] = (picked[industry] || 0) + (val || 0);
      } else {
        otherSum += val || 0;
      }
    }
    if (hasOther) picked.Other = otherSum;
    return picked;
  });

  const chartLabels = monthKeys.map((k) => {
    const [y, m] = k.split("-");
    const mm = new Date(Number(y), Number(m) - 1).toLocaleString(undefined, { month: "short" });
    return `${mm}`;
  });
  const chartValues = stackedValuesByMonth.map((per) => Object.values(per || {}).reduce((s, v) => s + (v || 0), 0));

  const palette = [
    ["#f97316", "#ea580c"], // orange
    ["#22d3ee", "#0891b2"], // cyan
    ["#a78bfa", "#7c3aed"], // violet
    ["#34d399", "#059669"], // green
    ["#fb7185", "#e11d48"], // rose
    ["#60a5fa", "#2563eb"], // blue
    ["#facc15", "#eab308"], // yellow
  ];

  const seriesGradId = (idx: number) => `barGrad-${idx}`;
  const fmtRs = (v: number) => `Rs. ${Math.round(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // Build dynamic timeline with WhatsApp messages
  const contactMap = new Map(contacts.map(c => [c.contactId, c]));
  
  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "Recently";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const whatsappActivities = whatsappMessages.slice(0, 5).map(msg => {
    const contact = msg.contactId ? contactMap.get(msg.contactId) : null;
    const companyName = contact?.company_name || contact?.User_name || "Unknown Contact";
    const messagePreview = msg.message ? 
      (msg.message.length > 30 ? msg.message.substring(0, 30) + "..." : msg.message) : 
      "New message";
    
    return {
      title: `WhatsApp from ${companyName}`,
      meta: `${getRelativeTime(msg.created_at)} • WhatsApp`,
      status: "New",
      timestamp: msg.created_at ? new Date(msg.created_at).getTime() : 0,
      type: "whatsapp" as const,
      href: "/WhatsApp"
    };
  });

  const staticActivities = [
    {
      title: "Invoice #INV-204 marked paid",
      meta: "Today • Finance Team",
      status: "Paid",
      timestamp: Date.now() - 3600000, // 1 hour ago
      type: "invoice" as const,
      href: "/Bill"
    },
    {
      title: "Quotation #Q-118 shared with client",
      meta: "Yesterday • Sales",
      status: "Sent",
      timestamp: Date.now() - 86400000, // 1 day ago
      type: "quotation" as const,
      href: "/Quotation"
    },
  ];

  const timeline = [...whatsappActivities, ...staticActivities]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4);
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
                {series.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    {series.map((name, idx) => {
                      const [c1] = palette[idx % palette.length];
                      return (
                        <div key={name} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c1 }} />
                          <span className="max-w-[180px] truncate" title={name}>{name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="w-full">
                  {(() => {
                    const maxVal = Math.max(...chartValues, 1);
                    const barW = 32;
                    const gap = 16;
                    const svgW = chartValues.length * (barW + gap) + 40;
                    const svgH = 320; // Increased height significantly for tooltips
                    const chartH = 180;
                    const baselineY = svgH - 40;

                    // Prepare line points for each industry
                    const lineSeries = series.map((name, sIdx) => {
                      return chartLabels.map((_, i) => {
                        const val = (stackedValuesByMonth[i] || {})[name] || 0;
                        return {
                          x: 20 + i * (barW + gap) + barW / 2,
                          y: baselineY - (val / maxVal) * chartH,
                          val
                        };
                      });
                    });

                    // Helper for smooth SVG path - improved for better aesthetic
                    const getPath = (pts: {x: number, y: number}[]) => {
                      if (pts.length < 2) return "";
                      let d = `M ${pts[0].x},${pts[0].y}`;
                      for (let i = 0; i < pts.length - 1; i++) {
                        const curr = pts[i];
                        const next = pts[i + 1];
                        const cpx = (curr.x + next.x) / 2;
                        d += ` C ${cpx},${curr.y} ${cpx},${next.y} ${next.x},${next.y}`;
                      }
                      return d;
                    };

                    return (
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[320px] overflow-visible">
                        <defs>
                          {series.map((_, idx) => {
                            const [c1, c2] = palette[idx % palette.length];
                            return (
                              <g key={idx}>
                                <linearGradient id={seriesGradId(idx)} x1="0" x2="0" y1="0" y2="1">
                                  <stop offset="0%" stopColor={c1} />
                                  <stop offset="100%" stopColor={c2} />
                                </linearGradient>
                                <filter id={`glow-${idx}`}>
                                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                  <feMerge>
                                      <feMergeNode in="coloredBlur"/>
                                      <feMergeNode in="SourceGraphic"/>
                                  </feMerge>
                                </filter>
                              </g>
                            );
                          })}
                          <linearGradient id="totalBarGrad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#1e293b" />
                            <stop offset="100%" stopColor="#020617" />
                          </linearGradient>
                          <filter id="shadow-tooltip">
                            <feDropShadow dx="0" dy="10" stdDeviation="15" floodColor="#000" floodOpacity="0.5" />
                          </filter>
                        </defs>
                        <style>{`
                          .bar-group .label { fill: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; }
                          .bar-group:hover .bar-rect { fill: #334155; fill-opacity: 0.8; }
                          .bar-group .tooltip { opacity: 0; pointer-events: none; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); filter: url(#shadow-tooltip); }
                          .bar-group:hover .tooltip { opacity: 1; }
                          .bar-group:hover .tooltip-content { transform: translateY(-10px); }
                          .tooltip-content { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
                          .grid-line { stroke: #1e293b; stroke-width: 1; stroke-dasharray: 4 4; }
                          .industry-line { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; transition: all 0.4s ease; }
                          .industry-point { transition: all 0.3s ease; }
                          .bar-group:hover .industry-point { r: 6; stroke-width: 4; }
                        `}</style>
                        
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                          <line key={i} x1={0} y1={baselineY - p * chartH} x2={svgW} y2={baselineY - p * chartH} className="grid-line" />
                        ))}

                        {/* Total Bars Background */}
                        {chartValues.map((v, i) => {
                          const x = 20 + i * (barW + gap);
                          const h = (v / maxVal) * chartH;
                          const y = baselineY - h;
                          return (
                            <rect 
                              key={`total-bar-${i}`} 
                              x={x} 
                              y={y} 
                              width={barW} 
                              height={h} 
                              rx={6} 
                              fill="url(#totalBarGrad)" 
                              className="bar-rect transition-all duration-300"
                              fillOpacity={0.4}
                            />
                          );
                        })}

                        {/* Industry Lines with Curves and Glow */}
                        {lineSeries.map((points, sIdx) => {
                          const [c1] = palette[sIdx % palette.length];
                          const d = getPath(points);
                          return (
                            <g key={`series-line-${sIdx}`}>
                              <path 
                                d={d} 
                                stroke={c1} 
                                className="industry-line" 
                                opacity={0.8} 
                                filter={`url(#glow-${sIdx})`}
                              />
                              {points.map((p, i) => (
                                p.val > 0 && (
                                  <circle 
                                    key={`p-${sIdx}-${i}`} 
                                    cx={p.x} 
                                    cy={p.y} 
                                    r={3.5} 
                                    fill="#020617" 
                                    stroke={c1} 
                                    strokeWidth={2.5} 
                                    className="industry-point"
                                  />
                                )
                              ))}
                            </g>
                          );
                        })}

                        {/* Interactive layers (Tooltips and labels) */}
                        {chartValues.map((v, i) => {
                          const x = 20 + i * (barW + gap);
                          const h = (v / maxVal) * chartH;
                          const y = baselineY - h;

                          const per = stackedValuesByMonth[i] || {};
                          const orderedSeries = series
                            .map((name, idx) => ({ name, idx, value: per[name] || 0 }))
                            .filter((s) => s.value > 0);

                          const tooltipWidth = 220;
                          const tooltipLineH = 18;
                          const tooltipHeaderH = 30;
                          const tooltipPadY = 15;
                          const tooltipH = tooltipHeaderH + orderedSeries.length * tooltipLineH + tooltipPadY;
                          
                          // Position tooltip above the highest point in this column
                          // We use the top of the bar or a fixed offset if too high
                          const tooltipY = Math.max(y - 20, 10 + tooltipH);

                          return (
                            <g key={`hover-${i}`} className="bar-group">
                              {/* Invisible trigger area */}
                              <rect x={x - 4} y={0} width={barW + 8} height={baselineY} fill="transparent" cursor="pointer" />
                              
                              <text className="label" x={x + barW / 2} y={baselineY + 25} textAnchor="middle">{chartLabels[i]}</text>
                              
                              <g className="tooltip" transform={`translate(${x + barW / 2}, ${tooltipY})`}>
                                <g className="tooltip-content">
                                  <rect x={-tooltipWidth / 2} y={-tooltipH} width={tooltipWidth} height={tooltipH} rx={14} fill="rgba(15, 23, 42, 0.98)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" style={{ backdropFilter: 'blur(12px)' }} />

                                  <text x={0} y={-tooltipH + 22} fontSize={12} fill="#ffffff" fontWeight={900} textAnchor="middle">
                                    Total: {v ? fmtRs(v) : "Rs. 0"}
                                  </text>

                                  <line x1={-tooltipWidth / 2 + 15} y1={-tooltipH + 32} x2={tooltipWidth / 2 - 15} y2={-tooltipH + 32} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

                                  {orderedSeries.map((seg, idx) => {
                                    const [c1] = palette[seg.idx % palette.length];
                                    const rowY = -tooltipH + tooltipHeaderH + idx * tooltipLineH + 15;
                                    const label = seg.name.length > 15 ? `${seg.name.slice(0, 15)}…` : seg.name;
                                    return (
                                      <g key={seg.name} transform={`translate(0, ${rowY})`}>
                                        <circle cx={-tooltipWidth / 2 + 18} cy={-5} r={4.5} fill={c1} />
                                        <text x={-tooltipWidth / 2 + 30} y={0} fontSize={11} fill="#94a3b8" fontWeight={700} textAnchor="start">
                                          {label}
                                        </text>
                                        <text x={tooltipWidth / 2 - 18} y={0} fontSize={11} fill="#ffffff" fontWeight={900} textAnchor="end">
                                          {fmtRs(seg.value)}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </g>
                              </g>
                            </g>
                          );
                        })}
                        <line x1={0} y1={baselineY} x2={svgW} y2={baselineY} stroke="#334155" strokeWidth={2} />
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
                  <Link 
                    key={idx} 
                    href={item.href || "#"}
                    className="flex items-start gap-4 px-6 py-5 group hover:bg-[#1e293b] transition-colors cursor-pointer"
                  >
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{item.title}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{item.meta}</p>
                    </div>
                  </Link>
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
