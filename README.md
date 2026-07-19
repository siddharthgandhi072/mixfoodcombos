# MIX — Meals Invented by Xperimenting

A community food-combo blog: static HTML/CSS/JS hosted on GitHub Pages,
backed by Firebase (accounts, database) and EmailJS (approval/rejection
emails). No build tools, no npm, no framework. Post images aren't enabled
yet — see docs/SETUP.md Part A for why and how to turn them on later.

- **First time setting this up?** Start with [docs/SETUP.md](docs/SETUP.md)
  — Firebase/EmailJS setup, running it locally, deploying to GitHub Pages,
  connecting the `mixfoodcombos.com` domain, and managing SEO.
- **Want to understand or change the code?** Read
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — every file explained,
  written for someone comfortable with Python/HTML/CSS but new to
  JavaScript, plus a "how do I change X" cookbook.

## Run it locally

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/index.html>.
