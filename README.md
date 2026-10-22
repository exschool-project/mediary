# Mediary

Store. Share. Control.

Mediary is a file hosting and sharing platform: upload files or folders, keep
them private, publish them on your public profile, or hand out a share link
with its own expiration, password, and download limit. Built with Next.js
(App Router), Firebase (Auth, Firestore, Storage), and deployed on Vercel.

---

## 1. Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **Auth:** Firebase Authentication (email/password, optional Google OAuth)
- **Database:** Firestore
- **File storage:** Firebase Storage
- **Server logic:** Next.js API routes using the Firebase Admin SDK
- **Deployment:** Vercel

## 2. How it works, in one page

- Every account gets a **1 GB quota**, enforced with a Firestore transaction
  server-side (`src/lib/server/quota.ts`) — not in the browser. Uploads are
  reserved against the quota *before* any bytes move, and reconciled against
  the real object size in Storage after the upload finishes, so a spoofed
  client-declared size can't create a gap.
- Files are written **directly from the browser to Firebase Storage**
  (so large uploads don't have to pass through a serverless function), but
  only to a path the server already reserved and only while Firestore says
  that path is mid-upload and owned by the caller — enforced in
  `storage.rules`, not just in application code.
- **Firestore itself denies all client reads and writes** (`firestore.rules`).
  Every read or write goes through an authenticated API route using the
  Admin SDK, which is the only thing that can bypass those rules. This is
  the "never rely on frontend authorization" requirement, applied literally.
- Downloads never expose a permanent Storage URL. `/d/[shareId]` first asks
  `/api/download/[token]` for metadata, then — after checking visibility,
  expiration, revocation, password, and usage limits, and atomically
  consuming a one-time/limited link inside a transaction — gets back a
  **60-second signed URL**.
- The Owner Panel (`/owner`) is gated by comparing the authenticated
  Firebase UID against the `MEDIARY_OWNER_UID` environment variable on
  **every** `/api/owner/*` request, not just by hiding the route.

## 3. Local setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local — see section 4
npm run dev
```

## 4. Firebase project setup

1. Create a project at https://console.firebase.google.com.
2. **Authentication** → Sign-in method → enable **Email/Password**. Enable
   **Google** too if you want the optional OAuth button.
3. **Firestore Database** → Create database (production mode is fine — our
   rules deny all client access anyway).
4. **Storage** → Get started, using the default bucket.
5. **Project settings → General → Your apps** → add a **Web app**. Copy the
   `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId` into the `NEXT_PUBLIC_FIREBASE_*` variables.
6. **Project settings → Service accounts** → Generate new private key.
   Open the downloaded JSON and copy:
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` sequences intact;
     wrap the value in quotes when pasting into Vercel)
7. Deploy the security rules and indexes (requires the Firebase CLI):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # select your project
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
   **Do not skip this step or leave the default "allow all" rules in
   place** — `firestore.rules` and `storage.rules` in this repo are what
   actually enforce ownership, quota paths, and access control at the
   database/storage layer.
8. Register your own account through the deployed app's `/register` page,
   then find its UID in **Authentication → Users** and set it as
   `MEDIARY_OWNER_UID`. Redeploy after setting it.

## 5. Deploying to Vercel

```
GitHub repo → Vercel → Import Project → Environment Variables → Deploy
```

1. Push this project to a GitHub repository.
2. In Vercel: **Add New → Project**, import the repo.
3. Under **Settings → Environment Variables**, add every variable from
   `.env.example` (with real values — see section 4). Set
   `NEXT_PUBLIC_APP_URL` to your production URL.
4. Deploy. `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are only ever
   read on the server (`src/lib/firebase/admin.ts`, guarded by the
   `server-only` package) and are never sent to the browser.

## 6. Project structure

```
src/
  app/
    (auth)/login, register, forgot-password
    dashboard/            user dashboard
    files/                file manager (grid/list, folders, search, sort)
    trash/                restore / permanently delete
    owner/                owner panel (users, files, reports, stats)
    u/[username]/         public profile
    d/[shareId]/          download page (public file id or share token)
    api/
      files, files/[id], files/[id]/share, files/upload(+/complete,/abort)
      links/[id]          revoke a share link
      download/[token]    resolve + authorize + sign a download
      users, profile/[username]
      owner/users, owner/files, owner/stats
      reports
  components/              UI: upload modal, share modal, file icons, app shell
  lib/
    firebase/client.ts     browser-safe Firebase config
    firebase/admin.ts      server-only Admin SDK (never imported by client code)
    server/                auth verification, quota transactions, tokens, audit log
  types/                   Firestore document shapes
firestore.rules            deny-all for the client SDK — Admin SDK only
storage.rules               scoped, ownership-checked direct-upload path
```

## 7. Known gaps / TODOs

Marked explicitly rather than faked, per the project's own rule that nothing
should pretend to work:

- **Stale upload cleanup**: if a client abandons an upload after
  `/api/files/upload` reserves quota but before `/complete` or `/abort`
  runs, that reservation sits until manually cleared. A scheduled Vercel Cron
  Function that sweeps `files` docs with `status == "uploading"` older than
  ~1 hour (releasing quota + deleting the doc) should be added before
  production use with untrusted users.
- **Rate limiting** (`#36` in the spec): routes are structured so a rate
  limiter (e.g. Upstash Redis + `@upstash/ratelimit`) can wrap them, but no
  limiter is wired in yet — add one in front of login, upload, download,
  link-creation, and owner routes.
- **Owner stats aggregation**: total storage used and total downloads are
  summed by reading every file document per request. Fine at small scale;
  past a few thousand files, replace with a maintained running-total
  document updated alongside the existing quota/download-count writes.
- **Folder upload structure**: nested folders selected via "Choose Folder"
  are currently stored as flat file records whose display name encodes the
  relative path (`Varelia/gamemodes/main.pwn`), rather than as a real nested
  tree of folder documents. Functionally files are preserved and quota-
  counted correctly; a true folder tree (matching the file manager's
  folder-navigation model) is a follow-up.
- **QR codes / social share buttons** on the download page are optional in
  the spec and not yet implemented.
