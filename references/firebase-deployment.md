# Firebase synchronization and deployment

## Security model

This app intentionally has no account screen. It signs each device into Firebase anonymously and shares one Firestore document. The model is link-based trust, not privacy: anyone who can load the deployed app may be able to read and edit the shared trip.

Do not store sensitive bookings, identity documents, payment data, service-account credentials, or private keys. Firebase web configuration is public client metadata and belongs in the browser; an Admin SDK/service-account file never does.

## Firebase project setup

Use a new Firebase project for a new trip unless the user explicitly chooses an existing project. It can live under the same Google/Firebase account. Use the new app owner's account, never an identifier or credential copied from another trip.

**Existing-project warning:** the generated rules allow only this trip document and deny other paths. Deploying them to an existing default Firestore database replaces its rules and can break other apps. Prefer a dedicated project. If the user specifically chooses a shared project, inspect and merge its existing rules deliberately before deployment; do not overwrite them with this template's rules.

In Firebase:

1. Create or select the project.
2. Add a Web app and copy its public web configuration.
3. Enable Authentication → Anonymous sign-in.
4. Create the default Firestore database in the intended region, initially in production/locked mode. Record that exact location in `sync.firestoreRegion`; the generator otherwise defaults to `nam5`.
5. Enable Firebase Hosting.

Put only the public Web app fields in `sync.firebaseConfig`. Use an unguessable document ID, for example a trip slug plus 24 random hex characters.

Enable Anonymous Authentication in the Firebase console explicitly. The generated configuration file is not evidence that the provider is enabled. If Firebase requires an authorized domain for your preview or custom host, add only the intended host in Authentication settings. Verify any plan/quota/billing requirements in your own console before enabling paid services; do not upgrade billing without user authorization.

## Generate and validate

After Firebase values are in the authoring JSON:

```bash
node scripts/validate-trip.mjs /absolute/path/to/trip.json
node scripts/init-trip.mjs /absolute/path/to/trip.json /absolute/path/to/output
node scripts/qa-static.mjs /absolute/path/to/output
```

The generated `firestore.rules` allows anonymous authenticated access only to the configured document and validates its broad structure. The first online client can create that document; later edits update it transactionally.

## CLI deployment

Install the official CLI with a maintained Node.js release compatible with the current `firebase-tools` package. Its engine requirement can be checked before installation; do not bypass an engine mismatch with `--force`. See the [official Firebase CLI setup](https://firebase.google.com/docs/cli).

```bash
node --version
npm view firebase-tools engines
npm install -g firebase-tools
firebase --version
firebase login
firebase projects:list
```

Login is interactive and uses the user's own Google account. For a remote terminal without a local browser, use `firebase login --no-localhost`. Do not ask for a token or service-account key in chat.

After confirming the project ID against the console and the generated web configuration, run from the **generated output directory** (replace `YOUR_PROJECT_ID` with that confirmed project):

```bash
firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,firestore:indexes,hosting
```

Use the explicit `--project` on every deployment so a stale CLI default cannot target a different app. Do not run `firebase init` over the generated files or deploy from the reusable skill repository itself. Firebase CLI's returned Hosting URL is the authoritative result; do not claim deployment succeeded until the command and a browser load both succeed.

The generated `.firebaserc` is environment-specific and should not be committed to the reusable skill. Keep `.firebase/` deployment state out of source control.

## Live verification

After deploy:

1. Load the hosted URL in two independent browser profiles or devices.
2. Confirm both reach “Synced.”
3. Add, edit, and complete a checklist item in one client; verify the other updates.
4. Add a plan with a valid full Maps URL; verify the other client receives its title, marker, and map link.
5. Edit its time, type, Booked state, and note; verify ordering and tags.
6. Delete the test plan and verify removal on both clients.
7. Reload both clients and confirm persistence.
8. Inspect browser console and Firestore rules errors.

Also verify language changes remain device-local, while shared trip edits synchronize.

## Hosting and PWA verification

- Open `/manifest.webmanifest` and confirm name, short name, colors, and icons.
- Confirm the service worker installs without missing-asset errors.
- Load once, go offline, and verify the written itinerary shell still opens.
- Confirm maps, live weather, and remote photos recover after reconnecting.
- On iPhone Safari, use Add to Home Screen and verify the icon, short label, standalone safe areas, and planner gesture.

## Updates

Keep `sync.documentPath` unchanged when regenerating the same trip. Changing it creates a separate shared board.

For content changes, regenerate from the authoring JSON. For template-only code/style changes in an already generated app, run:

```bash
node scripts/bump-cache.mjs /absolute/path/to/output
node scripts/qa-static.mjs /absolute/path/to/output
firebase deploy --project YOUR_PROJECT_ID --only hosting
```

Deploy Firestore rules again whenever the synchronized schema or rules change.
