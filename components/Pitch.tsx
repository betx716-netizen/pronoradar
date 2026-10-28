"use client";

import type { Lineup } from "@/lib/schemas";
import { useClubColors } from "@/lib/teamColors";

// « 10 Ousmane Dembélé » → numéro 10, nom affiché « Dembélé ».
function parsePlayer(raw: string) {
  const m = raw.trim().match(/^(\d{1,2})[\s.\-–]+(.+)$/);
  const name = (m ? m[2] : raw).trim();
  const parts = name.split(/\s+/);
  return { number: m?.[1] ?? "", short: parts.length > 1 ? parts.slice(1).join(" ") : name, full: name };
}

// Texte lisible sur la couleur du maillot.
export function ink(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111111" : "#ffffff";
}

export function Jersey({ shirt, detail, number, keeper }: { shirt: string; detail: string; number: string; keeper?: boolean }) {
  const body = keeper ? "#facc15" : shirt;
  const trim = keeper ? "#111111" : detail;
  return (
    <svg viewBox="0 0 64 64" className="h-11 w-11 drop-shadow-[0_4px_3px_rgba(0,0,0,0.45)] sm:h-12 sm:w-12" aria-hidden>
      {/* Manches */}
      <path d="M14 10 L2 22 L10 32 L18 26 Z" fill={trim} />
      <path d="M50 10 L62 22 L54 32 L46 26 Z" fill={trim} />
      {/* Corps */}
      <path d="M14 10 L24 6 Q32 12 40 6 L50 10 L46 26 L46 58 Q32 61 18 58 L18 26 Z" fill={body} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      {/* Col */}
      <path d="M24 6 Q32 14 40 6" fill="none" stroke={trim} strokeWidth="3" />
      {/* Reflet pour le relief */}
      <path d="M18 26 L18 58 Q24 59.5 28 60 L28 14 Z" fill="rgba(255,255,255,0.12)" />
      <text x="32" y="44" textAnchor="middle" fontSize="20" fontWeight="900" fontFamily="system-ui, sans-serif" fill={ink(body)}>
        {number}
      </text>
    </svg>
  );
}

function Player({ raw, shirt, detail, keeper }: { raw: string; shirt: string; detail: string; keeper?: boolean }) {
  const p = parsePlayer(raw);
  return (
    <div className="pitch-player flex w-16 flex-col items-center sm:w-20" title={p.full}>
      <Jersey shirt={shirt} detail={detail} number={p.number} keeper={keeper} />
      {/* Ombre au sol */}
      <span className="-mt-1 h-1.5 w-8 rounded-full bg-black/35 blur-[2px]" />
      <span className="mt-0.5 max-w-full truncate rounded bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold leading-tight text-white sm:text-[0.6875rem]">
        {p.short}
      </span>
    </div>
  );
}

/** Terrain en perspective : gardien au premier plan, attaque au fond, maillots aux couleurs du club. */
export function Pitch({ lineup, team, fallback }: { lineup: Lineup; team: string; fallback: string }) {
  const club = useClubColors(team);
  const shirt = lineup.kit?.shirt ?? club?.shirt ?? fallback;
  const detail = lineup.kit?.detail ?? club?.detail ?? "#ffffff";
  const rows = [...lineup.lines].reverse();

  return (
    <div className="pitch-scene overflow-hidden rounded-3xl bg-gradient-to-b from-[#0b2e17] to-[#071d0f] px-2 pb-4 pt-0">
      <div className="pitch-field relative mx-auto -mt-10 max-w-md rounded-xl">
        {/* Pelouse tondue en bandes, éclairage des projecteurs */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.18), transparent 60%), repeating-linear-gradient(0deg, #1f8a3a 0 9%, #23983f 9% 18%)",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.45), 0 30px 40px -20px rgba(0,0,0,0.8)",
          }}
        />
        {/* Marquages */}
        <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <g fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.6">
            <rect x="4" y="4" width="92" height="142" />
            <line x1="4" y1="75" x2="96" y2="75" />
            <circle cx="50" cy="75" r="11" />
            <rect x="24" y="4" width="52" height="22" />
            <rect x="38" y="4" width="24" height="8" />
            <path d="M40 26 A11 11 0 0 0 60 26" />
            <rect x="24" y="124" width="52" height="22" />
            <rect x="38" y="138" width="24" height="8" />
            <path d="M40 124 A11 11 0 0 1 60 124" />
          </g>
          <circle cx="50" cy="75" r="0.9" fill="white" />
        </svg>

        <div className="relative flex min-h-[30rem] flex-col justify-between py-6">
          {rows.map((line, i) => (
            <div key={i} className="flex justify-around px-1">
              {line.map((p, j) => (
                <Player key={`${p}-${j}`} raw={p} shirt={shirt} detail={detail} />
              ))}
            </div>
          ))}
          <div className="flex justify-center">
            <Player raw={lineup.goalkeeper} shirt={shirt} detail={detail} keeper />
          </div>
        </div>
      </div>
    </div>
  );
}
