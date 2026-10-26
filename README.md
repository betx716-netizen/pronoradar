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

Ajoutez `GEMINI_API_KEY`, `ODDS_API_KEY`, `API_FOOTBALL_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `APP_URL` et `ADMIN_PHONES` dans les variables d'environnement du projet, puis redéployez.

Le suivi des paris est enregistré sur le compte de chaque utilisateur (table `user_bets`).

## Coupons du jour (préparés à l'avance)

Chaque matin, le serveur trouve les matchs du jour dans 27 championnats européens, analyse ceux qu'il faut pour composer les coupons (20 au plus, grands championnats en priorité) puis l'IA compose six coupons, de la cote 2 à la cote 50. Ils s'affichent en haut de l'accueil ; les analyses de ces matchs arrivent dans l'onglet Analyses.

- Variables nécessaires : `SUPABASE_SECRET_KEY` (clé secrète Supabase), `CRON_SECRET` (chaîne aléatoire) et `APP_URL` (adresse du site).
- Le cron Vercel lance le travail à 5 h UTC (`vercel.json`) ; la première visite le relance s'il s'est arrêté.
- Réglages facultatifs : `DAILY_LEAGUES`, `DAILY_MAX_MATCHES` (20), `DAILY_CONCURRENCY` (3), `DAILY_MODE` (`rapide`).

## Comptes et Premium

- Connexion par numéro de téléphone + mot de passe, sans SMS ni email. Le site est ouvert à tous en lecture.
- **Gratuit** : le coupon « Le sûr » du jour, l'analyse de 3 matchs du jour et, avec un compte, 1 analyse lancée soi-même par jour (rendue si elle échoue). Les autres coupons sont verrouillés (le serveur n'envoie pas leur contenu).
- **Premium** (`lib/plans.ts`) : les 6 coupons du jour et toutes leurs analyses, lancer ses propres analyses, coupons de l'IA et générateur manuel, analyse en direct. Ces routes renvoient 402 sans Premium.
- Paiement manuel Wave / Orange Money au numéro de `lib/plans.ts` ; validation dans Mon compte → Paiements à valider, pour les numéros de `ADMIN_PHONES`.
