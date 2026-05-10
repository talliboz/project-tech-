# Techinno AR Fault Detection Prototype

Techinno is a coursework prototype for an AR-assisted public transport fault detection system. It demonstrates a React frontend, an authenticated dashboard, and a small Express backend that serves role-based dashboard data.

This is a TRL 3 proof of concept. The AR camera is designed for demo use, not production fault detection.

## Project Structure

```text
techinno/
├── backend/        Express API, authentication, dashboard data
├── dashboard/      Shared dashboard and AR camera React views
├── frontend-ar/    React and Vite frontend
└── docs/           Supporting project documents
```

## Tech Stack

- React 
- Vite
- JavaScript
- Biome
- Express
- JSON Web Tokens
- MediaPipe Tasks Vision

## APIs Used

### Backend API

The frontend talks to the local Express API through Vite's `/api` proxy.

- `POST /api/login` authenticates a user and returns a JWT.
- `GET /api/dashboard` returns total faults, severity counts, and recent fault reports.
- `POST /api/dashboard/faults` lets engineers submit a fault report.
- `DELETE /api/dashboard/faults/:id` lets admins delete a fault report.

### MediaPipe Tasks Vision

The AR camera uses `@mediapipe/tasks-vision` in the browser.

- `HandLandmarker` is used to track hand landmarks for demo fault triggers.
- `FaceDetector` is used to track face bounding boxes for demo fault triggers.

The models are loaded from Google-hosted MediaPipe model URLs. This keeps the prototype lightweight and avoids needing a custom trained model for the demo.

## Prerequisites

Install Node.js first. Use the current LTS version if possible.

Check your version:

```bash
node -v
npm -v
```

## Backend Setup

From the repo root:

```bash
cd backend
npm install
cp .env.example .env
npm start
```

The backend runs on:

```text
http://localhost:5050
```

### Backend Environment

`backend/.env` should contain:

```text
JWT_SECRET=replace-with-a-long-random-secret
PORT=5050
USER_STORE_PATH=
```

`USER_STORE_PATH` can be left empty to use the default local user store.

## Frontend Setup

Open a second terminal from the repo root:

```bash
cd frontend-ar
npm install
cp .env.example .env
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

### Frontend Environment

`frontend-ar/.env` should contain:

```text
VITE_DASHBOARD_API_URL=/api/dashboard
```

The Vite proxy sends `/api` requests to the backend on port `5050`.

## Demo Accounts

Use these accounts for local testing:

```text
admin / admin123
engineer / engineer123
viewer / viewer123
```

## Available Frontend Commands

Run these from `frontend-ar/`:

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run preview
```

## Available Backend Commands

Run these from `backend/`:

```bash
npm start
npm run hash-password
```

## Main Features

- Login with role-based access.
- Dashboard page with total fault count, severity summaries, and recent reports.
- AR Camera page with browser camera access and MediaPipe-powered demo tracking.
- Settings page with theme controls and sample fault submission for engineers.
- Admin fault deletion from the dashboard.
- Light and dark theme support.

## AR Camera Demo Behaviour

The AR Camera page links camera detections to the existing dashboard faults:

- Raised right hand: `Track signal fault`
- Raised left hand: `Door sensor failure`
- Face detection: `Lighting outage`

The overlay boxes are visual prototype annotations. They show how an AR system could highlight detected faults in a live camera feed.

## Notes

- Camera access requires `localhost` or HTTPS.
- The first AR scan may take a few seconds while MediaPipe loads its WASM and model files.
- The prototype depends on internet access for MediaPipe model loading.
- This project uses npm commands.
