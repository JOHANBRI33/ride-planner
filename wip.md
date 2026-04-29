# RidePlanner — Work In Progress & Idées

> Fonctionnalités commencées, incomplètes ou à implémenter.
> Dernière mise à jour : 2026-04-28 (session 4)

---

## En cours / commencé mais pas fini

### Strava — Activités stockées
- [x] Table `strava_activities` créée dans Airtable
- [x] Le sync stocke les détails des activités Strava dans `strava_activities`
- [x] Dashboard affiche les dernières activités + stats mensuelles
- [ ] Pas de pagination dans la liste des activités (limité à 20)

### Onboarding — Scoring résultats
- [ ] Les sorties affichées à l'étape 5 (résultats) sont mockées / limitées — pas de vraie requête filtrée par géolocalisation

---

## Airtable — Table `favorites` à créer

- [ ] Créer table `favorites` avec : `userId` (Single line text), `routeId` (Single line text)
- [ ] Sans cette table, les favoris ne se sauvegardent pas (l'API échoue silencieusement)

## Airtable — Table `routes`

- [x] Table `routes` créée avec tous les champs
- [ ] Alimenter la table avec des parcours réels (minimum 5-10 pour tester les suggestions)

---

## Airtable — Actions restantes

- [x] Table `strava_tokens` créée (`userId`, `userEmail`, `athleteId`, `accessToken`, `refreshToken`, `expiresAt`)
- [x] Champ `rythme` ajouté dans `utilisateurs`
- [x] Champ `Niveau` (majuscule) existe dans `utilisateurs`
- [ ] **URGENT** : renommer le champ `Niveau` → `niveau` (minuscule) dans Airtable `utilisateurs` — le code utilise `get("niveau")` (case-sensitive)
- [ ] Table `strava_activities` : ajouter les champs manquants : `activityId` (text), `sport_type` (text), `startDate` (text), `movingTimeMin` (number), `sortieId` (text), `matched` (text)

---

## Variables d'environnement à ajouter sur Vercel

- [ ] `STRAVA_CLIENT_ID`
- [ ] `STRAVA_CLIENT_SECRET`
- [ ] `NEXT_PUBLIC_APP_URL` (ex: `https://rideplanner.vercel.app`)

---

## Idées à implémenter

### UX / Expérience utilisateur
- [ ] **Profil photo upload** : actuellement seul un `photoUrl` textuel est supporté, pas d'upload réel
- [ ] **Notifications** : alerter l'organisateur quand quelqu'un rejoint sa sortie
- [ ] **Messagerie interne** : les routes `/api/messages` et `/api/demandes` existent mais l'UI n'est pas finie
- [ ] **Page de recherche avancée** : filtrer les sorties par sport, niveau, date, distance, lieu
- [ ] **Carte des sorties filtrée** : boutons de filtre sport/niveau directement sur `ExploreMap`
- [ ] **Elevation profile chart** : graphique de profil altimétrique dans le détail d'une sortie

### Carte et parcours
- [ ] **Snap-to-road preview** : le preview curseur est une ligne droite — faire un appel Directions pour le preview aussi
- [ ] **Modification de waypoint** : drag & drop des points existants pour corriger le tracé
- [ ] **Profil altimétrique interactif** : chart cliquable sous la carte dans RoutePickerMap
- [ ] **Export GPX** : télécharger le parcours tracé en fichier GPX
- [ ] **Import photo de parcours** : auto-générer une image statique Mapbox du tracé comme image de couverture

### Social / Communauté
- [ ] **Système de notation** : noter une sortie après y avoir participé (routes `/api/ratings` existent mais UI partielle)
- [ ] **Demandes de sortie privée** : formulaire `/request` existe mais workflow incomplet
- [ ] **Badges et stats** : cumul de km, nombre de sorties, D+ total par sport

### Technique / Performance
- [ ] **Authentification robuste** : remplacer le système `localStorage` + email par NextAuth ou Clerk
- [ ] **Pagination des sorties** : la liste d'accueil charge tout sans limite
- [ ] **Cache sorties** : pas de cache côté serveur pour la liste des sorties
- [ ] **Images Mapbox statiques** : générer automatiquement une image de couverture à partir du parcours tracé (API Mapbox Static Images)
- [ ] **PWA / mobile** : ajouter un manifest + service worker pour utilisation offline et installation sur mobile

---

## Bugs connus / à surveiller

- [ ] `waitForTerrain()` peut retourner `false` si la carte est trop zoomée dehors — le D+ sera absent mais pas signalé clairement
- [ ] Le mode "Marche ou Run" dans la carte couvre walking + running + hiking sans distinction — le champ Sport se règle sur "Course à pied" par défaut, l'utilisateur doit changer si c'est de la randonnée
- [ ] Les sorties sans `latitude/longitude` n'apparaissent pas sur la carte d'exploration
- [ ] Le CI vérifie le build mais pas les tests (pas de tests unitaires en place)
- [ ] Sur la validation dashboard, si `s.distanceKm` et `route` JSON sont tous les deux null, la distance reste vide même pour "Oui" — peu fréquent mais possible pour de vieilles sorties sans parcours tracé
