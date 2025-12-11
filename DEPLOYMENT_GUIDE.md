# Discount Hunter AI - Deployment Guide

This guide covers deploying your Discount Hunter AI application to Vercel, configuring Firebase, and linking a custom domain.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Firebase Console Configuration](#firebase-console-configuration)
4. [Vercel Deployment](#vercel-deployment)
5. [Custom Domain Setup](#custom-domain-setup)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google Cloud account (for Gemini AI)
- Firebase account
- Vercel account
- GitHub account
- Custom domain (optional)

---

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys:

#### A. Get Gemini API Key

1. Visit [Google AI Studio](https://ai.google.dev/)
2. Sign in with your Google account
3. Click "Get API Key"
4. Copy the API key
5. Add to `.env`:
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```

#### B. Get Firebase Configuration

See [Firebase Console Configuration](#firebase-console-configuration) section below for detailed steps.

### 3. Run Development Server

```bash
npm run dev
```

The app should open at `http://localhost:5173`

### 4. Test the Application

- Click on category buttons (TRAVEL, TECH, etc.) - should search for category-specific codes
- Try searching for a store (e.g., "Nike", "Amazon")
- Check browser console for any errors
- Verify Gemini AI is finding discount codes

---

## Firebase Console Configuration

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name (e.g., "discount-hunter-ai")
4. Disable Google Analytics (optional, can enable later)
5. Click **"Create project"**

### 2. Register Web App

1. In your Firebase project, click the **Web icon** (`</>`)
2. Enter app nickname (e.g., "Discount Hunter Web")
3. Check **"Also set up Firebase Hosting"** (optional)
4. Click **"Register app"**
5. **IMPORTANT**: Copy the `firebaseConfig` object - you'll need these values

### 3. Enable Authentication

1. In Firebase Console sidebar, click **"Authentication"**
2. Click **"Get started"**
3. Go to **"Sign-in method"** tab
4. Enable **Email/Password**:
   - Click "Email/Password"
   - Toggle "Enable"
   - Click "Save"
5. (Optional) Enable **Google** sign-in:
   - Click "Google"
   - Toggle "Enable"
   - Add support email
   - Click "Save"

### 4. Create Firestore Database

1. In sidebar, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll add rules next)
4. Select location (choose closest to your users)
5. Click **"Enable"**

### 5. Set Firestore Security Rules

1. In Firestore Database, go to **"Rules"** tab
2. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow admins to read all users (you can customize this)
    match /users/{userId} {
      allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

3. Click **"Publish"**

### 6. Add Firebase Config to .env

Using the `firebaseConfig` object from step 2, add to your `.env`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXX
```

---

## Vercel Deployment

### 1. Push Code to GitHub

Make sure all changes are committed:

```bash
git add .
git commit -m "Configure environment variables and fix Gemini AI integration"
git push origin main
```

### 2. Connect Vercel to GitHub

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect it as a Vite project

### 3. Configure Environment Variables in Vercel

**CRITICAL**: You must add ALL environment variables to Vercel:

1. In project settings, go to **"Environment Variables"**
2. Add each variable (one at a time):

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_GEMINI_API_KEY` | Your Gemini API key | Production, Preview, Development |
| `VITE_FIREBASE_API_KEY` | Your Firebase API key | Production, Preview, Development |
| `VITE_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com | Production, Preview, Development |
| `VITE_FIREBASE_PROJECT_ID` | your-project-id | Production, Preview, Development |
| `VITE_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com | Production, Preview, Development |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID | Production, Preview, Development |
| `VITE_FIREBASE_APP_ID` | Your app ID | Production, Preview, Development |
| `VITE_FIREBASE_MEASUREMENT_ID` | Your measurement ID | Production, Preview, Development |

**Important Notes**:
- Select all three environments for each variable
- Click "Save" after each variable
- Variables starting with `VITE_` are exposed to the client (required for Vite)

### 4. Deploy

1. Click **"Deploy"**
2. Wait for build to complete
3. Vercel will provide a deployment URL (e.g., `https://your-app.vercel.app`)

### 5. Test Deployment

1. Visit the Vercel deployment URL
2. Test category search (TRAVEL, TECH, etc.)
3. Test manual product search
4. Try signing up/logging in
5. Check browser console for errors

**Common Issues**:
- If you see "VITE_GEMINI_API_KEY not found" warning: Re-check environment variables in Vercel
- If codes aren't found: Verify Gemini API key is valid and has quota
- If Firebase auth fails: Check Firebase config variables are correct

### 6. Redeploy After Adding Variables

If you added variables after initial deployment:

1. Go to **"Deployments"** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**

---

## Custom Domain Setup

### 1. Add Domain in Vercel

1. In Vercel project, go to **"Settings"** → **"Domains"**
2. Click **"Add"**
3. Enter your domain (e.g., `discounthunter.ai` or `www.discounthunter.ai`)
4. Click **"Add"**

### 2. Configure DNS Records

Vercel will show you which DNS records to add. You have two options:

#### Option A: Using Nameservers (Recommended)

1. Copy Vercel's nameservers
2. Go to your domain registrar (GoDaddy, Namecheap, etc.)
3. Update nameservers to Vercel's nameservers
4. Wait for DNS propagation (can take 24-48 hours)

#### Option B: Using A/CNAME Records

For **apex domain** (e.g., `discounthunter.ai`):
```
Type: A
Name: @
Value: 76.76.21.21
```

For **www subdomain**:
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 3. Wait for SSL Certificate

Vercel automatically provisions SSL certificates. This usually takes a few minutes.

### 4. Test Custom Domain

1. Visit your custom domain
2. Verify SSL is working (should show padlock in browser)
3. Test all functionality

---

## Troubleshooting

### Gemini AI Not Finding Codes

**Symptom**: Search completes but returns no codes, or shows error in console

**Solutions**:
1. Check API key is correct in Vercel environment variables
2. Verify you have Gemini API quota remaining at [Google AI Studio](https://ai.google.dev/)
3. Check browser console for specific error messages
4. Try a different model if "gemini-3-pro-preview" is unavailable (edit `geminiService.ts`, line 9)

### Category Search Goes to External Sites

**Symptom**: Clicking "TRAVEL" opens https://travel.com

**Solution**: 
- This should be fixed with the latest code changes
- Verify you pulled the latest code from GitHub
- Check `App.tsx` line 332: should have `handleSearch(undefined, \`${cat.label} discount codes\`)`

### Firebase Authentication Fails

**Symptom**: Can't sign up or login

**Solutions**:
1. Check Firebase environment variables in Vercel
2. Verify Email/Password auth is enabled in Firebase Console
3. Check browser console for Firebase errors
4. Ensure Firestore security rules are published

### Vercel Build Fails

**Symptom**: Deployment fails during build

**Solutions**:
1. Check build logs in Vercel dashboard
2. Verify all dependencies are in `package.json`
3. Try building locally: `npm run build`
4. Check for TypeScript errors
5. Ensure Node.js version matches (check `package.json` engines field if specified)

### Environment Variables Not Working

**Symptom**: `import.meta.env.VITE_*` is undefined

**Solutions**:
1. Verify variable names start with `VITE_` prefix
2. Check variables are set for correct environment in Vercel
3. Redeploy after adding variables
4. For local development, restart dev server after changing `.env`

---

## Support

For issues specific to:
- **Gemini AI**: [Google AI Studio Documentation](https://ai.google.dev/docs)
- **Firebase**: [Firebase Documentation](https://firebase.google.com/docs)
- **Vercel**: [Vercel Documentation](https://vercel.com/docs)

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Commit and push changes
git add .
git commit -m "Your message"
git push origin main
```

---

**Last Updated**: December 2025
