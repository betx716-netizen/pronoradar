import type { Lineup } from "@/lib/schemas";

// Nom court pour tenir dans le rond : « Kylian Mbappé » → « Mbappé ».
const short = (n: string) => {
  const parts = n.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : n;
};

function Player({ name, color, keeper }: { name: string; color: string; keeper?: boolean }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1 sm:w-20">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[11px] font-black text-white shadow-md sm:h-10 sm:w-10"
        style={{ background: keeper ? "#111827" : color }}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
      <span className="max-w-full truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white sm:text-[11px]" title={name}>
        {short(name)}
      </span>
    </div>
  );
}

/** Terrain vu de dessus : gardien en bas, attaque en haut, une rangée par ligne du système. */
export function Pitch({ lineup, color }: { lineup: Lineup; color: string }) {
  const rows = [...lineup.lines].reverse();
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-3"
      style={{ background: "repeating-linear-gradient(0deg, #15803d 0 44px, #16a34a 44px 88px)" }}
    >
      {/* Lignes du terrain */}
      <div className="pointer-events-none absolute inset-2 rounded-lg border-2 border-white/40" />
      <div className="pointer-events-none absolute inset-x-2 top-1/2 border-t-2 border-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 h-14 w-40 -translate-x-1/2 border-2 border-b-0 border-white/40" />
      <div className="pointer-events-none absolute left-1/2 top-2 h-14 w-40 -translate-x-1/2 border-2 border-t-0 border-white/40" />

      <div className="relative flex min-h-[26rem] flex-col justify-between gap-3 py-3">
        {rows.map((line, i) => (
          <div key={i} className="flex justify-around">
            {line.map((p, j) => (
              <Player key={`${p}-${j}`} name={p} color={color} />
            ))}
          </div>
        ))}
        <div className="flex justify-center">
          <Player name={lineup.goalkeeper} color={color} keeper />
        </div>
      </div>
    </div>
  );
}
