# Vercel Environment Variables Configuration

## 🔑 Required Environment Variables for Vercel

You **MUST** add these environment variables to your Vercel project dashboard for the app to work correctly.

### How to Add Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **discount-hunter-ai** project
3. Click **Settings** → **Environment Variables**
4. Add each variable below
5. For each variable, select **all three environments**: Production, Preview, and Development

---

## Environment Variables to Add

### 1. Gemini AI API Key (REQUIRED)

**Variable Name:** `VITE_GEMINI_API_KEY`  
**Value:** Your Gemini API key from https://ai.google.dev/  
**Where to get it:**
1. Visit [Google AI Studio](https://ai.google.dev/)
2. Sign in with your Google account
3. Click "Get API Key"
4. Copy the key and paste as the value

**Environments:** ✅ Production ✅ Preview ✅ Development

---

### 2. Firebase Configuration (Optional - for Authentication)

If you want user authentication to work, add these Firebase variables:

**Get these values from:**
1. [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → General
4. Scroll to "Your apps" and copy the config values

| Variable Name | Example Value | Required? |
|--------------|---------------|-----------|
| `VITE_FIREBASE_API_KEY` | AIzaSyB... | Optional |
| `VITE_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com | Optional |
| `VITE_FIREBASE_PROJECT_ID` | your-project-id | Optional |
| `VITE_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com | Optional |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 123456789 | Optional |
| `VITE_FIREBASE_APP_ID` | 1:123:web:abc | Optional |
| `VITE_FIREBASE_MEASUREMENT_ID` | G-XXXXX | Optional |

**Environments for each:** ✅ Production ✅ Preview ✅ Development

---

## Quick Checklist

After adding variables in Vercel:

- [ ] `VITE_GEMINI_API_KEY` added (REQUIRED)
- [ ] All 7 Firebase variables added (Optional, only if using auth)
- [ ] All variables set for **Production**, **Preview**, and **Development**
- [ ] Clicked "Save" for each variable
- [ ] Triggered a new deployment (or it will auto-deploy from GitHub push)

---

## Verifying Deployment

1. Wait for Vercel to finish deploying (check Deployments tab)
2. Visit your Vercel URL (e.g., `https://discount-hunter-ai.vercel.app`)
3. Test the following:
   - ✅ Page loads without errors
   - ✅ Click a category button (e.g., TRAVEL)
   - ✅ Search should initiate and find discount codes
   - ✅ Check browser console for errors (F12 → Console)

---

## Troubleshooting

### "VITE_GEMINI_API_KEY not found" warning

**Solution:** You forgot to add `VITE_GEMINI_API_KEY` in Vercel environment variables. Add it and redeploy.

### Codes not being found

**Possible causes:**
1. Gemini API key is invalid or has no quota
2. API key not set for all environments (Production/Preview/Development)
3. Need to redeploy after adding environment variables

**Solution:** 
1. Verify your API key at https://ai.google.dev/
2. Check you added it for all 3 environments in Vercel
3. Go to Deployments → Click "..." on latest → Redeploy

### Category buttons not searching

**This should now be fixed** in the latest code. If still happening:
1. Check you're using the latest deployment
2. Clear browser cache
3. Check browser console for errors

---

## Firebase Setup (Optional)

If you want user authentication:

1. Follow the detailed steps in [`DEPLOYMENT_GUIDE.md`](file:///C:/Users/toplo/Downloads/discount-hunter-ai/DEPLOYMENT_GUIDE.md)
2. Section: "Firebase Console Configuration"
3. Enable Email/Password authentication
4. Create Firestore database
5. Set security rules
6. Add all Firebase env variables to Vercel

---

## Custom Domain Setup

Once the app is working on Vercel:

1. In Vercel project → Settings → Domains
2. Add your custom domain
3. Update DNS records as Vercel instructs
4. Wait for SSL certificate (automatic)

See [`DEPLOYMENT_GUIDE.md`](file:///C:/Users/toplo/Downloads/discount-hunter-ai/DEPLOYMENT_GUIDE.md) for detailed steps.

---

## Next Steps

1. ✅ **Add `VITE_GEMINI_API_KEY` to Vercel** (CRITICAL)
2. ⏸️ Add Firebase variables (optional, only if you want auth)
3. 🚀 Let Vercel auto-deploy from GitHub
4. 🧪 Test the deployed app
5. 🌐 Add custom domain (optional)

---

**Repository:** https://github.com/Bigc7292/Discount-Hunter-Ai  
**Vercel Project:** Check your Vercel dashboard

**Questions?** Check [`DEPLOYMENT_GUIDE.md`](file:///C:/Users/toplo/Downloads/discount-hunter-ai/DEPLOYMENT_GUIDE.md) for comprehensive troubleshooting.
