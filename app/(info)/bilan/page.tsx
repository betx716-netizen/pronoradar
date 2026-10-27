import type { Metadata } from "next";
import { RECORD_START, loadRecord, recordStats, type CouponRecord, type RecordStatus } from "@/lib/record";

export const revalidate = 1800; // recalculé au plus toutes les 30 minutes

export const metadata: Metadata = {
  title: "Bilan public des coupons de l'IA",
  description: "Tous les coupons du jour publiés par l'IA de PronoRadar, gagnés comme perdus : taux de réussite réel, mis à jour chaque jour.",
  alternates: { canonical: "/bilan" },
};

const STATUS: Record<RecordStatus, { label: string; cls: string }> = {
  won: { label: "Gagné", cls: "bg-success text-white" },
  lost: { label: "Perdu", cls: "bg-danger text-white" },
  void: { label: "Remboursé", cls: "bg-draw text-white" },
  pending: { label: "En cours", cls: "bg-surface-3 text-text" },
  unverifiable: { label: "Non vérifiable", cls: "bg-surface-3 text-muted" },
};
const LEG_ICON = { won: "✓", lost: "✗", push: "↺", pending: "…", unknown: "?" } as const;

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export default async function RecordPage() {
  const records = await loadRecord().catch(() => [] as CouponRecord[]);
  const { list, total } = recordStats(records);
  const days = [...new Set(records.map((r) => r.day))];
  const settledWon = total.won + total.lost;

  return (
    <>
      <h1>Bilan public de l&apos;IA</h1>
      <p>
        Chaque coupon du jour publié par l&apos;IA est ici, <strong>gagné ou perdu</strong>. Rien n&apos;est effacé. Les résultats sont vérifiés
        automatiquement à partir des scores finaux. Bilan tenu depuis le {dayLabel(RECORD_START)}.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Coupons réglés", String(total.played)],
          ["Réussite", `${pct(total.won, settledWon)} %`],
          ["Gagnés", String(total.won)],
          ["Perdus", String(total.lost)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface p-4">
            <p className={`font-display text-3xl leading-none ${label === "Gagnés" ? "text-success" : label === "Perdus" ? "text-danger" : "text-text"}`}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      {list.length > 0 && (
        <>
          <h2>Par type de coupon</h2>
          <div className="overflow-hidden rounded-2xl bg-surface text-sm">
            <table className="w-full">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Coupon</th>
                  <th className="px-3 py-2 text-right">Gagnés</th>
                  <th className="px-3 py-2 text-right">Réussite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((s) => (
                  <tr key={s.profile}>
                    <td className="px-3 py-2 font-semibold">{s.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.won}/{s.played}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(s.won, s.won + s.lost)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs">Les grosses cotes perdent souvent : c&apos;est normal, ce sont des paris plaisir.</p>
        </>
      )}

      <h2>Jour par jour</h2>
      {days.length === 0 && <p>Le bilan démarre avec les coupons du jour publiés à partir du {dayLabel(RECORD_START)}.</p>}
      <div className="space-y-5">
        {days.map((day) => (
          <section key={day}>
            <p className="mb-2 text-sm font-semibold capitalize text-text">{dayLabel(day)}</p>
            <div className="space-y-2">
              {records
                .filter((r) => r.day === day)
                .map((r) => (
                  <details key={r.profile} className="rounded-2xl bg-surface p-3">
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <span className="min-w-0 flex-1 truncate font-semibold text-text">{r.title}</span>
                      <span className="font-display text-lg tabular-nums text-text">{Number(r.total_odds).toFixed(2)}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                    </summary>
                    <ul className="mt-2 divide-y divide-border text-sm" style={{ listStyle: "none", paddingLeft: 0 }}>
                      {r.legs.map((l, i) => (
                        <li key={i} className="flex items-center gap-2 py-1.5">
                          <span className={`w-4 text-center font-bold ${l.state === "won" ? "text-success" : l.state === "lost" ? "text-danger" : "text-muted"}`}>
                            {LEG_ICON[l.state]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-text">{l.selection}</span>
                            <span className="block truncate text-xs">
                              {l.match}
                              {l.score ? ` · ${l.score}` : ""}
                            </span>
                          </span>
                          <span className="tabular-nums">{l.odds.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
            </div>
          </section>
        ))}
      </div>

      <h2>Comment c&apos;est calculé</h2>
      <ul>
        <li>Seuls les coupons du jour préparés par l&apos;IA et publiés dans l&apos;application sont comptés, tous sans exception.</li>
        <li>Une seule sélection perdue fait perdre le coupon ; une sélection remboursée sort du calcul de la cote.</li>
        <li>
          « Non vérifiable » : le coupon contient un pari que le score seul ne permet pas de trancher (corners, cartons, buteur…). Ces coupons ne sont
          pas comptés dans la réussite.
        </li>
        <li>Les résultats passés ne garantissent pas les résultats futurs. Jouez de façon responsable.</li>
      </ul>
    </>
  );
}
