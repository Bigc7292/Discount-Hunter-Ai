
# 🚀 Backend Migration Checklist

Follow this list to switch CodeSniper from "Demo Mode" to "Production Mode".

## Phase 1: Authentication
- [ ] **Install Firebase SDK**: Run `npm install firebase` in your terminal.
- [ ] **Update AuthModal.tsx**:
  - Replace the mock `setTimeout` login with:
    ```typescript
    import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
    import { auth } from '../firebaseConfig';
    ```
  - In `handleSubmit`, call `signInWithEmailAndPassword(auth, email, password)`.
- [ ] **Handle Global User State**:
  - In `App.tsx`, use the `onAuthStateChanged` hook from Firebase to detect if a user is logged in automatically when the page loads.

## Phase 2: User Data (Profile)
- [ ] **Create User Document**:
  - When a user signs up, use `setDoc` to create a record in the `users` collection in Firestore.
  - Save their `referralCode` and `plan` there.
- [ ] **Fetch User Data**:
  - In `Dashboard.tsx`, instead of using `user` from props, fetch the live data using `getDoc(db, 'users', userId)`.

## Phase 3: The Features
- [ ] **Saving Codes (Inbox)**:
  - In `handleSaveCode` inside `App.tsx`:
  - Change `setInbox(...)` to `addDoc(collection(db, 'inbox'), { ...data })`.
- [ ] **Search History**:
  - When a search finishes, save the result to a `history` collection linked to the user's ID.

## Phase 4: Security (The Final Step)
- [ ] **Rules**: Go to Firestore Console > Rules.
- [ ] Change `allow read, write: if true;` to:
    ```
    allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    ```
  (This ensures users can only see their own data).
