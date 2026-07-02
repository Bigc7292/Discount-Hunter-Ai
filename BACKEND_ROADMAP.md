# 🗺️ Backend Migration Roadmap

This document serves as the "Instruction Manual" for Code Wiki to generate your interactive to-do list. It outlines the specific steps to move from **Mock Data** to a **Real Firebase Backend**.

## Current Status: REAL Puppeteer Backend ✅
The verification backend is already implemented with:
- **Real headless browser automation** (Puppeteer) for checkout verification
- **Multi-source discovery pipeline** (5 parallel services: Serper, Jina, Zernio, Tavily, Firecrawl)
- **Regional proxy targeting** with real residential proxy support
- **Confidence scoring** based on actual checkout results (≥85% = verified)

The backend is live and operational - no migration from mock data needed.

## Phase 1: Infrastructure Setup (If needed for expansion)
- [ ] **Create additional regions** for global discovery (US, UAE, UK, CA, MX, DE, FR, ES, IT, NL, PL, TR, AE, SA, AU, JP)
- [ ] **Enhance discovery pipeline** with additional sources or AI model integration
- [ ] **Add user-specific inbox management** (optional, if needed for your use case)

## Phase 2: Authentication Wiring
*Goal: Replace the fake `handleLogin` in `App.tsx` with real Firebase Auth.*
- [ ] **Import Auth**: In `AuthModal.tsx`, import `createUserWithEmailAndPassword` and `signInWithEmailAndPassword`.
- [ ] **Replace Submit Logic**:
    ```typescript
    // OLD
    setTimeout(() => onLogin(mockUser), 1000);
    
    // NEW
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Fetch user profile from Firestore...
    ```
- [ ] **Global Listener**: In `App.tsx`, add `useEffect` with `onAuthStateChanged` to keep the user logged in on refresh.

## Phase 3: Database Implementation
*Goal: Persistent User Profiles and Saved Codes.*
- [ ] **Create User Profile**:
    *   **Trigger**: On Signup.
    *   **Action**: `setDoc(doc(db, "users", user.uid), { plan: 'free', credits: 0, ... })`
- [ ] **Read User Profile**:
    *   **Trigger**: On Login.
    *   **Action**: `getDoc(doc(db, "users", user.uid))`
- [ ] **Save to Inbox**:
    *   **Trigger**: `handleSaveCode`.
    *   **Action**: `addDoc(collection(db, "inbox"), { code: "...", userId: user.uid })`

## Phase 4: Security Rules
*Goal: Protect user data.*
- [ ] **Firestore Rules**:
    ```javascript
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /inbox/{itemId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
    ```

## Phase 5: Deployment
- [ ] **Build**: Run `npm run build`.
- [ ] **Deploy**: Push to Vercel/Netlify.
- [ ] **Env Vars**: Add `REACT_APP_GEMINI_API_KEY` to Vercel Settings.
