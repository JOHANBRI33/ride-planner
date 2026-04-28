# RidePlanner — Documentation Technique

> Bible technique du projet. À mettre à jour à chaque modification d'architecture ou de contrat d'API.
> Dernière mise à jour : 2026-04-28

---

## Stack

| Couche | Technologie |
|--------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Langage | TypeScript strict |
| Style | Tailwind CSS |
| Base de données | Airtable (via SDK `airtable`) |
| Carte | Mapbox GL JS + Mapbox Directions API v5 |
| Auth | Email simple — `localStorage` (pas de session serveur) |
| Météo | OpenWeatherMap API |
| Intégration sport | Strava OAuth 2.0 |
| Hosting | Vercel |

---

## Variables d'environnement

```env
NEXT_PUBLIC_MAPBOX_TOKEN=     # clé publique Mapbox (carte + Directions)
AIRTABLE_API_KEY=             # clé API Airtable
AIRTABLE_BASE_ID=             # ID de la base Airtable
OPENWEATHER_API_KEY=          # clé OpenWeatherMap
STRAVA_CLIENT_ID=             # OAuth Strava
STRAVA_CLIENT_SECRET=         # OAuth Strava
NEXT_PUBLIC_APP_URL=          # URL prod (ex: https://rideplanner.vercel.app)
```

---

## Architecture fichiers

```
app/
  page.tsx                    # Page d'accueil — explore + recommandations
  layout.tsx                  # Layout global (Navbar, UserProvider)
  create/page.tsx             # Création de sortie
  dashboard/page.tsx          # Tableau de bord utilisateur + Strava
  onboarding/page.tsx         # Onboarding 4 étapes + résultats personnalisés
  profile/page.tsx            # Profil utilisateur + édition
  login/page.tsx              # Connexion par email
  request/page.tsx            # Demande de sortie privée
  sorties/[id]/page.tsx       # Détail d'une sortie
  api/
    sorties/route.ts          # GET (liste) / POST (créer)
    sorties/[id]/route.ts     # GET (détail) / PATCH / DELETE
    users/route.ts            # GET / POST / PATCH utilisateur
    validations/route.ts      # GET / POST validation après sortie
    weather/route.ts          # Proxy OpenWeatherMap
    route/route.ts            # Proxy Mapbox Directions (server-side)
    ratings/route.ts          # Notations
    messages/route.ts         # Messages / chat
    demandes/route.ts         # Demandes de sortie
    demandes/[id]/route.ts    # Détail demande
    ride-requests/route.ts    # Requests de participation
    strava/auth/route.ts      # Initie OAuth Strava
    strava/callback/route.ts  # Callback OAuth → sauvegarde token
    strava/status/route.ts    # Vérifie si Strava est connecté
    strava/sync/route.ts      # Sync activités Strava → validations auto

components/
  RoutePickerMap.tsx          # Carte interactive de tracé de parcours
  ExploreMap.tsx              # Carte d'exploration des sorties (page d'accueil)
  Navbar.tsx                  # Navigation + avatar utilisateur
  MiniMapPreview.tsx          # Miniature de carte pour cartes de sortie
  WeatherWidget.tsx           # Widget météo
  ChatBubble.tsx / Wrapper    # Chat IA intégré
  CommunauteBoard.tsx         # Tableau communautaire
  CommunityActivity.tsx       # Flux d'activité
  Map.tsx / MapPicker.tsx / PickLocationMap.tsx  # Composants carte legacy/utilitaires

lib/
  avatars.ts                  # Liste AVATARS (DiceBear bottts)
  strava.ts                   # Logique Strava (tokens, fetch, matching)
  mapbox/
    directions.ts             # getSegment() + getDirections() + MAPBOX_PROFILE
    routeService.ts           # Ancien service de route (compatibilité)
    parseRoute.ts             # Parsing de routes stockées
  elevation/
    elevationService.ts       # Types StoredRoute, calcul D+/D-, colorisation pentes
  gpx/
    parseGPX.ts               # Parser de fichiers GPX
  getAutoImage.ts             # Image automatique par sport

context/
  UserContext.tsx             # UserProvider — user + profile + login/logout/refreshProfile
```

---

## Airtable — Tables et champs

### `sorties`
| Champ | Type | Description |
|-------|------|-------------|
| Titre | text | Titre de la sortie |
| Date | date | Date YYYY-MM-DD |
| Heure | text | ex: "09:00" |
| Lieu précis | text | Adresse ou lieu |
| Sport | text | "Vélo", "Course à pied", "Trail", "Randonnée", "Natation", "Triathlon" |
| Niveau requis | text | "Débutant", "Intermédiaire", "Avancé", "Expert" |
| Participants max | number | |
| Latitude / Longitude | number | Coordonnées RDV |
| organizerId | text | ID utilisateur organisateur |
| organizerEmail | text | |
| status | text | "open" / "closed" |
| image_url | text | URL image de couverture |
| distanceKm | number | |
| elevationGain | number | D+ en mètres |
| route | text (JSON) | StoredRoute v2 sérialisé (geometry sous-échantillonnée à 300 pts, sans slopes) |
| route_geometry | text (JSON) | Array de coordonnées brutes |
| Participants IDs | text | IDs séparés par virgule |

### `utilisateurs`
| Champ | Type |
|-------|------|
| Email | text (unique) |
| sexe | text |
| ageRange | text |
| sports | text (CSV: "cycling,running") |
| goal | text |
| description | text |
| avatarKey | text |
| photoUrl | text |
| onboardingDone | text ("true") |
| niveau | text |
| rythme | text |
| cycling_level / cycling_bikeType / cycling_mechanicalSkill | text |
| running_pace / running_terrain / running_distance | text |
| hiking_duration / hiking_elevationGain / hiking_groupPref | text |
| swimming_level / swimming_distance | text |

### `validations`
| Champ | Type |
|-------|------|
| sortieId | text |
| userId | text |
| status | text ("oui" / "partiel" / "non") |
| distanceKm | number |
| durationMin | number |
| ressenti | text |
| createdAt | text (ISO date) |

### `strava_tokens`
| Champ | Type |
|-------|------|
| userId | text |
| userEmail | text |
| athleteId | text |
| accessToken | text |
| refreshToken | text |
| expiresAt | text (unix timestamp) |

### `strava_activities` *(à créer)*
Stocke les activités importées de Strava après sync.

---

## Authentification

- Pas de session serveur. L'utilisateur entre son email → sauvegardé dans `localStorage` (`ride_user`)
- L'ID utilisateur = `btoa(email)` sans padding `=`
- `UserContext` expose `user`, `profile`, `login()`, `logout()`, `refreshProfile()`
- `profile` = réponse de `GET /api/users?email=...` (champs Airtable)

---

## Cartographie

### ExploreMap (`components/ExploreMap.tsx`)
- Affiche les sorties comme des dots colorés par sport
- 3 états par dot : `idle` / `hover` (scale) / `active` (popup)
- Props : `sorties`, `hoveredId`, `activeId`, `onHover`, `onActive`, `height`
- Popup Mapbox unique (singleton `popupRef`) avec image, pills, bouton CTA
- Sync bidirectionnelle avec les cartes de sortie (hover card → popup carte)

### RoutePickerMap (`components/RoutePickerMap.tsx`)
- Tracé de parcours interactif, segment-par-segment
- **Modes de transport** : Vélo (`cycling`), Marche/Run (`walking`), Natation (ligne droite)
- **`addWaypoint()`** : route uniquement le nouveau segment A→B via Mapbox Directions
- **`waitForTerrain()`** : polling `queryTerrainElevation` jusqu'à 4s pour les tuiles DEM
- **`undoLast()`** : supprime le dernier waypoint et le dernier segment
- Preview curseur en temps réel (ligne pointillée du dernier point au curseur)
- Colorisation des pentes : vert (0-3%) / jaune (3-6%) / orange (6-10%) / rouge (>10%)
- Props : `onLocationChange`, `onRouteChange`, `onModeChange`, `height`, `initialGpx`
- **Pas de auto-zoom** à chaque ajout de point (fitBounds uniquement sur import GPX)

---

## Mapbox Directions API

```
GET https://api.mapbox.com/directions/v5/mapbox/{profile}/{lng1,lat1;lng2,lat2}
  ?geometries=geojson&overview=full&steps=false&access_token={token}
```

- `getSegment(from, to, mode)` — 2 waypoints max par appel (plus fiable)
- `getDirections(waypoints, mode)` — découpe en N-1 `getSegment`, concatène les géométries
- `MAPBOX_PROFILE` : `{ cycling: "cycling", running: "walking", hiking: "walking" }`
- Mode swimming → ligne droite, pas d'appel API

---

## Strava OAuth 2.0

1. `GET /api/strava/auth` → redirect vers `https://www.strava.com/oauth/authorize`
   - `state` = JSON `{ userId, userEmail }` encodé en base64
2. Strava redirige vers `GET /api/strava/callback?code=...&state=...`
   - Exchange code → tokens → `upsertStravaToken()` → redirect `?strava=connected`
3. `GET /api/strava/status?userId=X` → `{ connected: bool, athleteId: string }`
4. `POST /api/strava/sync` → fetch 50 dernières activités → `matchActivity()` → crée validations auto

**Token refresh** : `getValidAccessToken()` vérifie `expiresAt`, rafraîchit si < 5 min de validité.

**Matching activité ↔ sortie** :
- Date ±1 jour
- Sport correspondant (via `STRAVA_SPORT_MAP`)
- Distance ±30% (si la sortie a une distance)

---

## Scoring de recommandation

`computeScore(sortie, prefs, userLat, userLng): number` (dans `app/page.tsx`)

| Critère | Points |
|---------|--------|
| Sport correspond aux sports du profil | +3 |
| Niveau correspond au niveau du profil | +2 |
| Niveau "Débutant" (bonus inclusif) | +1 |
| Sortie à ≤ 20 km de l'utilisateur | +1 |
| Sortie dans les 7 prochains jours | +1 |

- Score minimum affiché : 3
- Affichage : barre de 7 dots colorés + section "🎯 Recommandé pour toi"

---

## StoredRoute (format de stockage)

```typescript
type StoredRoute = {
  v: 2;
  geometry: [number, number][];  // [lng, lat][], sous-échantillonné à 300 pts max pour Airtable
  distanceKm: number;
  durationMin: number;
  gain?: number;    // D+ en mètres
  loss?: number;    // D- en mètres
  slopes?: SlopeSegment[];  // supprimé avant sauvegarde Airtable
}
```

---

## Conventions de code

- **`"use client"`** en haut de tout composant React avec hooks
- **Airtable TypeScript** : toujours caster avec `as any` pour les champs (`fields as any`)
- **Mapbox `map.once("idle", ...)`** : toujours `() => resolve()` et non `resolve` directement (TS overload)
- **`useSearchParams()`** doit être dans un composant enfant wrappé par `<Suspense>`
- **Dynamic import** pour les composants Mapbox : `_dynamic(() => import(...), { ssr: false })`
- **Pas de `getDifficulty()` dans l'UI** — le niveau est choisi par l'utilisateur dans le formulaire
