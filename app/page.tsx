"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountView } from "@/components/app/AccountView";
import { CouponTicket } from "@/components/app/CouponTicket";
import { MatchRow } from "@/components/app/MatchRow";
import { MatchSheet } from "@/components/app/MatchSheet";
import { Paywall } from "@/components/app/Paywall";
import { TicketView } from "@/components/app/TicketView";
import { BetTracker } from "@/components/BetTracker";
import { Icon, type IconName } from "@/components/Icon";
import { LeagueLogo } from "@/components/LeagueLogo";
import { LiveBoard } from "@/components/LiveBoard";
import { sameTeam } from "@/lib/live";
import { api } from "@/lib/client";
import { PLANS, fcfa } from "@/lib/plans";
import { useSession } from "@/lib/session";
import { useTicket } from "@/lib/ticket";
import type { MatchCard, TodayView } from "@/lib/view";

type Tab = "coupons" | "matchs" | "ticket" | "suivi" | "compte";
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "coupons", label: "Coupons", icon: "coupons" },
  { id: "matchs", label: "Matchs", icon: "matchs" },
  { id: "ticket", label: "Mon ticket", icon: "ticket" },
  { id: "suivi", label: "Suivi", icon: "suivi" },
  { id: "compte", label: "Compte", icon: "compte" },
];

const longDate = (day: string) =>
  day ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)) : "";

type PaymentState = { id: string; status: "checking" | "accepted" | "refused" | "pending" } | null;

export default function Home() {
  const session = useSession();
  const [view, setView] = useState<TodayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("coupons");
  const [paywall, setPaywall] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentState>(null);
  const [accountKey, setAccountKey] = useState(0);
  const [liveMode, setLiveMode] = useState(false);
  const ticket = useTicket(view?.day ?? "");

  const load = useCallback(async () => {
    try {
      setView(await api<TodayView>("/api/today"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Recharge à chaque connexion / déconnexion, puis toutes les minutes tant que la journée n'est pas prête.
  useEffect(() => {
    if (session.ready) load();
  }, [session.ready, session.email, load]);
  useEffect(() => {
    if (!view || view.status === "ready") return;
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [view, load]);

  // Retour du guichet de paiement : on vérifie le paiement jusqu'à ce qu'il soit tranché.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("paiement");
    if (!id) return;
    window.history.replaceState(null, "", "/");
    setPayment({ id, status: "checking" });
  }, []);
  useEffect(() => {
    if (!payment || payment.status !== "checking" || !session.ready || !session.email) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      tries++;
      const r = await api<{ status: string }>(`/api/pay/status?id=${encodeURIComponent(payment.id)}`).catch(() => ({ status: "pending" }));
      if (stop) return;
      if (r.status === "accepted" || r.status === "refused") {
        setPayment({ id: payment.id, status: r.status });
        if (r.status === "accepted") {
          load();
          setAccountKey((k) => k + 1);
        }
      } else if (tries >= 40) setPayment({ id: payment.id, status: "pending" });
      else setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [payment, session.ready, session.email, load]);

  const premium = view?.viewer.premium ?? false;
  const matches = view?.matches ?? [];
  const opened = matches.find((m) => m.id === openId) ?? null;
  const openMatch = (id: string) => {
    const m = matches.find((x) => x.id === id);
    if (!m) return;
    if (m.locked) setPaywall(true);
    else setOpenId(id);
  };
  const inTicket = (id: string) => ticket.legs.some((l) => l.matchId === id);

  const byCompetition = useMemo(() => {
    const map = new Map<string, MatchCard[]>();
    for (const m of matches) map.set(m.competition, [...(map.get(m.competition) ?? []), m]);
    return [...map.entries()];
  }, [matches]);

  const priorFor = (home: string, away: string) => {
    const m = matches.find((x) => sameTeam(x.home, home) && sameTeam(x.away, away));
    return m?.tip ? `${m.tip.selection} (${m.tip.probability} %)` : null;
  };

  const ready = view?.status === "ready";
  const analysed = matches.filter((m) => m.status === "done").length;

  return (
    <div className="min-h-dvh pb-[calc(84px+env(safe-area-inset-bottom))]">
      {/* En-tête vert terrain : sur l'accueil, les tickets du jour s'y posent. */}
      <header className="bg-pitch text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <div className="leading-tight">
              <p className="font-display text-xl font-bold">PronoRadar</p>
              <p className="text-[13px] text-white/70 first-letter:uppercase">{longDate(view?.day ?? "")}</p>
            </div>
          </div>
          {premium ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[14px] font-semibold">
              <Icon name="crown" className="h-4 w-4 text-orange" />
              Premium
            </span>
          ) : (
            <button onClick={() => setPaywall(true)} className="rounded-full bg-orange px-4 py-2 text-[14px] font-semibold text-white active:scale-95">
              Passer Premium
            </button>
          )}
        </div>

        {tab === "coupons" && (
          <div className="mx-auto max-w-5xl px-4 pb-6 pt-3">
            <h1 className="text-[44px] sm:text-[56px]">Les coupons du jour</h1>
            <p className="mt-1 max-w-md text-[15px] text-white/75">
              {ready
                ? `Composés par l'IA à partir de ${analysed} match${analysed > 1 ? "s" : ""} analysé${analysed > 1 ? "s" : ""} ce matin.`
                : view && view.status !== "none" && view.progress.total > 0
                  ? `L'IA analyse les matchs du jour : ${view.progress.done} sur ${view.progress.total}. Les coupons arrivent dès la fin.`
                  : "L'IA prépare les analyses du jour. Reviens dans quelques minutes."}
            </p>
          </div>
        )}
      </header>

      {payment && (
        <div className="mx-auto mt-3 max-w-5xl px-4">
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl p-4 text-[15px] ${
              payment.status === "accepted" ? "bg-success-soft text-success" : payment.status === "refused" ? "bg-warn-bg text-warn-text" : "bg-surface"
            }`}
            role="status"
          >
            <span>
              {payment.status === "checking" && (session.email ? "Vérification de ton paiement…" : "Connecte-toi pour finaliser ton paiement.")}
              {payment.status === "accepted" && "Paiement reçu. Bienvenue en Premium !"}
              {payment.status === "refused" && "Le paiement n'a pas abouti. Aucun montant n'a été débité."}
              {payment.status === "pending" && "Paiement en attente de confirmation. Ton Premium s'activera dès qu'il sera validé."}
            </span>
            {payment.status !== "checking" && (
              <button onClick={() => setPayment(null)} aria-label="Fermer" className="shrink-0">
                <Icon name="close" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4">
        {error && !view && (
          <div className="mt-6 rounded-2xl bg-surface p-6 text-center">
            <p className="text-[15px]">{error}</p>
            <button onClick={load} className="mt-3 rounded-full bg-pitch px-5 py-2.5 font-semibold text-white">
              Réessayer
            </button>
          </div>
        )}

        {tab === "coupons" && (
          <>
            {/* Les tickets débordent sur le bandeau vert : c'est l'élément phare de l'accueil. */}
            <div className="-mx-4 -mt-1 bg-gradient-to-b from-pitch from-[45%] to-transparent to-[45%]">
              <div className="scrollbar-none flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-4 pt-1">
                {!view &&
                  !error &&
                  [0, 1].map((i) => <div key={i} className="ticket h-[380px] w-[84vw] max-w-[340px] shrink-0 opacity-60 sm:w-[340px]" />)}
                {view && !ready && (
                  <div className="ticket w-full max-w-md px-6 py-8">
                    <p className="font-display text-2xl font-bold">Préparation en cours</p>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-paper-line">
                      <div
                        className="h-full rounded-full bg-orange transition-all"
                        style={{ width: `${view.progress.total ? Math.max(6, (view.progress.done / view.progress.total) * 100) : 6}%` }}
                      />
                    </div>
                    <p className="mt-3 text-[15px] text-paper-muted">
                      Chaque match est étudié en détail : cotes de dizaines de bookmakers, forme, absences, avis publiés. Les pronostics
                      apparaissent ci-dessous au fur et à mesure.
                    </p>
                  </div>
                )}
                {ready && view.coupons.length === 0 && (
                  <div className="ticket w-full max-w-md px-6 py-8">
                    <p className="font-display text-2xl font-bold">Pas de coupon aujourd&apos;hui</p>
                    <p className="mt-2 text-[15px] text-paper-muted">Aucun match des championnats suivis n&apos;a lieu aujourd&apos;hui. Rendez-vous demain matin.</p>
                  </div>
                )}
                {ready &&
                  view.coupons.map((c, i) => (
                    <CouponTicket
                      key={c.profile}
                      coupon={c}
                      delay={i * 90}
                      onUnlock={() => setPaywall(true)}
                      onOpenMatch={openMatch}
                      onCopy={() => {
                        if (c.locked) return;
                        ticket.replaceAll(c.legs.map((l) => ({ match: l.match, competition: l.competition, date: l.date, pick: l.pick, matchId: l.matchId })));
                        setTab("ticket");
                      }}
                    />
                  ))}
              </div>
            </div>

            {!premium && ready && (
              <button
                onClick={() => setPaywall(true)}
                className="mt-2 flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left active:scale-[0.99]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-soft text-orange-strong">
                  <Icon name="crown" className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">Débloque les {view.coupons.length} coupons et tous les pronostics</span>
                  <span className="text-[14px] text-muted">
                    Premium dès {fcfa(PLANS[0].price)} · Orange Money, MTN, Moov, Wave
                  </span>
                </span>
                <Icon name="chevron" className="h-5 w-5 text-muted" />
              </button>
            )}

            {matches.length > 0 && (
              <section className="mt-7">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-[28px] font-bold leading-none">Pronostics du jour</h2>
                  <button onClick={() => setTab("matchs")} className="text-[15px] font-semibold text-accent">
                    Tous les matchs ({matches.length})
                  </button>
                </div>
                <ul className="grid gap-2 lg:grid-cols-2">
                  {matches.slice(0, 6).map((m) => (
                    <MatchRow key={m.id} m={m} inTicket={inTicket(m.id)} onOpen={() => openMatch(m.id)} onUnlock={() => setPaywall(true)} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {tab === "matchs" && (
          <section className="pt-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h1 className="text-[40px]">Matchs du jour</h1>
              <div className="flex whitespace-nowrap rounded-full bg-surface-3 p-1 text-[14px] font-semibold" role="tablist">
                {[
                  { on: !liveMode, label: "Pronostics", act: () => setLiveMode(false) },
                  { on: liveMode, label: "En direct", act: () => setLiveMode(true) },
                ].map((b) => (
                  <button key={b.label} role="tab" aria-selected={b.on} onClick={b.act} className={`rounded-full px-3.5 py-1.5 ${b.on ? "bg-surface shadow-sm" : "text-muted"}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            {liveMode ? (
              <LiveBoard leagues={byCompetition.map(([c]) => c)} priorFor={priorFor} />
            ) : matches.length === 0 ? (
              <p className="rounded-2xl bg-surface p-6 text-center text-muted">Les matchs du jour apparaîtront ici dès qu&apos;ils seront trouvés.</p>
            ) : (
              <div className="space-y-6">
                {byCompetition.map(([competition, list]) => (
                  <div key={competition}>
                    <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-bold">
                      <LeagueLogo name={competition} size={22} />
                      {competition}
                    </h2>
                    <ul className="grid gap-2 lg:grid-cols-2">
                      {list.map((m) => (
                        <MatchRow key={m.id} m={m} inTicket={inTicket(m.id)} onOpen={() => openMatch(m.id)} onUnlock={() => setPaywall(true)} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "ticket" && (
          <section className="pt-6">
            <TicketView ticket={ticket} premium={premium} onBrowse={() => setTab("matchs")} onUnlock={() => setPaywall(true)} />
          </section>
        )}

        {tab === "suivi" && (
          <section className="pt-5">
            <h1 className="mb-4 text-[40px]">Mon suivi</h1>
            <BetTracker />
          </section>
        )}

        {tab === "compte" && (
          <section className="pt-5">
            <AccountView email={session.email} refreshKey={accountKey} onUnlock={() => setPaywall(true)} />
          </section>
        )}

        <footer className="mt-10 pb-4 text-center text-[12px] leading-relaxed text-muted">
          Les pronostics sont des analyses, pas des garanties de gain. Jeu interdit aux moins de 18 ans. Joue avec modération.
        </footer>
      </main>

      {ticket.legs.length > 0 && tab !== "ticket" && (
        <button
          key={ticket.legs.length}
          onClick={() => setTab("ticket")}
          className="slip-pulse fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-orange px-4 py-3 text-white shadow-[0_10px_24px_-10px_var(--orange)]"
        >
          <span className="font-semibold">
            Mon ticket · {ticket.legs.length} sélection{ticket.legs.length > 1 ? "s" : ""}
          </span>
          <span className="font-display text-2xl font-bold">{ticket.totalOdds.toFixed(2).replace(".", ",")}</span>
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Navigation">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <li key={t.id}>
                <button
                  onClick={() => {
                    setTab(t.id);
                    window.scrollTo({ top: 0 });
                  }}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 text-[12px] font-semibold ${on ? "text-accent" : "text-muted"}`}
                >
                  <Icon name={t.icon} className="h-6 w-6" />
                  {t.label}
                  {t.id === "ticket" && ticket.legs.length > 0 && (
                    <span className="absolute right-[calc(50%-20px)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] text-white">
                      {ticket.legs.length}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {paywall && <Paywall signedIn={Boolean(session.email)} onClose={() => setPaywall(false)} />}
      {opened && (
        <MatchSheet
          match={opened}
          premium={premium}
          ticket={ticket}
          onClose={() => setOpenId(null)}
          onUnlock={() => {
            setOpenId(null);
            setPaywall(true);
          }}
        />
      )}
    </div>
  );
}
