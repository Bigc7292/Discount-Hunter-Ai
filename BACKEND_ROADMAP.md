# 🗺️ Backend Migration Roadmap

This document serves as the "Instruction Manual" for Code Wiki to generate your interactive to-do list. It outlines the specific steps to move from the current **Mock Data** to a **Real Firebase Backend**.

## Phase 1: Infrastructure Setup
- [ ] **Create Firebase Project**: Go to console.firebase.google.com and create "CodeSniper".
- [ ] **Enable Auth**: Turn on "Email/Password" provider.
- [ ] **Enable Firestore**: Create a database in "Test Mode".
- [ ] **Copy Config**: Get the Firebase Config object and paste it into `src/firebaseConfig.ts`.

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
