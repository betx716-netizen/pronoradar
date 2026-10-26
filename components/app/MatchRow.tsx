"use client";

import type { MatchCard } from "@/lib/view";
import { Icon } from "../Icon";
import { TeamLogo } from "../TeamLogo";

const odds = (n: number) => n.toFixed(2).replace(".", ",");

/** Une ligne de match : heure, équipes et pronostic phare de l'IA. */
export function MatchRow({ m, inTicket, onOpen, onUnlock }: { m: MatchCard; inTicket: boolean; onOpen: () => void; onUnlock: () => void }) {
  const waiting = m.status === "pending" || m.status === "running";
  const failed = m.status === "error";
  return (
    <li>
      <button
        onClick={m.locked ? onUnlock : waiting || failed ? undefined : onOpen}
        disabled={waiting || failed}
        className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-3 text-left transition active:scale-[0.99] disabled:active:scale-100"
      >
        <div className="w-11 shrink-0 text-center">
          <p className="font-display text-lg font-bold leading-none">{m.time ?? "--:--"}</p>
          {inTicket && <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-orange" aria-label="Dans ton ticket" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {[m.home, m.away].map((t) => (
            <p key={t} className="flex items-center gap-2 text-[15px] font-medium leading-tight">
              <TeamLogo name={t} sport={m.sport} size={18} />
              <span className="truncate">{t}</span>
            </p>
          ))}
        </div>
        <div className="w-[118px] shrink-0 text-right">
          {waiting ? (
            <span className="text-[13px] text-muted">{m.status === "running" ? "Analyse en cours…" : "En attente"}</span>
          ) : failed ? (
            <span className="text-[13px] text-muted">Analyse indisponible</span>
          ) : m.locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-soft px-3 py-1.5 text-[13px] font-semibold text-orange-strong">
              <Icon name="lock" className="h-3.5 w-3.5" />
              Premium
            </span>
          ) : m.tip ? (
            <>
              <p className="line-clamp-2 text-[14px] font-semibold leading-tight">{m.tip.selection}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                <span className="font-display text-[15px] font-bold text-accent">{odds(m.tip.odds)}</span> · {m.tip.probability} %
              </p>
            </>
          ) : null}
        </div>
      </button>
    </li>
  );
}
