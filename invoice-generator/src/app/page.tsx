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
    supabase.from("invoice").select("challanno, created_at, Description"),
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

  const itemLineTotal = (d: any) => {
    const qty = Number(d?.qty ?? d?.quantity ?? 0) || 0;
    let rate = 0;
    if (d?.rate != null) rate = Number(d.rate) || 0;
    else if (d?.amount != null) {
      const a = Number(d.amount) || 0;
      rate = qty ? a / qty : a;
    }
    return qty * rate;
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
    <main className="flex-1 h-screen overflow-y-auto bg-black text-white pt-16 lg:pt-0">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-300 font-semibold">
            Invoice Generator
          </p>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl lg:text-4xl font-semibold text-white">
                Command Center
              </h1>
              <p className="text-slate-400 max-w-2xl">
                A clear snapshot of everything billing: quick links, live metrics, and the latest movements across invoices, quotations, and deliveries.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white/80 shadow-sm rounded-2xl px-4 py-3 border border-slate-200">
              <div className="h-10 w-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-semibold">
                •
              </div>
              <div>
                <p className="text-sm text-slate-400">Next action</p>
                <p className="text-sm font-semibold text-black">Finalize pending invoices today</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group card-custom border card-border rounded-2xl px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] hover:-translate-y-[2px] transition duration-200 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{item.label}</p>
                <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 rounded-full px-3 py-1">
                  View
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-semibold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-600">{item.hint}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Monthly Bill Totals</h2>
              <span className="text-sm font-semibold text-slate-400">Last 12 months</span>
            </div>

            <div className="card-custom border card-border rounded-2xl p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="w-full overflow-x-auto">
                {/* Server-rendered SVG chart */}
                {(() => {
                  const maxVal = Math.max(...chartValues, 1);
                  const barW = 40;
                  const gap = 12;
                  const svgW = chartValues.length * (barW + gap) + 40;
                  const svgH = 220;
                  const chartH = svgH - 40;
                  return (
                    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-56">
                      <defs>
                        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#fb923c" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                      </defs>
                      <style>{`
                        .bar text.value { opacity: 0; }
                        .bar .tooltip { opacity: 0; pointer-events: none; transition: opacity 0.12s ease, transform 0.12s ease; }
                        .bar:hover .tooltip { opacity: 1; pointer-events: auto; }
                        text.label { fill: #000; }
                        text.value { fill: #000; font-weight: 600; }
                      `}</style>
                      {/* bars */}
                      {chartValues.map((v, i) => {
                        const x = 20 + i * (barW + gap);
                        const h = (v / maxVal) * chartH;
                        const y = svgH - 30 - h;
                        return (
                          <g key={i} className="bar">
                            <rect x={x} y={y} width={barW} height={h} rx={6} fill="url(#grad)" opacity={0.95} />

                            {/* tooltip: hidden by default, shown on hover of parent .bar */}
                            {/* position tooltip at the center of the bar (horizontal center, vertical middle) */}
                            <g className="tooltip" transform={`translate(${x + barW / 2}, ${y + h / 2})`}>
                              {/* subtle drop shadow */}
                              <filter id={`f${i}`} x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.12" />
                              </filter>
                              <g filter={`url(#f${i})`}>
                                <rect x={-52} y={-20} width={107} height={36} rx={8} fill="#ffffff" stroke="#e5e7eb" />
                              </g>
                              <circle cx={-30} cy={0} r={6} fill="#16a34a" stroke="#0f766e" strokeWidth={0.5} />
                              <text x={-16} y={4} fontSize={12} fill="#000" fontWeight={600} textAnchor="start">{v ? v.toFixed(2) : "0.00"}</text>
                            </g>

                            <text className="value" x={x + barW / 2} y={y - 6} fontSize={11} textAnchor="middle">{v ? v.toFixed(0) : ""}</text>
                            <text className="label" x={x + barW / 2} y={svgH - 10} fontSize={12} textAnchor="middle">{chartLabels[i]}</text>
                          </g>
                        );
                      })}
                      {/* y-axis baseline */}
                      <line x1={10} y1={svgH - 30} x2={svgW - 10} y2={svgH - 30} stroke="#374151" strokeWidth={1} />
                    </svg>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent activity</h2>
              <span className="text-xs font-semibold text-slate-400">Updated live</span>
            </div>
            <div className="card-custom border card-border rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.05)] divide-y divide-slate-100">
              {timeline.map((item) => (
                <div key={item.title} className="flex items-start gap-3 px-5 py-4">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)]"></span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-600 mt-1">{item.meta}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 rounded-full px-3 py-1">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl">
              <p className="text-sm uppercase tracking-[0.18em] text-white/60 font-semibold">
                Snapshot
              </p>
              <p className="text-lg font-semibold mt-3">On-time delivery rate</p>
              <p className="text-3xl font-semibold mt-1">96.4%</p>
              <p className="text-sm text-white/70 mt-2">Trending steady week over week. Keep challans synced to avoid surprises.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default page;
