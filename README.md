# PronoRadar

L'IA recense les pronostics publiés pour des matchs de **football** et de **tennis**, les compare, dit ce qui en ressort, puis donne sa propre analyse. On choisit jusqu'à 5 championnats, l'application trouve les matchs des 7 prochains jours et les analyse.

## Sources de données (formules gratuites)

| Service | Rôle | Clé |
|---|---|---|
| [The Odds API](https://the-odds-api.com) | Matchs à venir et cotes de dizaines de bookmakers (une requête par championnat) | `ODDS_API_KEY` |
| [API-Football](https://www.api-football.com) | Pronostic chiffré, forme, confrontations directes, blessés (football) | `API_FOOTBALL_KEY` |
| [Google Gemini](https://aistudio.google.com/apikey) | Recherche Google des avis de pronostiqueurs et médias, synthèse et analyse | `GEMINI_API_KEY` |
| [Groq](https://console.groq.com/keys) | IA de secours quand le quota Gemini est épuisé | `GROQ_API_KEY` |
| [Tavily](https://app.tavily.com) | Recherche web de secours | `TAVILY_API_KEY` |

Sans clé, le programme des matchs de football peut aussi venir de l'annuaire public d'ESPN (sans cotes) quand les autres sources sont épuisées.

Une seule clé suffit : l'application utilise les services configurés. Sans Gemini, les analyses sont calculées à partir des cotes et des statistiques, sans avis de pronostiqueurs ni texte rédigé.

## Consensus (`lib/consensus.ts`)

- Les cotes sont converties en probabilités, marge du bookmaker retirée.
- Chaque source vote pour une issue, avec un poids : cotes ×3, modèle statistique ×2, pronostiqueur/média ×1.
- Niveau d'accord : fort (≥ 75 %), modéré (≥ 55 %) ou partagé. Les désaccords sont signalés.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseignez les clés
npm run dev                  # http://localhost:3000
```

Pour tester l'interface sans clé : `DEMO_MODE=1 npm run dev`.

## Mise en ligne (Vercel)

Ajoutez `GEMINI_API_KEY`, `ODDS_API_KEY`, `API_FOOTBALL_KEY` et `APP_PASSWORD` dans les variables d'environnement du projet, puis redéployez.

Pour sauvegarder le suivi des paris dans Supabase : `SUPABASE_URL`, `SUPABASE_KEY` (clé publishable) et `HISTORY_SECRET` (le secret enregistré dans la table `private.settings` de la base). Sans elles, l'historique reste dans le navigateur.

## Coupons du jour (préparés à l'avance)

Chaque matin, le serveur trouve les matchs du jour dans 27 championnats européens, analyse ceux qu'il faut pour composer les coupons (20 au plus, grands championnats en priorité) puis l'IA compose six coupons, de la cote 2 à la cote 50. Ils s'affichent en haut de l'accueil ; les analyses de ces matchs arrivent dans l'onglet Analyses.

- Variables nécessaires : `SUPABASE_SECRET_KEY` (clé secrète Supabase), `CRON_SECRET` (chaîne aléatoire) et `APP_URL` (adresse du site).
- Le cron Vercel lance le travail à 5 h UTC (`vercel.json`) ; la première visite le relance s'il s'est arrêté.
- Réglages facultatifs : `DAILY_LEAGUES`, `DAILY_MAX_MATCHES` (20), `DAILY_CONCURRENCY` (3), `DAILY_MODE` (`rapide`).
