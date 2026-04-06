# CWL Proxy Server — Google Cloud Platform (GCE) Setup Guide

This guide provides step-by-step instructions to deploy the CoC API proxy on a **Google Cloud Platform Always Free Tier VM** (Compute Engine `e2-micro` running Ubuntu).
A GCE VM gives you a **dedicated static IP address**, which is perfectly compatible with the Clash of Clans API whitelisting requirements.

> **Cost:** The `e2-micro` instance (1 shared vCPU, 1 GB RAM) is part of GCP's
> [Always Free Tier](https://cloud.google.com/free/docs/free-cloud-features) in
> `us-west1`, `us-central1`, or `us-east1`. You will not be charged as long as
> you stay within these limits. GCP also gives $300 in free credit for the first
> 90 days, and **will not auto-charge** after the trial — resources simply stop
> unless you manually upgrade to a paid billing account.

---

## Part 1 — Create a GCP Account & Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and sign in with your Google account.
2. You will be prompted to start the **Free Trial** — accept and provide a credit card for identity verification.
   > ⚠️ You will NOT be charged. GCP uses the card for identity verification only.
   > After the $300 credit / 90 days expire, resources stop unless you manually upgrade.
3. A default project ("My First Project") is created automatically. You can rename it or use it as-is.

---

## Part 2 — Create a Free Tier VM

1. In the GCP Console, go to **Compute Engine** → **VM instances**.
   - If prompted, enable the Compute Engine API (may take a minute).
2. Click **Create Instance**.
3. Configure as follows:

   | Setting | Value |
   |---|---|
   | **Name** | `cwl-proxy` |
   | **Region** | `us-central1` (Iowa) — or `us-west1` / `us-east1` |
   | **Zone** | Any available zone (e.g., `us-central1-a`) |
   | **Provisioning model** | **Standard** (Do NOT use Spot/Preemptible) |
   | **Machine type** | `e2-micro` (0.25–2 vCPU, 1 GB RAM) — **Always Free eligible** |
   | **Boot disk** | Ubuntu 22.04 LTS, 30 GB Standard persistent disk |
   | **Firewall** | ✅ Allow HTTP traffic, ✅ Allow HTTPS traffic |

### 🛠️ UI Navigation Tips (If you can't see the options below):
*   **Provisioning Model**: This is often the first thing under "Machine configuration". Choose **Standard**.
*   **Boot Disk**: Scroll down past the machine settings. Look for a section titled **"Boot disk"**. Click the **CHANGE** button to select **Ubuntu 22.04 LTS** and **30 GB Standard Persistent Disk**.
*   **Firewall**: Scroll near the very bottom of the page. Look for the **"Firewall"** section and check both **"Allow HTTP traffic"** and **"Allow HTTPS traffic"**. (If it's still missing, click "Networking, disks, security..." at the bottom to expand more options).

4. Click **Create**. Wait for the VM to start (~30 seconds).
5. Note the **External IP** shown in the VM instances list — this is your static IP.

> 💡 By default, GCE assigns an **ephemeral** external IP. To make it truly static
> (survives VM restarts), go to **VPC network** → **IP addresses** → click
> **Reserve** next to your VM's IP. This is free for IPs attached to running VMs.

---

## Part 3 — Connect & Install Node.js

1. In the VM instances list, click the **SSH** button next to your VM. This opens a browser-based terminal.
   *(Alternatively, use your own terminal: `gcloud compute ssh cwl-proxy --zone=us-central1-a`)*

2. Once connected, **install basic utilities and Node.js**:
   ```bash
   # 1. Install Git and Nano (text editor)
   sudo apt-get update && sudo apt-get install git nano -y

   # 2. Install Node.js using NVM (Node Version Manager)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   source ~/.bashrc
   nvm install 20
   ```

3. Verify installation:
   ```bash
   git --version    # Should print git version 2.x.x
   node --version   # Should print v20.x.x
   npm --version    # Should print 10.x.x
   ```

---

## Part 4 — Clone the Repository

1. **Clone your project** from GitHub into the GCE VM:
   ```bash
   git clone https://github.com/sobanali2006/CWL-Bonus-Distr.git
   ```
   > 🔑 **Private Repository Instructions:**
   > 1. When prompted for **Username**, enter your GitHub username.
   > 2. When prompted for **Password**, paste a [GitHub Personal Access Token (PAT)](https://github.com/settings/tokens). 
   >    *Note: Your regular GitHub password will NOT work for cloning.*
   > 3. To save your credentials so you don't have to paste them every time:
   >    `git config --global credential.helper store`

2. Navigate to the proxy directory:
   ```bash
   cd CWL-Bonus-Distr/proxy-server
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

---

## Part 5 — Configure the Environment

The proxy needs a Clash of Clans API Token to authenticate requests.

1. Open the `.bashrc` file to set your token permanently:
   ```bash
   nano ~/.bashrc
   ```
2. Scroll to the very bottom and add this line, replacing `your_token_here` with a **placeholder** (we will get the real token in Part 7):
   ```bash
   export COC_API_TOKEN="your_token_here"
   ```
3. Save and exit (Press `Ctrl+O`, `Enter`, then `Ctrl+X`).
4. Apply the changes:
   ```bash
   source ~/.bashrc
   ```

---

## Part 6 — Open Firewall Rules (CRITICAL)

Modern Google Cloud uses **Firewall Policies** to control traffic. You must create a rule to allow Port 3000.

1. Go to **VPC network** → **Firewall policies**.
2. Click **Create Firewall Policy**.
   - **Name:** `allow-proxy-policy`
   - **Type:** VPC policy
   - **Deployment scope:** Global
3. Once created, click on the policy name to **Add a Rule**:

| Setting | Value |
|---|---|
| **Priority** | `1000` |
| **Direction** | Ingress |
| **Action** | Allow |
| **Target** | Apply to all |
| **Source IPv4 ranges** | `0.0.0.0/0` |
| **Protocols and ports** | Specified protocols → TCP → `3000` |

4. **CRITICAL:** Click **Create**, then go to the **Associations** tab and click **Add Association**. Select your **`default`** network. Without this, the rule will not apply to your VM.

---

## Part 7 — Generate CoC Token & Start Server

1. Go to the [CoC Developer Portal](https://developer.clashofclans.com/).
2. Create a new key and whitelist your **GCE VM's External IP address** (from Part 2).
3. Copy the generated Token.
4. Back in your SSH terminal, update your `.bashrc` file, replacing the placeholder with the real token:
   ```bash
   nano ~/.bashrc
   # Update the COC_API_TOKEN value, save, exit
   source ~/.bashrc
   ```

### Start the Proxy Permanently
We use `pm2` so the server stays running even when you close the SSH window.
```bash
npm install -g pm2
pm2 start server.js --name "cwl-proxy"
pm2 startup    # Generates a command to auto-start pm2 on VM reboot — run the output command
pm2 save       # Saves the current process list so it persists across reboots
```

To verify it's working, visit in your browser on your computer:
`http://YOUR_GCE_EXTERNAL_IP:3000/health`
If you see `{"status":"ok"}`, your proxy is perfectly set up!

---

## Part 8 — Configure Your Electron App

Update your **local** `api_config.json` on your Windows machine to point to your new GCP server.

```json
{
  "apiToken": "any_valid_token_for_fallback",
  "proxyUrl": "http://YOUR_GCE_EXTERNAL_IP:3000"
}
```

Start your Electron app. When you click "Fetch", it will seamlessly route through your dedicated GCE IP!

---

## Maintenance Notes

| Task | How |
|---|---|
| **Check server status** | SSH in, run `pm2 status` |
| **View logs** | `pm2 logs cwl-proxy` |
| **Restart server** | `pm2 restart cwl-proxy` |
| **Update code** | `cd CWL-Bonus-Distr && git pull && cd proxy-server && npm install && pm2 restart cwl-proxy` |
| **Monitor GCP costs** | Console → **Billing** → should always show $0.00 for e2-micro |

> 💡 Unlike Render.com, the GCE VM is **always on** — no cold starts. Your proxy
> responds instantly on every request.
