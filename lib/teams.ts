// Les API n'écrivent pas les noms d'équipes de la même façon
// (« Paris Saint Germain », « Paris SG », « PSG »…) : on compare des noms simplifiés.

const NOISE = new Set(["fc", "cf", "ac", "as", "sc", "afc", "ssc", "sv", "fk", "sk", "rc", "cd", "ud", "club", "de", "del", "la", "le", "the", "calcio", "football"]);

const ALIASES: Record<string, string> = {
  psg: "paris saint germain",
  "paris sg": "paris saint germain",
  "man utd": "manchester united",
  "man united": "manchester united",
  "man city": "manchester city",
  inter: "internazionale",
  "inter milan": "internazionale",
  spurs: "tottenham hotspur",
  "bayern munchen": "bayern munich",
  "fc bayern": "bayern munich",
};

export function normalizeName(name: string): string[] {
  let n = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  n = ALIASES[n] ?? n;
  return n.split(" ").filter((t) => t && !NOISE.has(t));
}

/** Score de ressemblance entre deux noms, de 0 (rien en commun) à 1 (identiques). */
export function nameSimilarity(a: string, b: string): number {
  const ta = normalizeName(a);
  const tb = normalizeName(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const sb = new Set(tb);
  const common = ta.filter((t) => sb.has(t) || [...sb].some((u) => u.length >= 4 && (u.startsWith(t) || t.startsWith(u)))).length;
  return common / Math.max(ta.length, tb.length);
}

export function sameMatch(
  a: { home: string; away: string; date: string },
  b: { home: string; away: string; date: string },
): boolean {
  const dayGap = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000;
  if (!(dayGap <= 1)) return false;
  return nameSimilarity(a.home, b.home) >= 0.5 && nameSimilarity(a.away, b.away) >= 0.5;
}
