# ⚙️ Setup & Developer Guide

Follow these steps to get CodeSniper running on your local machine.

## Prerequisites
*   **Node.js**: Version 18.0 or higher.
*   **npm**: Installed with Node.js.
*   **Google AI Studio Account**: To get the API key.

## Step 1: Clone & Install
```bash
# 1. Clone the repository
git clone https://github.com/your-username/codesniper.git

# 2. Enter the directory
cd codesniper

# 3. Install dependencies
npm install
```

## Step 2: Get your AI Key (Crucial)
CodeSniper needs a brain. We use Google Gemini.
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **"Get API Key"**.
3. Create a key in a new project.
4. **Important**: Ensure "Google Search Grounding" is enabled for your account tier (usually free for testing).

## Step 3: Configure Environment
1. Create a file named `.env` in the root folder.
2. Paste your key inside:
```env
REACT_APP_GEMINI_API_KEY=AIzaSy...YourKeyHere...
```

## Step 4: Run the App
```bash
npm start
```
The app should open at `http://localhost:3000` (or similar).

## Troubleshooting
*   **Error: 403 Permission Denied**: This means your API key doesn't have access to Search Grounding. The app has a fallback mode, but results won't be real-time.
*   **White Screen**: Check the browser console (F12) for errors. Usually related to a missing API key.
