"use client";
// Scores en direct côté navigateur : interrogés toutes les 30 secondes tant que la page est visible.
import { useEffect, useState } from "react";
import { SLUGS, parseScoreboard, scoreboardUrl, ymd, type LiveMatch } from "./espn";
import { SOFA_LIVE_URL, parseSofaLive } from "./sofa";

export type { LiveMatch };
// Comparaison des noms d'équipes et règlement des paris : partagés avec le serveur (bilan public).
export { sameTeam, findLive, legState, type LegState } from "./settle";
import { sameTeam } from "./settle";

// Grandes compétitions interrogées par le téléphone quand le serveur ne renvoie rien en direct.
const PHONE_WORLD = ["uefa.champions", "uefa.europa", "uefa.europa.conf", "eng.1", "esp.1", "ita.1", "ger.1", "fra.1"];

export function useLiveScores(leagues: string[], world = false) {
  const key = [...new Set(leagues)].sort().join(",");
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [worldMatches, setWorld] = useState<LiveMatch[]>([]);
  const [fullCoverage, setFull] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!key && !world) {
      setMatches([]);
      return;
    }
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      fetch(`/api/live?leagues=${encodeURIComponent(key)}${world ? "&world=1" : ""}`)
        .then((r) => r.json())
        .then((d: { matches: LiveMatch[]; world?: LiveMatch[]; fullCoverage?: boolean }) => {
          if (!alive) return;
          setMatches(d.matches ?? []);
          const server = d.world ?? [];
          setWorld(server);
          setFull(d.fullCoverage !== false);
          // Le serveur est bloqué par la source mondiale : le téléphone l'interroge lui-même.
          if (world && d.fullCoverage === false) {
            fetch(SOFA_LIVE_URL, { headers: { Accept: "application/json" } })
              .then((r) => (r.ok ? r.json() : Promise.reject()))
              .then((data) => {
                if (!alive) return;
                const own = [...(d.matches ?? []), ...server];
                const extra = parseSofaLive(data).filter((s) => !own.some((m) => sameTeam(m.home, s.home) && sameTeam(m.away, s.away)));
                setWorld([...server, ...extra]);
                setFull(true);
              })
              .catch(() => {});
          }
          setUpdatedAt(Date.now());
          // Le serveur n'a aucun match en cours (source injoignable depuis le serveur) : le téléphone interroge ESPN lui-même.
          const serverLive = [...(d.matches ?? []), ...server].some((m) => m.state === "in");
          if (!serverLive) phoneFallback();
        })
        .catch(() => phoneFallback());
    };
    const phoneFallback = () => {
      const now = Date.now();
      // ESPN refuse les plages de dates : hier, aujourd'hui et demain, un jour par requête.
      const days = [-1, 0, 1].map((k) => ymd(new Date(now + k * 86400000)));
      const mine = key ? key.split(",").map((l) => SLUGS[l]).filter(Boolean) : [];
      const extra = world ? PHONE_WORLD.filter((s) => !mine.includes(s)) : [];
      const getDay = (slug: string, d: string) =>
        fetch(scoreboardUrl(slug, d))
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((data) => parseScoreboard(data, slug))
          .catch(() => [] as LiveMatch[]);
      const get = (slug: string) =>
        Promise.all(days.map((d) => getDay(slug, d))).then((all) => all.flat().filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i));
      Promise.all([Promise.all(mine.map(get)), Promise.all(extra.map(get))]).then(([a, b]) => {
        if (!alive) return;
        const own = a.flat();
        const others = b.flat().filter((m) => m.state === "in");
        if (own.length) setMatches((prev) => (prev.some((m) => m.state === "in") ? prev : own));
        if (others.length) setWorld((prev) => [...prev, ...others.filter((m) => !prev.some((p) => p.id === m.id))]);
        setUpdatedAt(Date.now());
      });
    };
    load();
    const t = setInterval(load, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [key, world]);

  return { matches, worldMatches, updatedAt, fullCoverage };
}

