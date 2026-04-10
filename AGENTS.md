# Discount Hunter AI - Technical Architecture

## Overview
A SaaS platform that discovers REAL discount codes and verifies them through actual checkout simulation before presenting to users. Zero mock data.

## Tech Stack Changes

### Was (Problematic)
- **Gemini 3 Pro** - Expensive ($10/M output tokens)
- **Simulated verification** - All codes marked "VERIFIED" without real testing
- **Fake success rates** - Hardcoded 100% successRate

### Now (Real)
- **MiniMax M2.5** - $0.30/$1.20 per M tokens (10-20x cheaper)
- **Real verification** - Headless browser tests codes against actual checkout
- **Real confidence scores** - Based on actual test results

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vite/React)                  │
│  HeroSearchBar → DashboardWorkspace → ResultsDisplay       │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   searchService.ts                          │
│  Orchestrates: Discovery → Verification → Display         │
└─────────────────────────────────┬───────────────────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
┌─────────────────────┐                     ┌─────────────────────┐
│   minimaxService    │                     │   apiService.ts      │
│   (Discovery Only)  │                     │   (Backend Verifier) │
│                     │                     │                     │
│ • discoverCodes()   │                     │ • verifyCodes()      │
│ • findInfluencer()  │                     │ • Real checkout test│
│ • checkGlitch()     │                     │ • Geo-proxy testing  │
│                     │                     │                     │
│ Uses MiniMax M2.5   │                     │ Uses Puppeteer +    │
│ OpenAI-compatible   │                     │ Residential Proxies  │
└─────────────────────┘                     └──────────┬──────────┘
                                                       │
                              ┌────────────────────────┼────────────────────────┐
                              ▼                        ▼                        ▼
                     ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
                     │  US Region   │          │  UAE Region   │          │  UK Region   │
                     │  (Proxies)   │          │  (Proxies)    │          │  (Proxies)   │
                     └──────────────┘          └──────────────┘          └──────────────┘
```

## Pipeline Flow

### 1. Discovery Phase (MiniMax)
- AI scans for codes from real sources (Reddit, forums, official sites)
- Returns candidate codes with source attribution
- No verification yet - just discovery

### 2. Verification Phase (Backend)
- **REAL** headless browser automation (Puppeteer)
- Simulates checkout flow with test cart
- Tests from user's geo-region using residential proxies
- Each code gets tested: verified | failed | expired | error
- Confidence score based on actual test results

### 3. Display Phase (Frontend)
- Shows ONLY codes that passed verification
- Real confidence scores (not 100% fake)
- Shows which region code was tested in
- Transparent about which codes are unverified

## Key Files

```
discount-hunter-ai/
├── src/
│   ├── services/
│   │   ├── minimaxService.ts    # AI discovery (UPDATED)
│   │   ├── searchService.ts     # Pipeline orchestrator (NEW)
│   │   ├── apiService.ts        # Backend communication (NEW)
│   │   └── geminiService.ts     # DEPRECATED - Remove
│   ├── types.ts                 # Updated with real verification types
│   └── App.tsx                  # Updated to use new services
│
├── backend/                     # NEW - Verification backend
│   ├── src/
│   │   ├── index.ts            # Express server
│   │   ├── discovery.ts        # MiniMax discovery wrapper
│   │   ├── verifier.ts         # Real code verification
│   │   ├── browserBot.ts       # Puppeteer headless testing
│   │   ├── geoProxy.ts         # Geo-location proxy rotation
│   │   └── types.ts
│   └── package.json
│
├── .env.example                 # Updated with MiniMax keys
└── AGENTS.md                   # This file
```

## Confidence Scoring (Real)

| Score | Meaning |
|-------|---------|
| 86-100% | Recently tested & confirmed working |
| 61-85% | Multiple recent verifications |
| 31-60% | Community reports suggest works |
| 0-30% | Single source, unverified |

## Environment Setup

### Frontend (.env)
```env
VITE_MINIMAX_API_KEY=your_key
VITE_VERIFIER_API_URL=http://localhost:3001
```

### Backend (.env)
```env
MINIMAX_API_KEY=your_key
PORT=3001
RESIDENTIAL_PROXY_API_KEY=optional_but_recommended
```

## Running Locally

```bash
# Terminal 1: Backend (Verifier)
cd backend
npm install
npm run dev

# Terminal 2: Frontend
npm install
npm run dev
```

## Deployment

### Backend (Vercel/Node hosting or stay local)
- The verifier needs to run 24/7
- Consider: Railway, Render, DigitalOcean App Platform
- Or: Keep localhost and use ngrok for dev

### Frontend (Vercel)
- Already deployed at discounthunterai.xyz
- Just needs env vars updated

## Notes

- MiniMax is 10-20x cheaper than Gemini
- Real verification requires residential proxies for geo-targeting
- Without proxies, verification still works but without geo-specific results
