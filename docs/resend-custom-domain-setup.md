# Custom Domain Email Setup Guide for `lucasandlianne.com` (via Resend)

This guide walks you through setting up custom domain email sending for **`lucasandlianne.com`** using **[Resend](https://resend.com)** so your Cloudflare Worker can reliably send wedding RSVP confirmations from `Lucas & Lianne <rsvp@lucasandlianne.com>` directly to guests' primary inboxes.

---

## 1. Create a Resend Account & Add Your Domain

1. **Sign Up (Free)**:
   - Go to [resend.com/signup](https://resend.com/signup).
   - Create your account (the free tier provides **3,000 emails/month** and **100 emails/day**, with no credit card required).
2. **Add Your Domain**:
   - In the left sidebar, navigate to **Domains** (or visit [resend.com/domains](https://resend.com/domains)).
   - Click the **Add Domain** button in the top right.
   - Enter your domain: `lucasandlianne.com`.
   - **Region**: Select **US East (N. Virginia)** (`us-east-1`) (recommended for North American traffic).
   - Click **Add**.
   - Resend will now display a table of DNS records needed for domain verification and authentication.

---

## 2. Add DNS Records at Your DNS Provider

> **Note on DNS Provider**:
> `lucasandlianne.com` currently uses **Namecheap BasicDNS** (`dns1.registrar-servers.com`). If you manage your DNS on Namecheap:
> 1. Log in to [Namecheap](https://www.namecheap.com).
> 2. Go to **Domain List** → click **Manage** next to `lucasandlianne.com`.
> 3. Click the **Advanced DNS** tab.
> 4. Use the **Add New Record** button to enter each record below.
>
> *(If your DNS was transferred to Cloudflare DNS, enter these under Cloudflare > DNS > Records with Proxy status set to **DNS Only**).*

### Summary Table of DNS Records

| Type | Host / Name | Priority | Value / Target | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **TXT** *(or CNAME)* | `resend._domainkey` | — | `k=rsa; p=MIGf...` *(copy exact value from Resend dashboard)* | **DKIM**: Cryptographically signs outbound emails to verify authenticity. |
| **TXT** | `send` | — | `v=spf1 include:amazonses.com ~all` | **SPF**: Authorizes Resend's sending servers for the return-path. |
| **MX** | `send` | `10` | `feedback-smtp.us-east-1.amazonses.com` | **Return-Path MX**: Handles bounce, complaint, and delivery feedback. |
| **TXT** | `_dmarc` | — | `v=DMARC1; p=none;` | **DMARC**: Protects sender reputation and satisfies Gmail/Yahoo requirements. |

---

### Detailed Record Explanations

#### A. DKIM Record (DomainKeys Identified Mail)
- **Type**: `TXT` *(Note: In some dashboards, Resend may provide a `CNAME` instead. Use whichever Type Resend displays in your records tab).*
- **Host / Name**: `resend._domainkey`
  - *Namecheap tip*: Enter only `resend._domainkey` (Namecheap automatically appends `.lucasandlianne.com`).
- **Value**: The full `k=rsa; p=...` key string generated in your Resend dashboard.
- **TTL**: Automatic (or `60 min`).

#### B. SPF & Return-Path MX Records (Isolated Subdomain)
> **Important**:
> Resend intentionally configures SPF and MX on the **`send`** subdomain (`send.lucasandlianne.com`) rather than your root domain.
> This ensures Resend's sending infrastructure **does not conflict** with your root domain's existing Namecheap email forwarding or incoming mailboxes.

1. **SPF TXT Record**:
   - **Type**: `TXT Record`
   - **Host / Name**: `send`
   - **Value**: `v=spf1 include:amazonses.com ~all`
   - **TTL**: Automatic (or `60 min`)

2. **Return-Path MX Record**:
   - **Type**: `MX Record`
   - **Host / Name**: `send`
   - **Priority**: `10`
   - **Value**: `feedback-smtp.us-east-1.amazonses.com`
   - **TTL**: Automatic (or `60 min`)

#### C. DMARC Record
Major inbox providers (Gmail, Yahoo, Apple) require all senders to have an active DMARC policy.
- **Type**: `TXT Record`
- **Host / Name**: `_dmarc`
- **Value**: `v=DMARC1; p=none;`
- **TTL**: Automatic (or `60 min`)

---

### 3. Verify Your Domain in Resend

1. Go back to your Resend dashboard under **Domains** → click **`lucasandlianne.com`**.
2. Click **Verify DNS Records** (or **Verify** button).
3. Status indicators will turn green with a **Verified** badge.
   - *DNS propagation usually completes within 1–5 minutes, but can take up to a few hours depending on TTL.*

---

## 4. Generate Resend API Key & Store as a Cloudflare Secret

Once the domain is verified, generate an API key and store it securely in your Cloudflare Worker environment.

### Step 4.1: Generate the API Key in Resend
1. In the Resend sidebar, click **API Keys** (or go to [resend.com/api-keys](https://resend.com/api-keys)).
2. Click **Create API Key**.
3. Configure the key:
   - **Name**: `wedding-rsvp-worker`
   - **Permission**: **Full access** (or **Sending access** restricted to `lucasandlianne.com`).
   - **Domain**: `lucasandlianne.com`
4. Click **Add**.
5. **Copy the API key immediately** (it begins with `re_...`). Resend will only show this once.

---

### Step 4.2: Save Key to Cloudflare via Wrangler Secret

Run the following command from your terminal in the wedding site repository (or wherever your worker is deployed):

```bash
npx wrangler secret put RESEND_API_KEY
```

When prompted:
```text
✔ Enter a secret value: ****************************************
```
Paste your Resend API key (`re_...`) and press **Enter**.

> **Why `wrangler secret put`?**
> Storing the key as an encrypted Cloudflare secret prevents it from ever being checked into Git or exposed in client-side JavaScript. In your Cloudflare Worker code, it will be automatically injected into `env.RESEND_API_KEY`.

---

## 5. Verification Checklist

- [ ] Resend domain `lucasandlianne.com` status shows **Verified**.
- [ ] SPF, DKIM, and DMARC records pass verification checks.
- [ ] `RESEND_API_KEY` is saved via `npx wrangler secret put RESEND_API_KEY`.
- [ ] Worker sends emails with `from: "Lucas & Lianne <rsvp@lucasandlianne.com>"`.
- [ ] Test RSVP submission receives confirmation in Gmail/Apple Mail with zero spam flags.
