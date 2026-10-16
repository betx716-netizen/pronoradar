# PronoRadar

L'IA recense les pronostics publiés sur le web pour un match de **football** ou de **tennis**, les compare, dit ce qui en ressort, puis donne sa propre analyse.

## Comment ça marche

1. **Recherche** : Claude (Opus 5.5) fait jusqu'à 15 recherches web. Il relève les cotes des bookmakers, les probabilités des modèles statistiques, les avis des pronostiqueurs et des médias, et le contexte du match (forme, absences, confrontations directes).
2. **Mise en forme** : le dossier obtenu est converti en données structurées.
3. **Consensus** (calculé par le code, `lib/consensus.ts`) :
   - les cotes sont converties en probabilités, marge du bookmaker retirée ;
   - chaque source vote pour une issue, avec un poids : bookmaker/bourse ×3, modèle statistique ×2, pronostiqueur/média ×1 ;
   - le niveau d'accord est fort (≥ 75 %), modéré (≥ 55 %) ou partagé ;
   - les désaccords sont signalés (cotes contre majorité, modèles contre cotes, IA contre consensus).
4. **Analyse de l'IA** : ses probabilités, le score probable, son niveau de confiance, les facteurs clés et les risques.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseignez ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Pour tester l'interface sans clé : `DEMO_MODE=1 npm run dev`.

## Coût

Chaque analyse coûte de l'ordre de quelques dizaines de centimes à environ 1 $ (recherches web et modèle). Le coût estimé s'affiche sous chaque analyse.

## Mise en ligne (Vercel)

Importez le dépôt dans Vercel, puis ajoutez `ANTHROPIC_API_KEY` et `APP_PASSWORD` dans les variables d'environnement.

## Prochaines étapes

- Enregistrer chaque analyse dans une base de données, puis comparer les pronostics aux résultats réels.
- Calculer un score de fiabilité par source et l'utiliser comme poids à la place des poids fixes.
