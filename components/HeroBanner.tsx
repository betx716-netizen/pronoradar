/** Bannière d'accueil : l'essentiel du jour en trois chiffres. */
export function HeroBanner({ matches, analyses, values, loading }: { matches: number; analyses: number; values: number; loading: boolean }) {
  const stats = [
    { label: "Matchs aujourd'hui", value: loading && !matches ? "…" : matches },
    { label: "Analyses récentes", value: analyses },
    { label: "Value bets repérés", value: values },
  ];
  return (
    <section className="fade-in relative mb-6 overflow-hidden rounded-3xl border border-white/5 bg-[#121216] p-5 text-white sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rotate-12 rounded-[3rem] bg-accent/90" />
      <div className="pointer-events-none absolute -right-6 top-20 h-20 w-20 rotate-12 rounded-3xl bg-accent/40" />
      <div className="relative max-w-[68%]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">Aujourd&apos;hui</p>
        <p className="mt-1 font-display text-[2rem] leading-[0.95] sm:text-5xl">
          Les cotes, les avis,
          <br />
          <span className="text-accent">l&apos;analyse IA.</span>
        </p>
        <p className="mt-2 text-sm text-white/70">Choisissez vos matchs, l&apos;IA compare les pronostics et vous dit où se trouve la valeur.</p>
      </div>
      <dl className="relative mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <dd className="font-display text-3xl leading-none tabular-nums">{s.value}</dd>
            <dt className="mt-1 text-[11px] leading-tight text-white/70">{s.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
