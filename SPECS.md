# Xtream Codes Checker — Cahier des charges

## 1. Contexte & objectif

Application web publique permettant de vérifier la validité d'un abonnement IPTV basé sur le protocole **Xtream Codes**. L'outil distingue trois états :

| État | Cause |
|---|---|
| Serveur mort | URL/host injoignable (timeout, DNS fail, connexion refusée) |
| Identifiants invalides | Serveur répond mais `user_info.auth == 0` |
| Abonnement valide | Serveur répond et `user_info.auth == 1` |

L'outil est un vérificateur technique neutre — il ne stocke ni ne redistribue de contenu.

---

## 2. Stack technique

| Couche | Choix |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Langage | TypeScript |
| Styling | Tailwind CSS |
| Composants UI | shadcn/ui |
| Proxy CORS | Vercel API Route (Route Handler) |
| Rate limiting | Vercel Middleware — limite par IP |
| Persistance | `localStorage` côté client uniquement |
| Hébergement | Vercel |
| Versioning | GitHub |

---

## 3. Fonctionnalités

### 3.1 Saisie — deux modes

**Mode formulaire (3 champs)**
- URL du serveur (ex. `http://domain.com:8080`)
- Username
- Password

**Mode URL tout-en-un**
- Parsing d'un lien complet, formats supportés :
  - `http://host:port/get.php?username=X&password=Y&type=m3u`
  - `http://host:port/player_api.php?username=X&password=Y`
- Auto-remplissage des 3 champs après parsing

### 3.2 Logique de vérification

L'appel transite par un Vercel Route Handler (proxy) pour contourner le CORS.

```
Backend → GET {server_url}/player_api.php?username={u}&password={p}
```

Timeout : **10 secondes** côté proxy.

Arbre de décision :
```
Réponse reçue ?
├── Non (timeout / erreur réseau) → ❌ Server unreachable
└── Oui
    └── user_info.auth == 1 ?
        ├── Non → ⚠️ Invalid credentials
        └── Oui → ✅ Valid subscription
```

### 3.3 Affichage des résultats

**Cas valide — données extraites de la réponse API :**
- Expiration date (`exp_date` — timestamp Unix → date lisible)
- Status (`Active` / `Expired` / `Banned`)
- Max connections autorisées
- Formats supportés (ex. m3u, Enigma2)
- Type de compte

**Cas invalide / mort :** message d'erreur explicite avec code (ex. `ERR_TIMEOUT`, `ERR_AUTH`).

### 3.4 Historique des vérifications

- Stocké en `localStorage`, clé `xc-history`
- 20 entrées maximum (FIFO)
- Chaque entrée contient : host, username, statut, timestamp
- **Le mot de passe n'est pas persisté**
- Possibilité de vider l'historique
- Clic sur une entrée → pré-remplissage du formulaire (sans le password)

### 3.5 Diagnostics réseau (connexion valide uniquement)

#### Your Latency — client-side
- Exécuté depuis le **browser** (ta connexion réelle vers le serveur IPTV)
- `fetch(serverUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })` chronométré avec `performance.now()`
- Mesure le round-trip réel : **toi → serveur IPTV**
- Seuils d'affichage :
  - 🟢 `< 100 ms` — Excellent
  - 🟠 `100–300 ms` — Acceptable
  - 🔴 `> 300 ms` — High latency
- Fallback : si le browser zerou le timing cross-origin (restriction sécurité), afficher `N/A`

#### DNS Resolution + Géolocalisation — server-side
- Exécuté côté **Vercel** (nécessite un proxy, impossible depuis le browser)
- `dns.resolve4(hostname)` → IP v4 réelle
- Appel `ip-api.com/json/{ip}` → géolocalisation et hébergeur
- Timeout : **3 secondes** (non bloquant)
- Données affichées :

| Champ | Exemple |
|---|---|
| IP | `51.178.24.44` |
| Pays | 🇫🇷 France |
| Ville | Paris |
| ISP / Hébergeur | OVH SAS |
| ASN | AS16276 |

#### Flux d'exécution
```
Résultat auth = valide
├── [Client] fetch HEAD chrono → Your Latency
└── [Serveur] DNS resolve → IP → ip-api.com → Géoloc + Hébergeur
```

### 3.6 Rate limiting

- Vercel Middleware : max **10 requêtes / minute / IP** sur la route `/api/check`
- Réponse `429 Too Many Requests` avec message clair en cas de dépassement

---

## 4. Interface utilisateur

- Langue : **anglais**
- Design : sombre (dark mode par défaut), minimaliste
- Responsive : mobile-first
- États visuels :
  - Loading : spinner pendant la vérification
  - Succès : badge vert + card résultat
  - Erreur auth : badge orange
  - Serveur mort : badge rouge
  - Rate limit : message spécifique

---

## 5. Hors périmètre (v1)

- Parsing / lecture des playlists M3U
- Lecteur vidéo intégré
- Authentification utilisateur / comptes
- Multi-check en masse (batch)
- i18n / multi-langue
- Analytics / tracking

---

## 6. Structure de projet (cible)

```
xtream-checker/
├── app/
│   ├── page.tsx              # Page principale
│   ├── layout.tsx
│   └── api/
│       └── check/
│           └── route.ts      # Proxy CORS + logique vérification
├── components/
│   ├── checker-form.tsx      # Formulaire + parsing URL
│   ├── result-card.tsx       # Affichage résultat + diagnostics réseau
│   ├── network-stats.tsx     # Latence TCP, HTTP, IP, géoloc
│   └── history-list.tsx      # Historique localStorage
├── lib/
│   ├── parse-xtream-url.ts   # Parser URL tout-en-un
│   ├── network-probe.ts      # DNS resolve, TCP latency, géoloc
│   └── types.ts              # Types TypeScript partagés
├── middleware.ts              # Rate limiting IP
└── ...config files
```

---

## 7. Livrables

- [ ] Repository GitHub public
- [ ] Application déployée sur Vercel
- [ ] README avec instructions de déploiement
