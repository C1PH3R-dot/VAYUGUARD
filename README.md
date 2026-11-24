# 🌬️ VayuGuard (वायु गार्ड)
### Urban Air Quality & Winter Smog Assistant

[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**VayuGuard** is a responsive, lightweight, production-ready web application designed to help individuals, households, and urban communities mitigate the health risks of hazardous air pollution and seasonal winter smog crises. 

Combining **100% live Open-Meteo telemetry**, a **deterministic 2024 US EPA AQI engine**, **atmospheric thermal inversion analysis**, and an **action-oriented exposure tracker**, VayuGuard pairs real-time scientific telemetry with an interactive **Gemini AI Environmental Health Advisor** strictly grounded in live local data.

---

## 🌟 Key Features

### 1. 100% Real-Time Open-Meteo Telemetry
- **No static snapshots or mocked data**: Fetches live pollutant levels and weather parameters directly on load or location change.
- **Pollutants Monitored**: PM2.5, PM10, Nitrogen Dioxide ($\text{NO}_2$), Ozone ($\text{O}_3$), Sulphur Dioxide ($\text{SO}_2$), and Carbon Monoxide ($\text{CO}$).
- **Meteorological Indicators**: Ambient temperature, relative humidity, wind speed, and diurnal temperature differentials.
- **Global Search & Geolocation**: Browser auto-detection (`navigator.geolocation`) with instantaneous geocoding search for any city globally via Open-Meteo Geocoding API.
- **In-Memory Caching & Telemetry Drawer**: 5-minute TTL caching with a live Telemetry Drawer displaying exact endpoints, latency, and response status.

### 2. 2024 US EPA AQI & Exposure Engine
- **Piecewise Linear Interpolation**: Implements exact EPA standard breakpoints across PM2.5 concentrations, including revised 2024 standards.
- **Built-in Diagnostic Test Suite**: An interactive verification modal executing unit assertions across edge-case breakpoints to prove mathematical accuracy.
- **Tailored Health Advisories**: Categorization into *Good*, *Moderate*, *Unhealthy for Sensitive Groups (USG)*, *Unhealthy*, *Very Unhealthy*, and *Hazardous*.

### 3. Atmospheric Inversion & Clean-Air Window Analyzer
- **Thermal Inversion Risk Detection**: Automatically correlates low ground wind speeds ($< 6 \text{ km/h}$), high relative humidity ($> 75\%$), and nocturnal/morning cooling to alert users when a cold air blanket traps particulate matter near the ground.
- **Optimal 3-Hour Clean Air Window**: Scans 48-hour hourly forecasts to identify the cleanest upcoming 3-hour window for opening windows, outdoor chores, or aerobic exercise.
- **Peak Smog Window Warning**: Flags the highest-risk hours to avoid outdoor exposure.

### 4. Household Sensitivity & Commute Profiling
- **Vulnerability Groups**: Customize recommendations for **Children** (developing lung alveoli), **Elderly** (cardiovascular strain), **Asthma / Respiratory Conditions** (bronchial hyperreactivity), **Outdoor Workers** (prolonged high tidal volume), and **General Public**.
- **Commute Context**: Tailors guidance based on commute mode (Metro/Subway, Closed Car with Cabin Filter, Bus/Auto-rickshaw, Walking/Cycling).
- **Home Setup**: Adjusts indoor safety measures based on current setup (HEPA-filtered, Basic AC/Closed, Natural Cross-ventilation).

### 5. Action Planner & Exposure Impact Quantifier
- **Interactive Action Checklist**: Select high-impact mitigation steps (e.g., shifting morning exercise, DIY box fan filter, N95 fitted respirator, dynamic window sealing).
- **Measurable Metrics**:
  - Estimated PM2.5 exposure reduction percentage ($\%$).
  - Inhaled particulate mass avoided per day ($\mu\text{g/day}$).
  - Weekly household carbon footprint reduction ($\text{kg CO}_2\text{/week}$).

### 6. Strictly Grounded Gemini AI Advisor
- **Context-Locked Prompting**: Injects live telemetry (AQI, exact $\mu\text{g/m}^3$ concentrations, weather, safest clean window, household vulnerability, active commitments) into the system prompt.
- **No Hallucinations**: Constrained to never invent fake pollution numbers or contradict verified sensor readings.
- **Dual API Key Configuration**: Provide an API key via environment variables (`.env`) or securely via the in-app "Connect Gemini Key" session modal (stored only in ephemeral browser `sessionStorage`).

### 7. Modern, Accessible UI
- Built with **Tailwind CSS** supporting high-contrast Dark and Light modes.
- Accessible SVG custom radial gauges, hourly trend charts, and screen-reader announcements (`aria-live="polite"`).
- Lightweight icons from **`lucide-react`**.

---

## 🏗️ Architecture & Project Structure

```
vayuguard/
├── .env.example              # Template for environment variables
├── .gitignore                # Git exclusions (node_modules, dist, .env, etc.)
├── index.html                # Vite HTML entry point
├── package.json              # Project dependencies & scripts
├── postcss.config.js         # PostCSS configuration for Tailwind
├── tailwind.config.js        # Tailwind CSS configuration (dark mode: 'class')
├── tsconfig.json             # TypeScript root compiler configuration
├── tsconfig.node.json        # TypeScript configuration for Vite configs
├── vite.config.ts            # Vite bundler configuration
├── src/
│   ├── App.tsx               # App root wrapper component
│   ├── main.tsx              # React DOM mounting entry point
│   ├── index.css             # Tailwind base styles and directives
│   ├── vite-env.d.ts         # Vite client type definitions
│   └── VayuGuard.tsx         # Complete VayuGuard core engine & UI component
└── README.md                 # Project documentation
```

---

## ⚡ Live API Integrations

### 1. Open-Meteo APIs (Free & Open Access)
No API key required! VayuGuard queries:
- **Geocoding**: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=6`
- **Air Quality**: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&hourly=pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto&forecast_days=2`
- **Weather Forecast**: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`

### 2. Google Gemini API
Powered by `gemini-2.0-flash` (via Google Generative Language API).
- **Environment Variable**: Set `VITE_GEMINI_API_KEY` in your `.env` file for automatic deployment.
- **In-App Modal**: Users can click **"Connect Gemini Key"** in the navigation bar to enter their Google AI Studio API key at runtime. The key is stored in `sessionStorage` and never transmitted to any third party.
- **Graceful Fallback**: If no Gemini API key is provided, the full dashboard, air quality calculations, hourly trends, action planner, and telemetry remain 100% operational.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0.0 or higher recommended)
- `npm`, `pnpm`, or `yarn`

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/C1PH3R-dot/VAYUGUARD.git
cd VAYUGUARD
npm install
```

### 2. Configure Environment Variables (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Gemini API Key if you want AI capabilities pre-configured:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```
*(Get an API key from [Google AI Studio](https://aistudio.google.com/))*

### 3. Start Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### 4. Type Checking & Production Build
```bash
# Run TypeScript type check
npm run typecheck

# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

The production output will be generated inside the `dist/` directory (~75 kB gzipped total).

---

## 🌐 Deployment Guide

VayuGuard is an optimized Single Page Application (SPA) that can be deployed to any static host in seconds:

### Deploy to Vercel
1. Install Vercel CLI or import the repository on [Vercel](https://vercel.com).
2. Set Build Command: `npm run build`
3. Set Output Directory: `dist`
4. Add Environment Variable:
   - `VITE_GEMINI_API_KEY`: `your_key` (optional)
5. Deploy!

### Deploy to Netlify
1. Import repository on [Netlify](https://www.netlify.com).
2. Build command: `npm run build`
3. Publish directory: `dist`
4. In **Site Configuration > Environment Variables**, add `VITE_GEMINI_API_KEY` (optional).
5. Deploy site!

### Deploy to Cloudflare Pages
1. In Cloudflare Dashboard, navigate to **Workers & Pages > Create application > Pages > Connect to Git**.
2. Select repository, choose `Vite` preset:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Add `VITE_GEMINI_API_KEY` under Environment variables if desired.
4. Click **Save and Deploy**.

### Deploy to GitHub Pages
1. In `vite.config.ts`, ensure `base` is configured if deploying to a subpath (e.g., `base: '/vayuguard/'`).
2. Add a GitHub Actions workflow to run `npm run build` and publish the `dist` artifact to GitHub Pages.

---

## 📦 Repository Footprint

- **Ultra-lightweight**: Repository source code is **under 400 KB** (far below the 10 MB limit).
- **Clean Git Tracking**: `.gitignore` strictly excludes `node_modules`, `dist`, local environment files (`.env*`), and debug logs.
- **Fast CI/CD**: Cold builds complete in under 5 seconds.

---

## 🛡️ License

This project is licensed under the [MIT License](LICENSE).
Feel free to use, modify, and distribute for public health and environmental awareness.
