# GATE mock test tracker — deployment guide

A static site (no backend server, no paid disk) that stores your mock test
data in a free Supabase database. Hosted free on Vercel.

Files:
- `index.html` — page structure and styling
- `app.js` — logic (talks to Supabase)
- `config.js` — your Supabase project URL + key (you fill this in)
- `supabase-setup.sql` — run once to create your database tables

---

## Part 1 — Create your free database (Supabase)

1. Go to https://supabase.com and sign up (free, no card needed).
2. Click **New project**. Pick any name and a database password (save it
   somewhere), choose the region closest to you, and create it. Wait
   ~2 minutes for it to provision.
3. In the left sidebar, open **SQL Editor** → **New query**.
4. Open `supabase-setup.sql` from this folder, copy all of it, paste it into
   the query editor, and click **Run**. This creates the `mock_tests` and
   `settings` tables.
5. In the left sidebar, open **Settings → API**. Copy two values:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key (a long string under "Project API keys")
6. Open `config.js` in this folder and paste them in:
   ```js
   const SUPABASE_URL = "https://abcdxyz.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```

That's your entire backend — free tier, no disk purchase, up to 500MB
database and 5GB bandwidth/month, which is far more than a personal
tracker needs.

---

## Part 2 — Test it locally (optional but recommended)

You can't just double-click `index.html` because browsers block some
requests from `file://` URLs. Instead, from this folder run any tiny local
server, for example (if you have Python installed):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser and try adding a test.
Skip this step if you'd rather just deploy and test live.

---

## Part 3 — Put the code on GitHub

1. Go to https://github.com and sign up if you don't have an account.
2. Click **New repository**, name it e.g. `gate-tracker`, keep it public
   or private (either works), and create it.
3. Upload these files to the repo — easiest way if you're not using git
   commands: on the repo page click **Add file → Upload files**, drag in
   `index.html`, `app.js`, and `config.js` (with your real keys already
   pasted in), then **Commit changes**.

(If you're comfortable with git: `git init`, `git add .`,
`git commit -m "init"`, `git remote add origin <your-repo-url>`,
`git push -u origin main`.)

---

## Part 4 — Deploy to Vercel (free)

1. Go to https://vercel.com and sign up using your GitHub account.
2. Click **Add New → Project**.
3. Select the `gate-tracker` repo you just created and click **Import**.
4. Framework preset: choose **Other** (it's a static site, no build step
   needed). Leave build settings blank.
5. Click **Deploy**. In about 30 seconds you'll get a live URL like
   `https://gate-tracker-yourname.vercel.app` — that's your public site,
   free, anyone can open it.

Every time you push a change to the GitHub repo, Vercel redeploys
automatically.

### Optional: your own domain
In the Vercel project → **Settings → Domains**, add a domain you own and
follow the DNS instructions shown. Vercel's free tier includes this.

---

## Notes on this setup

- **No login/auth** is implemented — anyone with the site URL can add or
  delete entries, since it's built for personal use. If you want to lock
  it down later, Supabase has free built-in auth (email/password or magic
  link) and you'd tighten the SQL policies in `supabase-setup.sql` to
  check `auth.uid()`. Ask me if you want this added.
- Your **anon key** in `config.js` is meant to be public-safe (it's
  restricted by the row-level-security policies you ran in the SQL step),
  but don't publish your database **password** or **service role key**
  anywhere — those stay private.
- If you outgrow Vercel/Supabase free tiers (very unlikely for personal
  use), both have inexpensive paid tiers you can move to only when needed
  — no upfront disk purchase required.
