<#
  setup-remaining.ps1
  Run this from the root of your paid-to-poo project to complete the basic setup:
    - Installs DaisyUI & UUID
    - Generates Tailwind & PostCSS configs
    - Creates global styles
    - Creates identity util
    - Stubs _app.js, index.js and API route
#>

# 1. Install missing dependencies
npm install daisyui uuid

# 2. (Re)initialize Tailwind & PostCSS configs
npx tailwindcss init -p

# 3. Write tailwind.config.js
@'
module.exports = {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}"
  ],
  theme: { extend: {} },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light","dark"],
    base: true,
    utils: true
  }
};
'@ | Set-Content -Path "tailwind.config.js"

# 4. Write postcss.config.js
@'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
'@ | Set-Content -Path "postcss.config.js"

# 5. Ensure global styles exist
if (!(Test-Path "src/styles/globals.css")) {
  New-Item -ItemType Directory -Path "src/styles" -Force | Out-Null
  @'
@tailwind base;
@tailwind components;
@tailwind utilities;
'@ | Set-Content -Path "src/styles/globals.css"
}

# 6. Create identity util
if (!(Test-Path "src/utils/identity.js")) {
  New-Item -ItemType Directory -Path "src/utils" -Force | Out-Null
  @'
import { v4 as uuidv4 } from "uuid";

const pooPuns = [
  "SirPoopsALot",
  "DooDooDuke",
  "StoolSurfer",
  "BathroomBandit",
  "CaptainCrapper"
];

export function getIdentity() {
  let username = localStorage.getItem("username");
  let token = localStorage.getItem("token");
  if (!username || !token) {
    username = pooPuns[Math.floor(Math.random() * pooPuns.length)];
    token = uuidv4();
    localStorage.setItem("username", username);
    localStorage.setItem("token", token);
  }
  return { username, token };
}
'@ | Set-Content -Path "src/utils/identity.js"
}

# 7. Stub _app.js
@"
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;
"@ | Set-Content -Path "src/pages/_app.js"

# 8. Stub index.js
@"
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { getIdentity } from '@/utils/identity';

export default function Home() {
  const [identity, setIdentity] = useState({ username: '', token: '' });

  useEffect(() => {
    setIdentity(getIdentity());
  }, []);

  return (
    <>
      <Head>
        <title>Paid-to-Poo</title>
      </Head>
      <div className='min-h-screen flex flex-col items-center justify-center p-4'>
        <div className='card w-full max-w-md bg-base-100 shadow-md'>
          <div className='card-body'>
            <h2 className='card-title'>Welcome, {identity.username}!</h2>
            <p>Your recovery code:</p>
            <div className='badge badge-outline break-all'>{identity.token}</div>
            <p className='mt-2'>Copy or bookmark this code to recover your profile.</p>
          </div>
        </div>
      </div>
    </>
  );
}
"@ | Set-Content -Path "src/pages/index.js"

# 9. Stub pages/api/log.js
if (!(Test-Path "src/pages/api/log.js")) {
  New-Item -ItemType Directory -Path "src/pages/api" -Force | Out-Null
  @"
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }
  const entry = req.body;
  // TODO: validate & rate-limit
  const docRef = await db.collection('pooLogs').add(entry);
  return res.status(200).json({ id: docRef.id });
}
"@ | Set-Content -Path "src/pages/api/log.js"
}

Write-Host "`n🎉 Basic setup complete! Run 'npm run dev' to verify your app launches correctly."
