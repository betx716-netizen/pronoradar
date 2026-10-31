// Lit une clé en retirant ce qu'un copier-coller ajoute souvent : espaces, retours à la ligne,
// guillemets, ou le nom de la variable recopié avec (« ODDS_API_KEY=… »).
// Clés enregistrées par l'administrateur dans la base (voir lib/keys.ts) : prioritaires sur celles de Vercel.
const overrides: Record<string, string> = {};
export function setKeyOverrides(values: Record<string, string>) {
  for (const k of Object.keys(overrides)) delete overrides[k];
  for (const [k, v] of Object.entries(values)) if (v) overrides[k] = v;
}
export const keySource = (name: string) => (overrides[name] ? "base" : process.env[name] ? "vercel" : "absente");

export function readKey(name: string): string {
  let v = (overrides[name] ?? process.env[name] ?? "").trim();
  if (v.startsWith(`${name}=`)) v = v.slice(name.length + 1);
  return v.replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, "");
}

/** Description masquée d'une clé, sans jamais l'exposer. */
export function describeKey(name: string) {
  const raw = process.env[name] ?? "";
  const clean = readKey(name);
  return {
    present: clean.length > 0,
    length: clean.length,
    preview: clean.length >= 8 ? `${clean.slice(0, 3)}…${clean.slice(-3)}` : clean ? "trop courte" : "",
    cleanedUp: raw !== clean,
  };
}
