# PronoRadar

Application publique et payante de pronostics football. Chaque matin, l'IA trouve les matchs du jour, les analyse un par un (cotes de dizaines de bookmakers, statistiques, avis publiés sur le web) puis compose six coupons, de la cote 2 à la cote 50. Quand l'utilisateur ouvre l'application, tout est déjà prêt : il prend un coupon tel quel ou compose son propre ticket à partir des paris proposés par l'IA.

## Offres

| | Gratuit | Premium |
|---|---|---|
| Coupon « Le sûr » (cote ≈ 2) | ✓ | ✓ |
| Pronostic des 3 premiers matchs analysés | ✓ | ✓ |
| Les 6 coupons du jour | | ✓ |
| Pronostic et analyse de tous les matchs | | ✓ |
| Mon ticket : combiné personnalisé | | ✓ |
| Analyse en direct | | ✓ |

Prix (dans `lib/plans.ts`) : 1 000 F la semaine, 3 000 F le mois, 7 500 F les 3 mois. Paiement unique via CinetPay (Orange Money, MTN, Moov, Wave, carte), sans renouvellement automatique : l'abonnement se prolonge à chaque paiement.

Le contenu Premium est retiré par le serveur avant l'envoi : un compte gratuit ne le reçoit jamais.

## Fonctionnement

- **Moteur quotidien** (`lib/daily.ts`) : le cron Vercel appelle `/api/cron/daily` à 5 h UTC. La route répond tout de suite et travaille près de 5 minutes en arrière-plan, puis se relance elle-même tant qu'il reste des matchs. Si la chaîne s'arrête, la première visite qui trouve un travail figé depuis plus de 3 minutes la relance. Les matchs sont réservés un par un en base (`claim_daily_match`), donc deux passages ne font jamais le même travail.
- **Coupons** (`lib/dailyCoupons.ts`) : composés par l'IA à partir de toutes les analyses du jour, ou calculés automatiquement si l'IA est indisponible.
- **Comptes** : connexion par email et code à 6 chiffres (Supabase Auth). Le lien reçu dans l'email fonctionne aussi.
- **Paiement** (`lib/cinetpay.ts`) : la notification de CinetPay et le retour du navigateur ne servent qu'à déclencher une vérification auprès de l'API CinetPay. Seule cette vérification active l'abonnement, une seule fois par paiement (`activate_payment`).
- **Base de données** : `supabase/migrations/20261025120000_saas.sql`. RLS activée sans politique sur toutes les tables : seul le serveur y accède, avec la clé secrète.

## Mise en ligne

1. **Vercel → Variables d'environnement** : toutes celles de `.env.example`, en particulier `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `APP_URL`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `ADMIN_EMAILS`. Supprimez `APP_PASSWORD` s'il existe encore.
2. **Supabase → Authentication → URL Configuration** : Site URL = l'adresse de l'application.
3. **Supabase → Authentication → Emails → Magic Link** : ajoutez `{{ .Token }}` au modèle pour que l'email contienne le code à 6 chiffres.
4. **Supabase → Authentication → SMTP** : branchez un service d'envoi (Resend, Brevo…). L'envoi intégré de Supabase est limité à quelques emails par heure.
5. **CinetPay** : renseignez l'adresse de notification `https://<votre-domaine>/api/pay/notify` si le tableau de bord la demande.
6. Redéployez. Pour lancer la première journée sans attendre le cron : ouvrez l'application, la première visite démarre le moteur.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseignez les clés
npm run dev                  # http://localhost:3000
```

Pour tester tout le parcours sans clé : `DEMO_MODE=1 npm run dev`. Connexion avec n'importe quel email et le code 123456 ; le paiement est simulé et active Premium directement.

## Consensus (`lib/consensus.ts`)

- Les cotes sont converties en probabilités, marge du bookmaker retirée.
- Chaque source vote pour une issue, avec un poids : cotes ×3, modèle statistique ×2, pronostiqueur/média ×1.
- Niveau d'accord : fort (≥ 75 %), modéré (≥ 55 %) ou partagé. Les désaccords sont signalés.
