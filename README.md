# Company Tracker

A serverless React app for tracking company locations, open positions, live directions, and arrival status.

## Features

- View and edit pages
- Add company name, optional positions, and required location
- Paste coordinates or a Google Maps URL that contains latitude and longitude
- Browser geolocation watches the user's live position
- Google Maps embed previews locations and directions
- Arrival banner appears when the user is within 90 meters of the company
- Shared company data and live visitor presence are stored in Firebase Realtime Database
- The app starts empty unless Firebase has saved company data

## Development

```bash
npm install
npm run dev
```

Create a `.env.local` file from `.env.example` and fill it with the Firebase web app config.

## Build

```bash
npm run build
```

## Netlify

Netlify can use the included `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirects are configured so `/view` and `/edit` load correctly
- Add the `VITE_FIREBASE_*` values from `.env.example` in Netlify site environment variables

Netlify serves the React build, while Firebase Realtime Database stores shared company data and live visitor presence. There is no always-running backend server.
