import Link from "next/link";

/** One labelled row of KPI tiles (used by the TA and Admin overviews). */
export function KpiRow({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col lg:flex-row lg:items-stretch">
            <p className="lg:w-36 shrink-0 px-4 pt-3 lg:py-4 text-[12px] font-semibold text-neutral-700 lg:border-r lg:border-neutral-100 flex items-center">{title}</p>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">{children}</div>
        </div>
    );
}

/** Compact, clickable KPI tile. Tone colours the number only; the label always names it. */
export function Kpi({ label, value, hint, href, tone }: { label: string; value: string | number; hint?: string; href: string; tone?: "good" | "warn" | "bad" }) {
    const colour = tone === "bad" ? "text-danger" : tone === "warn" ? "text-warning" : "text-neutral-900";
    return (
        <Link href={href} className="group px-4 py-3 hover:bg-neutral-50 transition-colors min-w-0">
            <p className="text-[11px] font-semibold text-neutral-500 truncate">{label}</p>
            <p className={`text-[20px] font-semibold tabular-nums leading-tight mt-1 ${colour}`}>{value}</p>
            {hint && <p className="text-[10px] text-neutral-400 truncate group-hover:text-neutral-600">{hint}</p>}
        </Link>
    );
}

/** Sticky underlined tabs with optional counts, sitting under the top bar. */
export function OverviewTabs<T extends string>({ tabs, value, onChange }: {
    tabs: { id: T; label: string; count?: number; alert?: boolean }[]; value: T; onChange: (v: T) => void;
}) {
    return (
        <div className="sticky z-20 bg-background pt-1" style={{ top: "var(--topbar-height)" }}>
            <div role="tablist" className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-neutral-200">
                {tabs.map((t) => (
                    <button key={t.id} type="button" role="tab" onClick={() => onChange(t.id)} aria-selected={value === t.id}
                        className={`relative h-10 px-3 text-[13px] whitespace-nowrap flex items-center gap-1.5 transition-colors ${value === t.id ? "text-navy font-semibold" : "text-neutral-500 hover:text-neutral-800"}`}>
                        {t.label}
                        {t.count ? <span className={`min-w-5 h-5 px-1.5 rounded text-[11px] font-medium tabular-nums flex items-center justify-center ${t.alert ? "bg-danger-light text-red-700" : "bg-neutral-100 text-neutral-600"}`}>{t.count}</span> : null}
                        {value === t.id && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-accent" />}
                    </button>
                ))}
            </div>
        </div>
    );
}
