# ♟️ Castle — 3D የመስመር ላይ የቼዝ ጨዋታ

## 📌 ስለ ፕሮጀክቱ

**Castle** ባለ 3D የቼዝ ጨዋታ ነው። ከእውነተኛ ሰዎች ጋር በመስመር ላይ (online) መጫወት፣ ከ AI (ሰው ሰራሽ ብልህነት) ተቃዋሚ ጋር መጫወት፣ ወይም በአንድ መሣሪያ ላይ ሁለት ሰዎች ተለዋውጦ መጫወት ይቻላል።

**🔗 የቀጥታ ማሳያ (Live Demo):** [https://chess-game-beta-mocha.vercel.app](https://chess-game-beta-mocha.vercel.app)

**🔗 GitHub:** [https://github.com/yared2016/chess-game](https://github.com/yared2016/chess-game)

---

## 🎯 ፕሮጀክቱ ምን ያደርጋል?

### ለተጫዋቾች

- ✅ **የመስመር ላይ ጨዋታ (Online)** — ከሌሎች ተጫዋቾች ጋር በቀጥታ መጫወት
- ✅ **የ AI ተቃዋሚ** — 5 የተለያዩ AI ተቃዋሚዎች ከቀላል እስከ ባለሙያ
- ✅ **ተለዋውጦ መጫወት (Pass & Play)** — ሁለት ሰዎች በአንድ ኮምፒውተር/ስልክ ላይ
- ✅ **ባለ 3D ቦርድ** — እውነተኛ የሚመስል 3D የቼዝ ቦርድ ከ 5 የተለያዩ ክፍሎች (rooms) ጋር
- ✅ **2D ቦርድ** — ቀላል 2D ቦርድ ለፈለጉ
- ✅ **AI አስተማሪ (Tutor)** — Castle Pro ተጠቃሚዎች የ AI አስተማሪ ያገኛሉ
- ✅ **የደረጃ ስርዓት (Rating System)** — የተጫዋቾች ደረጃ ይሰላል
- ✅ **Leaderboard** — የተጫዋቾች ደረጃ ዝርዝር
- ✅ **የተጫዋቾች ቻት** — በመስመር ላይ ጨዋታ ጊዜ ከተቃዋሚ ጋር መልእክት መላላክ

### 5ቱ AI ተቃዋሚዎች

| ስም | ደረጃ | ባህሪ | ደረጃ (Rating) |
|------|------|------|-------|
| **Pip** | ጀማሪ | ደስተኛ፣ አበረታች | 800 |
| **Marco** | ቀላል | ተግባቢ፣ ቀልደኛ | 1,100 |
| **Ada** | መካከለኛ | ትዕግስተኛ አስተማሪ | 1,400 |
| **Viktor** | ከፍተኛ | ልምድ ያለው ተቃዋሚ | 1,800 |
| **Kasparova** | ግራንድማስተር | በጣም ጠንካራ | 2,300 |

---

## 🏗️ የተጠቀሙ ቴክኖሎጂዎች (Tech Stack)

ይህ ፕሮጀክት የሚከተሉትን ዘመናዊ ቴክኖሎጂዎች ይጠቀማል፡

| ቴክኖሎጂ | ሥራው |
|---------|------|
| **Next.js 16** | የድረ-ገጹ ማዕቀፍ (Framework) — ፊት-ለፊት (frontend) እና ኋላ-ቀር (backend) አንድ ላይ |
| **React 19** | የድረ-ገጹ UI (ተጠቃሚ ገጽታ) ለመገንባት |
| **TypeScript** | ደህንነቱ የተጠበቀ JavaScript ቋንቋ |
| **Three.js / React Three Fiber** | 3D ግራፊክስ — የቼዝ ቦርዱን እና ቁርጥራጮቹን ባለ 3D ለማሳየት |
| **Clerk** | የተጠቃሚ ማረጋገጫ (Authentication) — መግባት/መመዝገብ/ደንበኝነት (subscription) |
| **Convex** | የዳታቤዝ (Database) — ጨዋታዎች፣ ተጫዋቾች፣ ደረጃዎች፣ ቻት በቀጥታ (realtime) |
| **Stockfish 18** | የቼዝ ኤንጂን — AI ተቃዋሚው ምርጥ እርምጃዎችን ለማስላት (በአሳሽ ውስጥ ይሰራል) |
| **Google Gemini AI** | ለ AI አስተማሪ — ቦታዎችን ለመተንተን እና ለማብራራት |
| **Vercel** | ድረ-ገጹን ለማስተናገድ (Hosting) |
| **Tailwind CSS 4** | ዘመናዊ CSS ማዕቀፍ ለ UI ንድፍ |
| **shadcn/ui** | ዝግጁ UI ክፍሎች (components) |
| **Zustand** | የ React ሁኔታ አስተዳደር (State management) |
| **chess.js** | የቼዝ ህጎች ማረጋገጫ — ህጋዊ እርምጃዎችን ለማረጋገጥ |

---

## 📂 የፋይል መዋቅር (Project Structure)

```
chess-game/
├── src/                          # ዋና ምንጭ ኮድ
│   ├── app/                      # Next.js ገጾች እና API routes
│   │   ├── api/                  # API endpoints
│   │   │   ├── ai/               # AI ተቃዋሚ endpoint
│   │   │   └── tutor/            # AI አስተማሪ endpoint
│   │   ├── play/                 # የጨዋታ ገጽ
│   │   ├── game/                 # ግላዊ ጨዋታ ገጽ
│   │   ├── leaderboard/          # ደረጃ ዝርዝር ገጽ
│   │   ├── profile/              # ተጠቃሚ መገለጫ ገጽ
│   │   ├── sign-in/              # የመግቢያ ገጽ
│   │   └── sign-up/              # የምዝገባ ገጽ
│   ├── components/               # ዳግም ጥቅም ላይ የሚውሉ UI ክፍሎች
│   │   ├── board/                # 2D እና 3D ቦርድ ክፍሎች
│   │   ├── game/                 # ጨዋታ-ነክ ክፍሎች
│   │   └── providers/            # Context providers
│   └── lib/                      # ረዳት ኮዶች (utilities)
│       ├── tutor/                # AI አስተማሪ ሎጂክ
│       ├── chess/                # ቼዝ ሎጂክ
│       └── stockfish/            # Stockfish ኤንጂን ማገናኛ
├── convex/                       # Convex ዳታቤዝ functions
│   ├── schema.ts                 # ዳታቤዝ ስኪማ (tables)
│   ├── games.ts                  # ጨዋታ mutations/queries
│   ├── players.ts                # ተጫዋች mutations/queries
│   ├── matchmaking.ts            # ተጫዋቾችን ማገናኘት
│   └── auth.config.ts            # Clerk ማረጋገጫ ውቅር
├── public/                       # ቋሚ ፋይሎች (ምስሎች፣ 3D ሞዴሎች)
├── .env.local                    # ሚስጥራዊ ቁልፎች (API keys) — ለ git አይሰጥም
├── .env.example                  # ናሙና ቁልፎች
├── package.json                  # ፕሮጀክት ውቅር እና dependencies
└── next.config.ts                # Next.js ውቅር
```

---

## 🔧 ከዜሮ ጀምሮ ለማዘጋጀት (Setup from Scratch)

### ደረጃ 1: የሚያስፈልጉ ቅድመ-ሁኔታዎች

ከመጀመርዎ በፊት የሚከተሉትን ያስገቡ (install ያድርጉ)፡

1. **Node.js 24+** — [https://nodejs.org](https://nodejs.org) ያውርዱ
2. **pnpm** — Node.js ካስገቡ በኋላ ያሂዱ:
   ```bash
   npm install -g pnpm@11.24.0
   ```
3. **Git** — [https://git-scm.com](https://git-scm.com) ያውርዱ

### ደረጃ 2: ፕሮጀክቱን ያውርዱ

```bash
git clone https://github.com/yared2016/chess-game.git
cd chess-game
```

### ደረጃ 3: Dependencies ያስገቡ

```bash
pnpm install
```

ይህ ትእዛዝ ሁሉንም የፕሮጀክቱ ጥገኝነቶች (dependencies) ያወርዳል። ትንሽ ጊዜ ሊወስድ ይችላል።

### ደረጃ 4: የመለያ ምዝገባ (Account Setup)

#### 🔑 Clerk (ተጠቃሚ ማረጋገጫ)
1. [https://dashboard.clerk.com](https://dashboard.clerk.com) ይሂዱ
2. በ Google ወይም GitHub ይመዝገቡ
3. አዲስ application ይፍጠሩ
4. **Publishable Key** እና **Secret Key** ቅዳ ያስቀምጡ

#### 🗄️ Convex (ዳታቤዝ)
1. [https://dashboard.convex.dev](https://dashboard.convex.dev) ይሂዱ
2. ይመዝገቡ (Gmail ይጠቀሙ)
3. አዲስ project ይፍጠሩ (ለምሳሌ "chess-game")
4. **Cloud URL** ቅዳ ያስቀምጡ (ለምሳሌ: `https://fast-oyster-971.convex.cloud`)

#### 🤖 Google Gemini API (AI አስተማሪ)
1. [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) ይሂዱ
2. "Create API Key" ይጫኑ
3. ቁልፉን ቅዳ ያስቀምጡ

### ደረጃ 5: Environment Variables ማዘጋጀት

ፕሮጀክቱ ውስጥ `.env.local` ፋይል ይፍጠሩ:

```bash
# ከ .env.example ይቅዱ
cp .env.example .env.local
```

ከዚያ `.env.local` ፋይሉን ይክፈቱ እና ቁልፎቹን ያስገቡ:

```env
# Clerk ቁልፎች
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/play
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/play

# Convex ቁልፎች
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site

# Google Gemini API ቁልፍ
GEMINI_API_KEY=your-gemini-api-key

# Eve (AI ተቃዋሚ)
EVE_SERVER_SECRET=eve_sec_your_secret_here
EVE_HOST=http://localhost:3000
```

### ደረጃ 6: Convex ዳታቤዝ ማዘጋጀት

Convex ላይ Clerk JWT ማዘጋጀት ያስፈልጋል:

```bash
# Clerk JWT domain ማስገባት
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-domain.clerk.accounts.dev

# Gemini API ቁልፍ ማስገባት
npx convex env set GEMINI_API_KEY your-gemini-api-key

# ዳታቤዝ functions ማስቀመጥ
npx convex dev --once
```

### ደረጃ 7: ፕሮጀክቱን ማስጀመር

```bash
# ልማት ሰርቨር ማስጀመር
pnpm dev
```

ከዚያ አሳሽ (browser) ይክፈቱ: **http://localhost:3000** 🎉

---

## 🌐 ለማስቀመጥ (Deployment to Vercel)

### ደረጃ 1: ወደ GitHub መላክ

```bash
git init
git add -A
git commit -m "Initial commit"
git remote add origin https://github.com/username/chess-game.git
git push -u origin main
```

### ደረጃ 2: Vercel ላይ ማስቀመጥ

1. [https://vercel.com/new](https://vercel.com/new) ይሂዱ
2. GitHub መለያዎን ያገናኙ
3. `chess-game` repository ይምረጡ
4. **Environment Variables** ያስገቡ (ከ `.env.local` ያሉትን ሁሉ)
5. **Deploy** ይጫኑ

### ደረጃ 3: Clerk Domain ማስተካከል

Vercel ድረ-ገጽዎ ከተሰራ በኋላ (ለምሳሌ: `chess-game-beta-mocha.vercel.app`):

1. Clerk Dashboard ይሂዱ
2. **Configure → Domains** ይሂዱ
3. Vercel URL-ዎን ያክሉ: `chess-game-beta-mocha.vercel.app`

---

## 🏛️ ስነ-ህንፃ (Architecture)

```
┌─────────────────────────────────────────────────┐
│                   ተጠቃሚ (Browser)                │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ React UI │  │ 3D Board │  │ Stockfish     │  │
│  │ (Next.js)│  │(Three.js)│  │ (Web Worker)  │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
└───────┼──────────────┼────────────────┼──────────┘
        │              │                │
        ▼              ▼                ▼
┌───────────────┐ ┌──────────┐ ┌──────────────────┐
│   Clerk       │ │  Convex  │ │  Next.js API     │
│ (ማረጋገጫ)     │ │ (ዳታቤዝ) │ │  Routes          │
│ Sign in/up    │ │ Games    │ │ /api/ai/move     │
│ Subscription  │ │ Players  │ │ /api/tutor       │
│               │ │ Ratings  │ │                  │
└───────────────┘ │ Chat     │ └────────┬─────────┘
                  └──────────┘          │
                                        ▼
                                ┌──────────────┐
                                │ Google Gemini│
                                │ AI Model     │
                                └──────────────┘
```

### እንዴት ይሰራል?

1. **ተጠቃሚ ገባ** → Clerk ማረጋገጫ ያካሂዳል
2. **ጨዋታ ጀመረ** → Convex ጨዋታ ይፈጥራል እና ተቃዋሚ ያገናኛል
3. **እርምጃ ወሰደ** → chess.js ህጋዊ መሆኑን ያረጋግጣል → Convex ዳታቤዝ ያስቀምጣል
4. **AI ተራ** → Stockfish ምርጥ እርምጃዎችን ያሰላል → AI ይመርጣል
5. **3D ቦርድ** → Three.js ለውጦቹን በ 3D ያሳያል
6. **ቀጥታ ማሻሻያ** → Convex ለሁለቱም ተጫዋቾች በቀጥታ ያስተላልፋል

---

## 🎮 የጨዋታ ሁነቶች (Game Modes)

### 1. የመስመር ላይ ጨዋታ (Online Multiplayer)
- ተጫዋቾች ወረፋ ይገባሉ
- ስርዓቱ ተመሳሳይ ደረጃ ያላቸውን ተጫዋቾች ያገናኛል
- ሁለቱም ተጫዋቾች በቀጥታ (realtime) ይጫወታሉ
- ደረጃ ይሰላል (rated game)
- Draw ማቅረብ፣ Resign ማድረግ ይቻላል

### 2. ከ AI ጋር (vs AI)
- 5 AI ተቃዋሚዎች ከቀላል (Pip) እስከ ጠንካራ (Kasparova)
- Stockfish ኤንጂን በአሳሽ ውስጥ ይሰራል
- AI ከመጫወት በተጨማሪ ስለ እርምጃው ያስተያየት ይሰጣል (commentary)
- ሶስት ጠቋሚዎች (hints) ለጀማሪ ደረጃ ጨዋታዎች

### 3. ተለዋውጦ መጫወት (Pass & Play)
- ሁለት ሰዎች በአንድ መሣሪያ ላይ
- ቦርዱ በእያንዳንዱ ተራ ይዞራል
- ደረጃ አይሰላም (unrated)

---

## 🧠 AI አስተማሪ (Pro Tutor)

Castle Pro ተጠቃሚዎች AI አስተማሪ ያገኛሉ:

- **"ስጋቶቹን አሳየኝ" (Show me the threats)** ብለው ይጠይቁ
- **"እቅዱ ምንድን ነው?" (What's the plan?)** ብለው ይጠይቁ
- AI አስተማሪው:
  - ✅ ስኩዌሮችን ያበራል (highlight squares)
  - ✅ ቀስቶች ይስላል (draw arrows)
  - ✅ ሊወሰዱ የሚችሉ እርምጃዎችን ያሳያል (candidate lines)
- Google Gemini AI ለመተንተን ይጠቀማል
- Stockfish ኤንጂን ለትንተና ይረዳል

---

## 🔐 ማረጋገጫ እና ደንበኝነት (Auth & Billing)

### Clerk ማረጋገጫ
- በ Email፣ Google ወይም GitHub መግባት ይቻላል
- ሁሉም ተጠቃሚ username እና avatar ያገኛል
- ክፍለ-ጊዜ (session) ደህንነቱ የተጠበቀ ነው

### Castle Pro (ደንበኝነት)
- Pro Plan = AI አስተማሪ ይከፈታል
- ክፍያ Clerk billing በኩል ይካሄዳል
- ሌሎች ባህሪያት (ጨዋታ፣ AI ተቃዋሚ፣ ክፍሎች) ነጻ ናቸው

---

## 📊 ዳታቤዝ ሠንጠረዦች (Database Tables)

Convex ዳታቤዝ ውስጥ የሚከተሉት ሠንጠረዦች (tables) አሉ:

| ሠንጠረዥ | ሥራው |
|--------|------|
| `games` | ሁሉም ጨዋታዎች — ተጫዋቾች፣ ሁኔታ፣ እርምጃዎች |
| `players` | ተጫዋቾች — ደረጃ፣ username፣ ስታቲስቲክስ |
| `queue` | ተጫዋቾች ለመስመር ላይ ጨዋታ የሚጠብቁበት ወረፋ |
| `presence` | ማን በየትኛው ጨዋታ ውስጥ እንዳለ |
| `ratingHistory` | የደረጃ ታሪክ |
| `commentary` | የ AI ተቃዋሚ አስተያየቶች |

---

## 🧪 ፈተና (Testing)

ፕሮጀክቱ የተለያዩ ፈተናዎች አሉት:

```bash
# Unit tests ማካሄድ
pnpm test

# TypeScript ማረጋገጥ
pnpm typecheck

# End-to-end tests (Playwright)
pnpm e2e
```

---

## 🔑 ቁልፎች ማጠቃለያ (Environment Variables Summary)

| ቁልፍ | ከየት ይገኛል | ሥራው |
|------|----------|------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard | ተጠቃሚ ማረጋገጫ (ፊት) |
| `CLERK_SECRET_KEY` | Clerk Dashboard | ተጠቃሚ ማረጋገጫ (ኋላ) |
| `NEXT_PUBLIC_CONVEX_URL` | Convex Dashboard | ዳታቤዝ ግንኙነት |
| `CONVEX_DEPLOYMENT` | Convex Dashboard | ዳታቤዝ ልማት/ምርት |
| `GEMINI_API_KEY` | Google AI Studio | AI አስተማሪ |
| `EVE_SERVER_SECRET` | እርስዎ ይፈጥሩ | AI ተቃዋሚ ደህንነት |

---

## 🔄 የልማት ሂደት (Development Workflow)

### 1. ኮድ ለውጥ ማድረግ
```bash
# ልማት ሰርቨር ማስጀመር (ለውጦች በቀጥታ ይታያሉ)
pnpm dev
```

### 2. ፈተና ማካሄድ
```bash
pnpm test        # Unit tests
pnpm typecheck   # TypeScript ማረጋገጥ
```

### 3. ወደ GitHub መላክ
```bash
git add -A
git commit -m "ለውጥ መግለጫ"
git push origin main
```

### 4. ማስቀመጥ
Vercel GitHub ጋር ስለተገናኘ ወደ GitHub ሲልኩ በራስ-ሰር ይሰራል (auto-deploy)!

---

## ❓ የተለመዱ ችግሮች እና መፍትሄዎች

### ችግር: Sign-in ገጽ ባዶ ነው
**መፍትሄ:** Clerk Dashboard ውስጥ Vercel domain ማከል ያስፈልጋል

### ችግር: "Provided address was not an absolute URL"
**መፍትሄ:** `NEXT_PUBLIC_CONVEX_URL` environment variable Vercel ላይ ማስገባት

### ችግር: 3D ቦርድ አንሜሽን የለውም
**መፍትሄ:** Windows Settings → Accessibility → Visual effects → Animation effects → On

### ችግር: TypeScript errors
**መፍትሄ:** `pnpm typecheck` ያሂዱ እና errors ያስተካክሉ

---

## 📜 ፈቃድ (License)

ይህ ፕሮጀክት ለትምህርት ዓላማ የተሰራ ነው።

- **chess.js** — BSD License
- **Stockfish** — GPL v3
- **Three.js** — MIT License
- **Next.js** — MIT License

---

## 👨‍💻 ገንቢ (Developer)

**Yaredusk** — [yaredusk@gmail.com](mailto:yaredusk@gmail.com)

GitHub: [https://github.com/yared2016](https://github.com/yared2016)

---

## 🙏 ምስጋና

- [Next.js](https://nextjs.org/) — ድንቅ ማዕቀፍ ስለሰጡ
- [Clerk](https://clerk.com/) — ቀላል ማረጋገጫ ስርዓት ስለሰጡ
- [Convex](https://convex.dev/) — ዘመናዊ ዳታቤዝ ስለሰጡ
- [Google Gemini](https://ai.google.dev/) — ነጻ AI API ስለሰጡ
- [Stockfish](https://stockfishchess.org/) — ምርጥ ቼዝ ኤንጂን ስለሰጡ
- [Three.js](https://threejs.org/) — 3D ግራፊክስ ስለሰጡ

---

> **ማሳሰቢያ:** ይህ ፕሮጀክት ለትምህርት ዓላማ የተሰራ ነው። ጥያቄ ካለዎት GitHub Issues ይጠቀሙ።
