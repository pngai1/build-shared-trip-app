# Sharing and privacy boundaries

## Reusable repository

The framework and fictional demo are independent of any real trip backend. The approved showcase screenshots intentionally reveal their displayed trip title, destinations, and dates. They are static visual references, not reusable itinerary data; do not infer permission to reuse other travelers' data or connect to their server.

Private GitHub repositories require collaborator access. Do not make the repository public, publish GitHub Pages, or enable another public demo host without the owner's approval. A private source repository does not by itself make a published site private.

Before sharing an update:

```bash
node scripts/audit-privacy.mjs . --mode framework
npm test
```

The scanner uses generic rules. For additional trip-specific terms, put one literal value per line in a private denylist **outside the repository and scan target**, then run:

```bash
node scripts/audit-privacy.mjs . --mode framework --denylist /private/path/to/denylist.txt
```

Never put actual project IDs into a repository-resident denylist or security test. Review screenshots and other binary media manually; the text audit does not inspect image pixels, Git history, issues, pull requests, old clones, or remote caches. A passing scanner is a check, not a guarantee of privacy.

## Generated trip app

Use `node scripts/audit-privacy.mjs /absolute/path/to/app --mode app` for generated output. This mode permits Firebase's public browser configuration while still checking for private credentials and unsafe source material. Static QA includes this app-mode check.

Firebase web API keys/project IDs are client configuration, not administrative credentials. Their visibility does not grant console access; data access is governed by security rules and authentication. See [Firebase's API key guidance](https://firebase.google.com/docs/projects/api-keys). They nevertheless identify a deployment, so keep real values out of a reusable framework and its examples.

Never include service-account keys, private keys, authentication tokens, reservation codes, passport scans, payment data, or private source-document URLs in public assets. Generated output has a `.gitignore` for common local/private files, but ignored files can still exist on disk. Hosting publishes `public/`: inspect it before deploying.

The default app uses anonymous authentication and a single shared Firestore document. There is no invitation list or per-person authorization: app-link holders may read and edit the trip. An unguessable document ID reduces accidental discovery but is visible in the app and is not an access-control substitute.

## Git history and identity

Review author/committer metadata before sharing. Set a repository-local public or neutral Git identity deliberately instead of relying on a computer's inferred local email. Do not change a user's global identity.

Deleting text in the latest commit does not delete older copies. If history must be sanitized, preserve a private local backup, audit all branches/tags, and coordinate a history rewrite with explicit branch leases. Old clones should be replaced with fresh clones, not merged back.

GitHub may retain old commits in pull-request references and cached views even after a branch rewrite. Those references cannot be overwritten with a normal Git push; review [GitHub's removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) for support eligibility and limitations. Do not promise that a source-history cleanup purges every historical copy.
