# RidePlanner — Fonctionnalités livrées

> Liste des fonctionnalités terminées et fonctionnelles en production.
> Dernière mise à jour : 2026-04-28 (session 5)

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

## Page d'accueil (refonte session 5 — focus vélo)

- [x] Hero compact : "🚴 Trouve ta prochaine sortie vélo" + météo inline + 2 CTAs
- [x] Météo fetché depuis `/api/weather` via géolocalisation auto, badge inline
- [x] Section "📅 Cette semaine" : scroll horizontal, sorties des 7 prochains jours (max 6)
- [x] `formatDateShort()` : "Aujourd'hui" / "Demain" / weekday court
- [x] Filtres sticky : niveau, date rapide (7j/30j), proximité (avec slider km), reset
- [x] Split layout 58/42% : liste gauche + carte Mapbox droite sticky
- [x] Cartes 🚴 hardcodé (focus vélo), CTA slate-900
- [x] Carte : sync hover card ↔ popup, dots colorés, h-[calc(100vh-160px)]
- [x] Mobile : tabs Liste/Carte dans la barre de filtres
- [x] Toast succès inscription
- [x] Supprimé : CommunauteBoard, "Recommandé pour toi", WeatherWidget full, RoutesSuggestions, slogans rotatifs, compteurs stats, profil prefs bloc, create modal

---

## Carte d'exploration — RoutesMap (`/explore`)

- [x] Affichage ligne GPX (couleur sport) quand une route est active (clic sur carte ou liste)
- [x] Parser GPX client-side dans RoutesMap (DOMParser, downsample 500pts)
- [x] fitBounds sur l'emprise GPX à l'activation
- [x] Badge "Départ du circuit ↑" + "Tracé disponible 🗺️" dans le popup
- [x] Suppression du `easeTo()` — le marker ne bouge plus à chaque clic
- [x] Nettoyage de la couche GPX précédente lors du changement de route active

## Création de sortie — circuit bibliothèque (`/create?routeId=`)

- [x] Circuit chargé depuis `/api/routes/[id]` → affiché comme circuit **verrouillé** (orange 🔒)
- [x] `fixedRoute` prop sur `RoutePickerMap` : couche `route-fixed` (glow + ligne orange)
- [x] Marqueur 🚩 au point de départ du circuit figé
- [x] Badge "Circuit importé — verrouillé" avec info
- [x] L'utilisateur pose son **Point RDV** (marker bleu) séparément du circuit
- [x] Mode "Trajet d'accès (optionnel)" pour tracer le chemin jusqu'au départ
- [x] Le `storedRoute` soumis = circuit fixé (GPX), non écrasable par le tracé d'accès

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
- [x] `GET /api/strava/activities?userId=X` → retourne 20 activités + stats (cache 5 min)
- [x] `POST /api/strava/sync` → fetch 50 dernières activités, match sorties, auto-valide
- [x] Matching automatique activité ↔ sortie (date ±1j, sport, distance ±30%)
- [x] Création automatique de validations pour les sorties matchées
- [x] Mapping sport Strava → RidePlanner (`STRAVA_SPORT_MAP`)
- [x] Dashboard Strava : 4 stat cards (sport principal, km mois, temps mois, nb sorties)
- [x] Liste des 5 dernières activités (nom, sport, km, durée, D+)
- [x] Rechargement automatique des activités après sync

---

## Détail d'une sortie (`/sorties/[id]`)

- [x] Affichage complet : titre, date, heure, lieu, sport, niveau, participants
- [x] Carte de visualisation du parcours
- [x] Bouton "Participer" / "Se désinscrire"
- [x] Validation après sortie (oui / partiel / non + distance + ressenti)

---

## Page Explorer (`/explore`)

- [x] Layout split-screen : liste gauche (400px) / carte Mapbox droite (full-height)
- [x] Filtres : sport, niveau, distance max (slider), tri (distance/proximité/D+)
- [x] Cartes parcours : nom, ville, distance, durée, D+, difficulté, sécurité, badge sport
- [x] CTA "Créer une sortie" + téléchargement GPX par carte
- [x] Favoris ⭐ : toggle optimistic, persistance Airtable (`GET/POST/DELETE /api/favorites`)
- [x] Sync bidirectionnelle liste ↔ carte : hover card → marker highlight, click marker → scroll card
- [x] Mobile : tabs "Liste / Carte"
- [x] Overlay CTA au clic d'un marker sur la carte
- [x] Lien "🗺️ Parcours" dans la Navbar

## Suggestion intelligente de parcours

- [x] `GET /api/routes/search` — scoring top 3, filtres distance/sport/niveau, exclut trafic élevé, cache 2 min
- [x] `GET /api/routes/[id]` — détail + gpx_url
- [x] `RoutesSuggestions.tsx` — widget avec sliders distance, selects sport/niveau, position GPS auto
- [x] Cartes résultat : distance, durée, D+, safety dots (0-5), niveau trafic, distance utilisateur
- [x] CTA "Créer cette sortie →" redirige vers `/create?routeId=X`
- [x] Page `/create` : détecte `?routeId=`, pré-remplit titre/sport/niveau/lieu, charge GPX si dispo
- [x] Section "Parcours suggérés" sur la home page

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
- [x] `GET /api/routes/search` — filtres + scoring
- [x] `GET /api/routes/[id]` — détail parcours
