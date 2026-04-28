# RidePlanner — Fonctionnalités livrées

> Liste des fonctionnalités terminées et fonctionnelles en production.
> Dernière mise à jour : 2026-04-28 (session 3)

---

## Authentification

- [x] Connexion par email (sans mot de passe — pas de session serveur)
- [x] Persistance via `localStorage` (`ride_user`)
- [x] Déconnexion + nettoyage du localStorage
- [x] Redirection vers `/login?redirect=...` si action nécessite d'être connecté
- [x] `UserContext` global exposant `user`, `profile`, `login`, `logout`, `refreshProfile`

---

## Onboarding

- [x] 4 étapes : sports pratiqués → objectif → niveau → rythme
- [x] Écran de résultats (étape 5) : affiche 4 sorties recommandées basées sur le profil
- [x] Détection si l'onboarding a déjà été fait (`onboardingDone === "true"`) → mode édition
- [x] Sauvegarde dans Airtable (`sports`, `goal`, `niveau`, `rythme`, `onboardingDone`)
- [x] `refreshProfile()` appelé après sauvegarde pour mise à jour immédiate du contexte
- [x] Redirection vers `/?profil=configured` + toast de confirmation
- [x] Multi-sélection sports avec boutons visuels

---

## Profil utilisateur

- [x] Page `/profile` avec avatar, sports, objectif, niveau, rythme, description
- [x] 10 avatars DiceBear bottts (`lib/avatars.ts`)
- [x] Édition du profil (PATCH `/api/users`)
- [x] Bloc "Ton profil sportif" sur la page d'accueil (pills sport/niveau/rythme/objectif)
- [x] Lien "Modifier →" vers `/onboarding`

---

## Page d'accueil (Explore)

- [x] Liste de toutes les sorties ouvertes
- [x] Section "🎯 Recommandé pour toi" : sorties filtrées par scoring (score ≥ 3), max 4
- [x] Scoring : sport (+3) / niveau (+2 ou +1) / proximité ≤20 km (+1) / dans 7 jours (+1)
- [x] Barre de score 7 dots colorés par sortie recommandée
- [x] Hover sur carte de sortie → popup sur la carte (sync bidirectionnelle)
- [x] Toast "Profil configuré ✓" après retour de l'onboarding
- [x] Widget météo (`WeatherWidget`) basé sur la géolocalisation
- [x] Détection position utilisateur pour le scoring de proximité

---

## Carte d'exploration (`ExploreMap`)

- [x] Dots colorés par sport (10px)
- [x] 3 états visuels : idle / hover (scale) / active (popup ouverte)
- [x] Popup Mapbox singleton : image de couverture (460×240), pills sport/niveau/distance, bouton CTA coloré
- [x] Sync card ↔ map : hover sur une carte ouvre le popup sur la carte
- [x] Pas de re-render React pour le popup (DOM Mapbox pur)

---

## Création de sortie (`/create`)

- [x] Formulaire : titre, date, heure, lieu, sport (select), niveau (select), participants max
- [x] Carte interactive double-mode : Point RDV (marker bleu) / Tracer le parcours
- [x] Géolocalisation du RDV (bouton "📍 Ma position")
- [x] Reverse geocoding automatique du point RDV → rempli le champ lieu
- [x] Import de fichier GPX (parsing client-side via `lib/gpx/parseGPX.ts`)
- [x] Champ Sport auto-rempli selon le mode de transport choisi sur la carte
- [x] Après validation : formulaire reste affiché, redirection `/dashboard` après 2s (plus de `form.reset()`)
- [x] Erreur de routage : warning ambre si Directions API échoue
- [x] Badge de difficulté auto supprimé — le niveau est choisi par l'utilisateur uniquement

---

## Tracé de parcours (`RoutePickerMap`)

- [x] Routing segment-par-segment via Mapbox Directions API (2 waypoints par appel)
- [x] 3 modes : Vélo (cycling) / Marche ou Run (walking) / Natation (ligne droite)
- [x] Le mode choisi sur la carte synchronise le champ "Sport" du formulaire
- [x] Colorisation des pentes : vert / jaune / orange / rouge
- [x] Calcul D+ / D- via `queryTerrainElevation` (DEM Mapbox)
- [x] `waitForTerrain()` : retry 200ms jusqu'à 4s pour les tuiles DEM
- [x] Preview curseur en temps réel (ligne pointillée)
- [x] Bouton Boucle (ferme le tracé vers le point de départ)
- [x] Bouton Annuler (dernier point + dernier segment)
- [x] Bouton Effacer (tout réinitialiser)
- [x] Aucun auto-zoom à chaque ajout de point
- [x] Stats : distance, durée estimée, D+ (si terrain disponible)
- [x] Légende des couleurs de pentes (toggle)

---

## Dashboard (`/dashboard`)

- [x] Mes sorties organisées : statut, participants, lien vers le détail
- [x] Mes participations : sorties auxquelles l'utilisateur est inscrit
- [x] Section Strava : bouton de connexion, bouton de synchronisation
- [x] Toast "Strava connecté ✓" / "Refus" / "Erreur" après OAuth
- [x] `useSearchParams()` wrappé dans `<Suspense>` (fix build Next.js 16)
- [x] **Validation "Oui"** : soumet directement avec les km de la sortie (plus de formulaire vide)
- [x] **Validation "Non"** : spinner visible + message d'erreur si API échoue + transition vers "done"
- [x] **Validation "Partiellement"** : formulaire de saisie avec distance/durée pré-remplis
- [x] Distance et durée initialisées depuis `distanceKm` ou `parseRouteStats(route)`

---

## Intégration Strava

- [x] OAuth 2.0 complet (auth → callback → sauvegarde token)
- [x] Token refresh automatique (si expiré sous 5 min)
- [x] `GET /api/strava/status` → vérifie si connecté
- [x] `POST /api/strava/sync` → fetch 50 dernières activités
- [x] Matching automatique activité ↔ sortie (date ±1j, sport, distance ±30%)
- [x] Création automatique de validations pour les sorties matchées
- [x] Mapping sport Strava → RidePlanner (`STRAVA_SPORT_MAP`)

---

## Détail d'une sortie (`/sorties/[id]`)

- [x] Affichage complet : titre, date, heure, lieu, sport, niveau, participants
- [x] Carte de visualisation du parcours
- [x] Bouton "Participer" / "Se désinscrire"
- [x] Validation après sortie (oui / partiel / non + distance + ressenti)

---

## API Routes

- [x] `GET/POST /api/sorties` — liste et création
- [x] `GET/PATCH/DELETE /api/sorties/[id]`
- [x] `GET/POST/PATCH /api/users`
- [x] `GET/POST /api/validations`
- [x] `GET /api/weather` — proxy OpenWeatherMap (revalidate 30 min)
- [x] `POST /api/route` — proxy Mapbox Directions server-side
- [x] `GET /api/strava/auth` / `callback` / `status`
- [x] `POST /api/strava/sync`
- [x] Sanitisation du JSON route avant Airtable (suppression slopes, downsampling à 300 pts)
