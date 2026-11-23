# Spend & Drive

A personal dashboard for spending and car records. Plain HTML, CSS and JavaScript (no build step), with Supabase for the database and login, and Vercel for hosting.

## File structure

```
spend-drive/
├── index.html              Page structure (both tabs and the login screen)
├── css/
│   ├── base.css            Colours, fonts, dark mode, reset  <- change the look here
│   ├── layout.css          Page frame, header, tabs, grids, cards, summary tiles
│   ├── components.css      Forms, buttons, chips, tables, status pills, tooltip
│   ├── spending.css        Category bars and the six-month chart
│   └── car.css             Service meter and reminders
├── js/
│   ├── config.js           Your Supabase URL and public key  <- the only file you must edit
│   ├── app.js              Starts everything, tabs, routes clicks
│   ├── auth.js             Login screen
│   ├── db.js               All database calls (the only file that talks to Supabase)
│   ├── state.js            Data and selections currently on screen
│   ├── utils.js            Formatting, dates, categories, CSV download
│   ├── spending.js         Spending tab
│   ├── car.js              Car tab
│   └── tooltip.js          Hover tooltips
├── supabase/
│   └── schema.sql          Database tables and security rules (run once)
└── README.md
```

Where to change things:

- **Colours or fonts:** `css/base.css`, the `:root` block at the top.
- **Spending categories:** `CATS` in `js/utils.js`, and the matching list in `supabase/schema.sql` (the `check (category in ...)` line).
- **Service warning distance:** `carStats()` in `js/car.js` (default: "due soon" within 1,500 km or 15% of the interval, whichever is smaller).

## Setup (about 20 minutes)

### 1. Create the database (Supabase)

1. Sign up at supabase.com and create a **New project**. Pick the region closest to you (Singapore is closest to Malaysia) and save the database password somewhere.
2. Open **SQL Editor**, click **New query**, paste everything from `supabase/schema.sql`, and click **Run**. You should see "Success".
3. Open **Authentication -> Users -> Add user -> Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**. This is your login.
4. Turn off public sign-ups so nobody else can create an account: **Authentication -> Sign In / Providers** (the exact label can differ), and switch off **Allow new users to sign up**.
5. Open **Project Settings -> API Keys**. Copy the **Publishable key** (it starts with `sb_publishable_`). Your **Project URL** is on the same settings area (or under **API / Data API**). Do not use the **Secret key**.

### 2. Connect the site to the database

Open `js/config.js` and paste the two values:

```js
export const SUPABASE_URL = 'https://abcdxyz.supabase.co';
export const SUPABASE_KEY = 'your-public-key';
```

Only use the Publishable key (older projects call it the anon key). Never paste the Secret key (or `service_role`) anywhere in this project. The public key is safe here because the security rules from step 1 stop anyone without your login from reading or changing data.

### 3. Try it on your computer

Browsers block JavaScript modules when you double-click `index.html`, so serve the folder instead. In a terminal inside the `spend-drive` folder:

```
npx serve
```

Open the address it prints (usually http://localhost:3000), sign in, add an expense, and refresh the page. It should still be there. (VS Code's "Live Server" extension works too.)

### 4. Put it on the internet (Vercel)

1. Create a new GitHub repository and upload the `spend-drive` folder contents to it (or push with git).
2. In Vercel, click **Add New -> Project**, import that repository.
3. Framework preset: **Other**. Leave Build Command and Output Directory empty. Click **Deploy**.
4. Open the `.vercel.app` address Vercel gives you, on your laptop and phone, and sign in.

From then on, every change you push to GitHub deploys automatically.

### 5. Optional: use a subdomain of your portfolio

In the Vercel project: **Settings -> Domains -> Add**, enter something like `spend.yourdomain.com`, and add the DNS record Vercel shows at wherever your domain is managed.

## Good to know

- **Free projects pause.** Supabase pauses free projects after a week without activity. If the app says it could not load your data, open the Supabase dashboard and restore the project, then refresh.
- **Back up your data.** Use the **Export CSV** buttons now and then. The files open in Excel or Google Sheets.
- **Odometer logic.** The next service is the highest odometer of any record with type "Service" plus your service interval. Repairs and "Other" records never move it.
- **Adding a record raises the odometer.** If a new record has a higher reading than your current odometer, the current odometer updates to match.
- **Sign out** with the button at the top right. Your login is remembered on each device until you do.
