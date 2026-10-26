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

Prix (dans `lib/plans.ts`) : 1 000 F la semaine, 3 000 F le mois, 7 500 F les 3 mois. Paiement unique, sans renouvellement automatique : l'abonnement se prolonge à chaque paiement.

**Paiement manuel (mode par défaut)** : le client envoie le montant par Wave ou Orange Money au 07 59 35 86 62 (numéro dans `lib/plans.ts`), puis saisit le numéro qui a payé et la référence du SMS. La demande apparaît dans **Compte → Paiements à valider** pour les numéros listés dans `ADMIN_PHONES` : comparer avec le SMS reçu, puis Valider ou Refuser. Une même référence ne peut servir qu'une fois. Le client peut aussi prévenir sur WhatsApp en un clic.

**CinetPay (optionnel)** : dès que `CINETPAY_API_KEY` et `CINETPAY_SITE_ID` sont renseignés, un lien « payer en ligne » s'ajoute sous le paiement manuel.

Le contenu Premium est retiré par le serveur avant l'envoi : un compte gratuit ne le reçoit jamais.

## Fonctionnement

- **Moteur quotidien** (`lib/daily.ts`) : le cron Vercel appelle `/api/cron/daily` à 5 h UTC. La route répond tout de suite et travaille près de 5 minutes en arrière-plan, puis se relance elle-même tant qu'il reste des matchs. Si la chaîne s'arrête, la première visite qui trouve un travail figé depuis plus de 3 minutes la relance. Les matchs sont réservés un par un en base (`claim_daily_match`), donc deux passages ne font jamais le même travail.
- **Coupons** (`lib/dailyCoupons.ts`) : composés par l'IA à partir de toutes les analyses du jour, ou calculés automatiquement si l'IA est indisponible.
- **Comptes** : numéro de téléphone + mot de passe, sans SMS ni email. Le serveur crée le compte déjà confirmé (Supabase Auth, identifiant interne `225XXXXXXXXXX@tel.pronoradar.app`). Mot de passe oublié : le client écrit sur WhatsApp, l'administrateur en définit un nouveau dans Compte → « Mot de passe oublié d'un client ».
- **Paiement** (`lib/cinetpay.ts`) : la notification de CinetPay et le retour du navigateur ne servent qu'à déclencher une vérification auprès de l'API CinetPay. Seule cette vérification active l'abonnement, une seule fois par paiement (`activate_payment`).
- **Base de données** : `supabase/migrations/20261025120000_saas.sql`. RLS activée sans politique sur toutes les tables : seul le serveur y accède, avec la clé secrète.

## Mise en ligne

1. **Vercel → Variables d'environnement** : toutes celles de `.env.example`, en particulier `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `APP_URL` et `ADMIN_PHONES` (votre numéro, pour valider les paiements). Les clés CinetPay sont facultatives. Supprimez `APP_PASSWORD` s'il existe encore.
2. **Supabase → Authentication → Sign In / Providers** : laissez le fournisseur « Email » activé (il porte les comptes par téléphone). Aucun envoi d'email n'est nécessaire.
3. **CinetPay (plus tard)** : renseignez l'adresse de notification `https://<votre-domaine>/api/pay/notify` si le tableau de bord la demande.
4. Redéployez. Pour lancer la première journée sans attendre le cron : ouvrez l'application, la première visite démarre le moteur.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseignez les clés
npm run dev                  # http://localhost:3000
```

Pour tester tout le parcours sans clé : `DEMO_MODE=1 ADMIN_PHONES=0700000000 npm run dev`. Créez des comptes avec n'importe quel numéro ; celui de `ADMIN_PHONES` voit la validation des paiements.

## Consensus (`lib/consensus.ts`)

- Les cotes sont converties en probabilités, marge du bookmaker retirée.
- Chaque source vote pour une issue, avec un poids : cotes ×3, modèle statistique ×2, pronostiqueur/média ×1.
- Niveau d'accord : fort (≥ 75 %), modéré (≥ 55 %) ou partagé. Les désaccords sont signalés.
