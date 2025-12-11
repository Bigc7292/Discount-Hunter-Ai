
#  The Absolute Beginner's Guide to Firebase Backend

This guide will help you set up the "Brain" and "Memory" of CodeSniper. Currently, if you refresh the page, data disappears. After following this, data will stay forever.

## Step 1: Create the Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Click **"Add project"**.
3. Name it `CodeSniper-App`.
4. Disable "Google Analytics" for now (keeps things simpler).
5. Click **"Create Project"**.

## Step 2: Get Your Keys (The Bridge)
1. On the Project Overview page, click the **Web Icon** (Looks like `</>`).
2. Register app nickname: `CodeSniper-Web`.
3. Click **Register app**.
4. You will see a code block with `const firebaseConfig = { ... }`.
5. **ACTION:** Copy the contents inside that bracket and paste them into your local file `src/firebaseConfig.ts`.

## Step 3: Turn on Authentication (Login System)
1. On the left sidebar, click **Build** -> **Authentication**.
2. Click **Get Started**.
3. Select **Email/Password**.
4. Toggle **Enable**.
5. Click **Save**.
6. (Optional) Repeat for **Google** if you want 1-click login.

## Step 4: Turn on Firestore (The Database)
This is where User Profiles, Saved Codes, and History live.
1. On the left sidebar, click **Build** -> **Firestore Database**.
2. Click **Create Database**.
3. Choose a location (e.g., `nam5 (us-central)`).
4. **IMPORTANT:** Choose **Start in Test Mode**.
   * *Why?* This allows you to write data immediately without complex security rules blocking you while developing. You will secure this later.
5. Click **Create**.

## Step 5: Data Modeling (Data Studio)
You don't *have* to create these manually (code can do it), but seeing them helps. Go to the **Data** tab in Firestore and visualize this structure:

- **Collection:** `users`
  - **Document:** `(User ID)`
    - `email`: string
    - `plan`: "free" | "pro"
    - `credits`: number
    - `referralCode`: string

- **Collection:** `inbox`
  - **Document:** `(Auto ID)`
    - `userId`: (Link to user)
    - `code`: string
    - `merchant`: string

## Step 6: Deploying to Vercel (Hosting)
1. Push your code to GitHub.
2. Go to [Vercel.com](https://vercel.com) and import your repo.
3. Vercel will auto-detect React/Next.js.
4. Click **Deploy**.
