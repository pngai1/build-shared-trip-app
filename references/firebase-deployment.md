# Firebase synchronization and deployment

## Security model

This app intentionally has no account screen. It signs each device into Firebase anonymously and shares one Firestore document. The model is link-based trust, not privacy: anyone who can load the deployed app may be able to read and edit the shared trip.

Do not store sensitive bookings, identity documents, payment data, service-account credentials, or private keys. Firebase web configuration is public client metadata and belongs in the browser; an Admin SDK/service-account file never does.

## Firebase project setup

Use a new Firebase project for a new trip unless the user explicitly chooses an existing project. It can live under the same Google/Firebase account.

In Firebase:

1. Create or select the project.
2. Add a Web app and copy its public web configuration.
3. Enable Authentication → Anonymous sign-in.
4. Create Firestore in the intended region. Region choice is difficult to change later.
5. Enable Firebase Hosting.

Put only the public Web app fields in `sync.firebaseConfig`. Use an unguessable document ID, for example a trip slug plus 24 random hex characters.

## Generate and validate

After Firebase values are in the authoring JSON:

```bash
node scripts/validate-trip.mjs /absolute/path/to/trip.json
node scripts/init-trip.mjs /absolute/path/to/trip.json /absolute/path/to/output
node scripts/qa-static.mjs /absolute/path/to/output
```

The generated `firestore.rules` allows anonymous authenticated access only to the configured document and validates its broad structure. The first online client can create that document; later edits update it transactionally.

## CLI deployment

Install and authenticate the official Firebase CLI if needed. From the generated output directory:

```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Choose the exact project requested by the user. Do not deploy from the reusable skill repository itself.

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
firebase deploy --only hosting
```

Deploy Firestore rules again whenever the synchronized schema or rules change.
