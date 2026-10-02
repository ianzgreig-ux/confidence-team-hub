# Confidence Team Hub

A simple responsive launch page for The Confidence Bar and The Confidence Lab. Each configured system opens in a new tab. No logins, credentials or patient records are stored in this hub.

## Update links

Edit `public/links.json`, then run `npm run build`. To add another system, copy a link entry into the appropriate group. Null URLs produce a clearly labelled, non-clickable card until a link is supplied.

The Bar Monday board, Lab Monday board, Lab internal training and attendee sign-in still need their exact URLs. The Events URL preserves the existing `conffidencelab` spelling supplied by Ian.

## Cloudflare Worker, Git integration

1. In GitHub, create a private repository under `ianzgreig-ux` named `confidence-team-hub`. Initialize it with a README if you want GitHub to show the Add file menu immediately.
2. Extract the supplied project zip. In the repository, choose **Add file > Upload files**. Upload the extracted files and folders, not the zip and not an extra enclosing folder. `package.json` and `wrangler.jsonc` must appear at the repository root. Commit to `main`.
3. In Cloudflare, open **Workers & Pages > Create application > Import a repository** (or **Continue with GitHub**, depending on the dashboard).
4. Choose the existing GitHub account and `confidence-team-hub` repository. If it is missing, use **Manage GitHub access** and add this specific repository to the existing Cloudflare installation.
5. Set the Worker/project name to `confidence-team-hub`, production branch to `main`, build command to `npm run build`, deploy command to `npx wrangler deploy`, and root directory to `/`.
6. Select **Save and Deploy**. Wait for the build to succeed, then open the `workers.dev` URL Cloudflare shows. Confirm the hub loads and open the Schedule and Huddle Board buttons.

Future changes committed to `main` trigger a build and deployment automatically. No secrets, database or bindings are required. This is a new Worker, separate from the existing schedule, events and patient apps.

For an authenticated local Cloudflare CLI, `npm run deploy` builds and publishes. Confirm the active account before deployment.

## Privacy

The hub itself contains only system names and URLs. Each destination retains its existing login and access rules. `noindex` discourages search indexing but is not access control. The site makes no external requests until someone opens a link.

## Link provenance

- Huddle, Schedule, Events, Patient Follow-up and Quickbase: supplied by Ian on 2 October 2026.
- Monday workspace: the workspace domain of the supplied Huddle Board URL.
- Aesthetic Record: https://app.aestheticrecord.com/ (official login).
- Weave: https://app.getweave.com/portal/login (official portal login).

Version 1.0.0.
