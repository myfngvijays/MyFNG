# MyFNG Domain Cutover Runbook (`myfng.cloud` -> `myfng.in`)

## 1) DNS (GoDaddy)

Update GoDaddy DNS for `myfng.in`:

- `A` record: `@` -> `72.61.224.186`
- `A` record: `www` -> `72.61.224.186` (or `CNAME` to `@`)
- TTL: `600` during migration (can increase later)

Verify propagation:

```bash
dig +short myfng.in
dig +short www.myfng.in
dig +short myfng.cloud
dig +short www.myfng.cloud
```

Expected:

- `myfng.in` and `www.myfng.in` resolve to VPS IP.
- `myfng.cloud` may still resolve to VPS (kept for redirect continuity).

## 2) Nginx + SSL

Primary app domain:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name myfng.in www.myfng.in;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Old domain redirect:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name myfng.cloud www.myfng.cloud;
    return 301 https://myfng.in$request_uri;
}
```

SSL commands:

```bash
sudo certbot --nginx -d myfng.in -d www.myfng.in
sudo certbot --nginx -d myfng.cloud -d www.myfng.cloud
sudo certbot renew --dry-run
```

## 3) App Configuration

Set production env values:

- Web: `NEXT_PUBLIC_APP_URL=https://myfng.in`
- Web: `NEXT_PUBLIC_API_URL=https://myfng.in`
- Web: `APP_URL=https://myfng.in` (if used by deployment)
- Web: `INTERNAL_APP_ORIGIN=https://myfng.in` (if used)
- Mobile: `EXPO_PUBLIC_API_URL=https://myfng.in`

## 4) Third-Party Updates

- Firebase Auth -> Authorized domains:
  - `myfng.in`
  - `www.myfng.in`
- Razorpay:
  - webhook URL
  - callback/success/failure URLs
  - any dashboard redirect URLs
- Supabase Auth (if enabled for redirects):
  - site URL: `https://myfng.in`
  - add redirect URL entries for `https://myfng.in/*`
  - keep old domain redirects only as needed during transition
- Search Console / Analytics:
  - add and verify `myfng.in`
  - monitor coverage, crawl errors, and traffic split

## 5) Post-Cutover Validation

Run a smoke pass:

- `https://myfng.in` opens with valid SSL
- `https://www.myfng.in` opens (or redirects to apex)
- `https://myfng.cloud/login` -> `301` to `https://myfng.in/login`
- Login/OTP flows work
- Payment and invoice links generate under `myfng.in`
- No mixed-content or CORS errors in browser console

## 6) `.cloud` Shutdown Policy

`myfng.cloud` automatically band nahi hota jab tak renewal active hai.

Recommended:

- Keep `myfng.cloud` in 301 redirect mode for at least 3-6 months.
- Only then consider decommissioning based on traffic/log evidence.
