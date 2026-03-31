# CWL Proxy Server — Render.com Setup Guide

Step-by-step instructions to deploy the proxy on Render's free tier. 
**No credit card required.** Total time: ~5 minutes.

---

## Part 1 — Push Your Code to GitHub

Render hosts your code directly from a Git repository. 

1. Create a free GitHub account if you don't have one.
2. Upload this entire project (or just the `proxy-server` folder) to a new GitHub repository.
3. Make sure `proxy-server/server.js` and `proxy-server/package.json` are in the repo.

---

## Part 2 — Deploy on Render

1. Go to [Render.com](https://render.com/) and sign up. (You can use Google Auth or GitHub).
2. Once logged in, click **New** and select **Web Service**.
3. Under "Connect a repository":
   - If you signed up with GitHub, your repos will appear automatically.
   - If you signed up with Google Auth, click **Connect GitHub** first, authorize Render to view your repositories, then select the repo you created in Part 1.
4. Fill out the configuration:
   - **Name:** `cwl-proxy` (or anything)
   - **Region:** **US West (Oregon)** is recommended.
   - **Branch:** `main` (or whatever branch you use)
   - **Root Directory:** `proxy-server` (Crucial! Do not leave blank if the server isn't at the root)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
5. Click **Advanced**, then **Add Environment Variable**:
   - **Key:** `COC_API_TOKEN`
   - **Value:** Paste a fresh CoC API Token here (but don't generate the token yet, we need the IPs first — just put `placeholder` for now)
6. Click **Create Web Service**. 

Wait ~2 minutes for the initial build and deployment to say **"Live"**. 
Copy the URL it gives you (e.g., `https://cwl-proxy-xyz.onrender.com`).

---

## Part 3 — Whitelist the Render NAT IPs

Render free tier uses a specific set of regional gateway IPs. You must add **all** of these IPs to your CoC API token so that it works no matter which server routes your request.

If you chose **US West (Oregon)** in Step 2, go to the [CoC Developer Portal](https://developer.clashofclans.com/) and create a new key. Add these three exact IPs:

```
216.24.57.253
216.24.57.252
216.24.57.234
```

*(If you chose Frankfurt, check Render's official documentation for their Frankfurt NAT IPs).*

1. Save the key in the CoC portal and copy the generated Token.
2. Go back to your Render dashboard → Your Web Service → **Environment**.
3. Edit the `COC_API_TOKEN` variable you made in Step 2. Paste the real token. Save changes.
4. Render will automatically redeploy the service with the new token.

---

## Part 4 — Configure Your Electron App

Update your local `api_config.json`:

```json
{
  "apiToken": "any_valid_token_for_fallback",
  "proxyUrl": "https://cwl-proxy-xyz.onrender.com"
}
```

Start your Electron app. When you fetch CWL data, it will now bounce through Render!

---

## ⚠️ Important Note: The 15-Minute Sleep (Cold Starts)

Render's free tier puts your proxy server to sleep if it receives no requests for 15 minutes. 

**What this means for you:**
- The **first time** you click "Fetch" in your app every day, the proxy has to wake up. This takes roughly **30 to 45 seconds**. The app might look frozen, just wait.
- **Every fetch after that** will be instant because the server is awake.
- If you don't use the app for 15 minutes, the next fetch will have the 45-second delay again.

*(To remove the delay permanently, you'd eventually move to a paid "big name" cloud provider like AWS/GCP, but this $0 solution works perfectly for personal use).*
