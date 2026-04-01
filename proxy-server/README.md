# CWL Proxy Server — Oracle Cloud VPS Setup Guide

This guide provides step-by-step instructions to deploy the CoC API proxy on an **Oracle Cloud Free Tier VPS** (running Ubuntu). 
Unlike Render, an Oracle VM gives you a **dedicated static IP address**, which is perfectly compatible with the Clash of Clans API whitelisting requirements.

---

## Part 1 — Connecting & Installing Node.js

1. **Get your VM's Public IP** from the Oracle Cloud Console.
2. **SSH into your VM**. Depending on your OS, use a terminal or PuTTY:
   ```bash
   ssh -i path/to/your/private_key ubuntu@YOUR_ORACLE_IP
   ```
3. Once logged in, **install Node.js** using NVM (Node Version Manager):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   source ~/.bashrc
   nvm install 20
   ```

---

## Part 2 — Clone the Repository

1. **Clone your project** from GitHub into the Oracle VM:
   ```bash
   git clone https://github.com/sobanali2006/CWL-Bonus-Distr.git
   ```
   *(If your repository is private, you will need to authenticate using a GitHub Personal Access Token).*
2. Navigate to the proxy directory:
   ```bash
   cd CWL-Bonus-Distr/proxy-server
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

---

## Part 3 — Configure the Environment

The proxy needs a Clash of Clans API Token to authenticate requests.

1. Open the `.bashrc` file to set your token permanently:
   ```bash
   nano ~/.bashrc
   ```
2. Scroll to the very bottom and add this line, replacing `your_token_here` with a **placeholder** (we will get the real token in Part 5):
   ```bash
   export COC_API_TOKEN="your_token_here"
   ```
3. Save and exit (Press `Ctrl+O`, `Enter`, then `Ctrl+X`).
4. Apply the changes:
   ```bash
   source ~/.bashrc
   ```

---

## Part 4 — Open Firewall Rules (CRITICAL)

By default, Oracle Cloud blocks all incoming traffic. You must explicitly open Port 3000 so your app can reach the proxy.

### A. Oracle Cloud Console (VCN)
1. In Oracle Cloud, go to **Networking** → **Virtual Cloud Networks**.
2. Click your VCN → **Security List** → **Default Security List**.
3. Click **Add Ingress Rules**.
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** TCP
   - **Destination Port Range:** `3000`
4. Click **Add Ingress Rules**.

### B. Ubuntu Host Firewall (iptables)
Run these commands in your SSH terminal to open the port on the machine itself:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save
```

---

## Part 5 — Generate CoC Token & Start Server

1. Go to the [CoC Developer Portal](https://developer.clashofclans.com/).
2. Create a new key and whitelist your **Oracle VM's Public IP address**.
3. Copy the generated Token.
4. Back in your SSH terminal, update your `.bashrc` file again, replacing the placeholder with the real token you just copied. 
   ```bash
   nano ~/.bashrc
   # update the token, save, exit
   source ~/.bashrc
   ```

### Start the Proxy Permanently
We use `pm2` so the server stays running even when you close the SSH window.
```bash
npm install -g pm2
pm2 start server.js --name "cwl-proxy"
```

To verify it's working, visit in your browser on your computer:
`http://YOUR_ORACLE_IP:3000/health`
If you see `{"status":"ok"}`, your proxy is perfectly set up!

---

## Part 6 — Configure Your Electron App

Update your **local** `api_config.json` on your Windows machine to point to your new Oracle server.

```json
{
  "apiToken": "any_valid_token_for_fallback",
  "proxyUrl": "http://YOUR_ORACLE_IP:3000"
}
```

Start your Electron app. When you click "Fetch", it will seamlessly route through your dedicated Oracle IP!
