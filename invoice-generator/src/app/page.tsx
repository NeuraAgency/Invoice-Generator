import Link from "next/link";

const stats = [
  {
    label: "Invoices",
    value: "24",
    hint: "3 due today",
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
    value: "18",
    hint: "5 in transit",
    href: "/Challan",
  },
  {
    label: "Uploads",
    value: "132",
    hint: "OCR ready",
    href: "/Datacenter",
  },
];

const quickActions = [
  {
    title: "New Invoice",
    desc: "Create and send to client",
    href: "/Bill",
    tone: "from-orange-500 to-orange-600",
  },
  {
    title: "New Quotation",
    desc: "Draft and share pricing",
    href: "/Quotation",
    tone: "from-slate-800 to-slate-950",
  },
  {
    title: "Upload Documents",
    desc: "Process with OCR and extract",
    href: "/Datacenter",
    tone: "from-emerald-500 to-emerald-600",
  },
];

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

const page = () => {
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
              <h2 className="text-lg font-semibold text-white">Quick actions</h2>
              <Link href="/Datacenter" className="text-sm font-semibold text-[var(--accent)] hover:text-white">
                View all
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className={`rounded-2xl bg-gradient-to-br ${action.tone} text-white px-5 py-4 shadow-lg shadow-slate-900/10 hover:translate-y-[-2px] transition duration-200`}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide/relaxed opacity-80">
                    {action.title}
                  </p>
                  <p className="text-sm mt-1 opacity-90">{action.desc}</p>
                </Link>
              ))}
            </div>

            <div className="card-custom border card-border rounded-2xl p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-black">Upload & Extract</p>
                  <p className="text-sm text-slate-600">Drop files to extract line items, totals, and parties instantly.</p>
                </div>
                <Link
                  href="/Datacenter"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-white px-4 py-2 text-sm font-semibold shadow-sm hover:brightness-95"
                >
                  Go to uploads
                </Link>
              </div>
              <div className="mt-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-600">
                <p className="font-semibold text-black">Quick tip</p>
                <p>Use standardized file names (e.g., INV-204.pdf) to keep extraction logs tidy.</p>
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
