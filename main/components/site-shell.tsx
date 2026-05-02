"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Portfolio queue and borrower detail",
  },
  {
    href: "/score-check",
    label: "Score Check",
    description: "POST /score simulation",
  },
];

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(248,245,239,1)_48%),linear-gradient(135deg,#faf7f0_0%,#f5f1e8_54%,#ece6db_100%)] text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -right-24 top-36 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-28 left-[30%] h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative min-h-screen">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-350 flex-col gap-4 px-5 py-4 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-linear-to-br from-slate-900 via-slate-700 to-amber-700 text-xs font-black tracking-[0.35em] text-white shadow-lg shadow-slate-900/10">
                  PIQ
                </div>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-slate-500">Poonawalla Fincorp</p>
                  <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">PlacementIQ</h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {navigation.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                        active
                          ? "border-amber-200 bg-amber-50 text-slate-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className={active ? "text-amber-600" : "text-slate-500"}>
                        {item.label === "Dashboard" ? "▦" : "◌"}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-slate-500">Current Monitoring Window</p>
                <p className="mt-1 text-sm text-slate-700">Moratorium exits in next 90 days, prioritize proactive outreach.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Live API-ready</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Responsive dashboard</span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto min-w-0 w-full max-w-350 px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
