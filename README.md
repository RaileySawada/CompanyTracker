# Company Tracker

A serverless React app for tracking company locations, open positions, live directions, and arrival status.

## Features

- View and edit pages
- Add company name, optional positions, and required location
- Paste coordinates or a Google Maps URL that contains latitude and longitude
- Browser geolocation watches the user's live position
- Google Maps embed previews locations and directions
- Arrival banner appears when the user is within 90 meters of the company
- Shared company data is stored with Netlify Blobs through a Netlify Function
- Browser local storage is only used as a fast fallback cache

## Development

```bash
npm install
npm run dev
```

Use `netlify dev` when you want to test the shared `/api/companies` function locally.

## Build

```bash
npm run build
```

## Netlify

Netlify can use the included `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirects are configured so `/view` and `/edit` load correctly
- `/api/companies` is routed to `netlify/functions/companies.cjs`

The app is serverless: Netlify serves the React build, and the shared map/company list is read and written by a serverless function using Netlify Blobs. There is no always-running backend server.
