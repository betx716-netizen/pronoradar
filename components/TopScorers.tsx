"use client";

import type { AnalysisResult, MarketPick } from "@/lib/schemas";
import { useClubColors } from "@/lib/teamColors";
import { Icon } from "./Icon";
import { Jersey } from "./Pitch";
import { ScrollRow } from "./ScrollRow";

type Scorer = { r: AnalysisResult; p: MarketPick; player: string; team: string | null };

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Équipe du joueur, retrouvée dans les compositions de l'analyse quand elles existent.
function teamOf(r: AnalysisResult, player: string) {
  const l = r.analysis.lineups;
  if (!l) return null;
  const last = normalize(player).split(/\s+/).pop() ?? "";
  const has = (lu: typeof l.home) => [lu.goalkeeper, ...lu.lines.flat()].some((x) => normalize(x).includes(last));
  return has(l.home) ? r.analysis.match.home : has(l.away) ? r.analysis.match.away : null;
}

function ScorerCard({ s, rank, onOpen }: { s: Scorer; rank: number; onOpen: () => void }) {
  const colors = useClubColors(s.team);
  const shirt = colors?.shirt ?? "#334155";
  const detail = colors?.detail ?? "#ffffff";
  return (
    <button
      onClick={onOpen}
      className="relative w-40 shrink-0 snap-start overflow-hidden rounded-3xl p-3 text-left text-white shadow-lg transition active:scale-95"
      style={{ background: `linear-gradient(160deg, ${shirt}, #0f172a 85%)` }}
    >
      <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[0.6875rem] font-black text-[#0f172a]">#{rank}</span>
      <div className="flex justify-center pt-4 [&_svg]:h-20 [&_svg]:w-20">
        <Jersey shirt={shirt} detail={detail} number="" />
      </div>
      <p className="mt-1 line-clamp-2 min-h-[2.4rem] font-display text-xl uppercase leading-none">{s.player}</p>
      <p className="mt-1 truncate text-[0.6875rem] text-white/70">
        {s.r.analysis.match.home} – {s.r.analysis.match.away}
      </p>
      <div className="mt-2 rounded-xl bg-white/95 px-2 py-1.5 text-center text-[#0f172a]">
        <p className="text-[0.625rem] font-semibold uppercase text-[#5d6270]">{s.p.category === "buteur" ? "Buteur" : s.p.category === "passeur" ? "Passeur" : "Buteur ou passeur"}</p>
        <p className="font-display text-2xl leading-none">{s.p.odds.toFixed(2)}</p>
        <p className="text-[0.625rem] text-[#5d6270]">{Math.round(s.p.probability)} % selon l&apos;IA</p>
      </div>
    </button>
  );
}

// Compte gratuit : seuls les premiers buteurs sont visibles, les autres sont masqués (environ 70 %).
const FREE_SCORERS = 3;

function LockedCard({ rank, onUnlock }: { rank: number; onUnlock?: () => void }) {
  return (
    <button
      onClick={onUnlock}
      className="relative flex w-40 shrink-0 snap-start flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-[#334155] to-[#0f172a] p-3 text-center text-white shadow-lg transition active:scale-95"
    >
      <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[0.6875rem] font-black text-[#0f172a]">#{rank}</span>
      <Icon name="lock" className="mb-2 h-8 w-8 text-white/80" />
      <p className="font-display text-xl uppercase leading-none">Buteur masqué</p>
      <p className="mt-2 rounded-full bg-white px-3 py-1 text-[0.75rem] font-semibold text-[#0f172a]">Débloquer avec Premium</p>
    </button>
  );
}

/** Carrousel des buteurs (et passeurs) les plus probables d'après les analyses en cours. */
export function TopScorers({
  results,
  onOpen,
  locked = false,
  onUnlock,
}: {
  results: AnalysisResult[];
  onOpen: (r: AnalysisResult) => void;
  locked?: boolean;
  onUnlock?: () => void;
}) {
  const scorers: Scorer[] = results
    .flatMap((r) =>
      (r.picks ?? [])
        .filter((p) => p.category === "buteur" || p.category === "buteur_ou_passeur")
        .map((p) => {
          const player = p.selection.replace(/\s+(buteur|passeur).*$/i, "").trim();
          return { r, p, player, team: teamOf(r, player) };
        }),
    )
    .sort((a, b) => b.p.probability - a.p.probability)
    .filter((x, i, all) => all.findIndex((y) => normalize(y.player) === normalize(x.player)) === i)
    .slice(0, 10);

  if (scorers.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-3xl leading-none">Top des buteurs</h2>
      <ScrollRow className="-mx-4 snap-x snap-mandatory gap-3 px-4 pb-2 sm:mx-0 sm:px-12">
        {scorers.map((s, i) =>
          locked && i >= FREE_SCORERS ? (
            <LockedCard key={`locked-${i}`} rank={i + 1} onUnlock={onUnlock} />
          ) : (
            <ScorerCard key={s.player + s.p.category} s={s} rank={i + 1} onOpen={() => onOpen(s.r)} />
          ),
        )}
      </ScrollRow>
    </section>
  );
}
