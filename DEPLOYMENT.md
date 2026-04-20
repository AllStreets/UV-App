# Deployment Guide

This project is a static web app. There is no build step, package install, or backend required.

## What To Deploy

Deploy these files at the repository root:

```text
index.html
styles.css
app.jsx
data.jsx
icons.jsx
panels.jsx
wheel.jsx
check2.png
```

`Solace UV.html` is also included as a self-contained reference version, but `index.html` is the recommended deploy entrypoint.

## Recommended: GitHub Pages

### 1. Push the repository to GitHub

Make sure the repo contains `index.html` at the root.

### 2. Enable Pages

In GitHub:

1. Open the repository
2. Go to `Settings`
3. Open `Pages`
4. Under `Build and deployment`, choose:
   `Source: Deploy from a branch`
5. Select:
   `Branch: main`
   `Folder: / (root)`
6. Save

GitHub will publish the app at a Pages URL for the repo.

## Other Static Hosts

This app also works on:

- Netlify
- Vercel
- Cloudflare Pages
- Firebase Hosting
- any Nginx / Apache static host

### Host Requirements

- Serve the repo root as static files
- Use `index.html` as the default document
- Do not require a build command

## Notes About Data

The app fetches live forecast data from Open-Meteo at runtime in the browser.

That means:

- no server secrets are required
- no backend deployment is required
- the deployed site needs normal outbound internet access from the user’s browser

If the live request fails, the app falls back to simulated data so the UI still works.

## Optional Local Verification

Before deploying, you can verify locally with:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Troubleshooting

### Blank page or wrong entry file

Make sure `index.html` exists at the root of the deployed site.

### Live data not loading

Check:

- browser network access
- CORS or content-security-policy restrictions from the host
- whether the Open-Meteo request is being blocked

### Styling or scripts missing

Make sure the host publishes the entire repo root, not only `index.html`.
