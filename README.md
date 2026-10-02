# Confidence Team Hub

A responsive staff launch page for The Confidence Bar and The Confidence Lab. Version 1.4.0 adds custom background and text colours to the PIN-protected live editor. Each configured system opens in a new tab.

## Use the live editor

Select **Edit board**, enter the editor PIN, then choose **Add card** in a section or **Edit card** on an existing card. You can change its name, description, website, label, icon, colour, group and position. Choose a brand colour or **Custom**, then use the background colour picker or enter a six-digit hex code. Turn off **Automatic text colour** to choose a text colour. The preview updates immediately. Automatic text colour chooses black or white for a custom background. Use **Group** to move a card between Daily operations, The Confidence Bar and The Confidence Lab, and **Position in group** to set its order. A blank website keeps the card visible as “Link to be added.” Removal requires confirmation. Select **Done editing** to lock the editor.

Saves are shared with everyone. Open pages refresh on returning to the tab and every minute, or immediately with **Refresh board**. Concurrent edits are checked so an older form cannot overwrite someone else's newer save.

## One-time PIN setup

In Cloudflare, open **Workers & Pages → confidence-team-hub → Settings → Variables and Secrets → Add**. Select **Secret**, use the name `HUB_ADMIN_PIN`, and enter your chosen 4–12 digit PIN as the value. Save and deploy the change. Do not put the PIN in GitHub, source files or build variables.

Viewing the hub works without this secret. Editing stays locked until it is configured. To change the PIN, update the same secret and deploy; existing editor sessions will be invalidated. Sessions also expire after eight hours or when **Done editing** is selected. Incorrect attempts are limited on the server.

## Cloudflare and GitHub

The GitHub repository is `ianzgreig-ux/confidence-team-hub`. Cloudflare's connected Worker deploys commits to `main` automatically. Keep these build settings:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Project root: `/`
- Worker name: `confidence-team-hub`

Wrangler creates the `HUB_STORE` Durable Object binding and its SQLite-backed storage using the migration in `wrangler.jsonc`. There is no separate database to create. The secret must be added in the Worker's runtime settings, as described above.

Live card changes are stored in Cloudflare. GitHub contains the application code and initial cards, not a commit for each live edit. Deploying new code preserves the saved board. `public/links.json` seeds a brand-new board only; edit an existing board through the live editor.

## Development and checks

Use Node.js 22 or newer. Run `npm ci`, `npm run build`, `npm run check`, then `npm test`. Integration tests cover four-digit PIN login, unauthorized writes, cross-origin requests, add/edit/move/remove, concurrent saves, safe links, persistence across runtime restarts, rate limiting, logout and secret rotation. They use an isolated temporary store and a randomly generated test PIN.

`npm run dev` starts the local Worker. For local editor development only, use an ignored `.dev.vars` file containing `HUB_ADMIN_PIN`; never commit that file. Production editor sessions use a Secure, HttpOnly cookie. `npm run deploy` builds and deploys using an already authenticated Cloudflare CLI; confirm the account first.

## Content and access

The hub stores system names and URLs, not patient records. Linked systems retain their own login rules. The PIN controls editing the hub, not access to those systems or visibility of the hub. `noindex` discourages indexing but does not restrict viewing.

The layout follows Ian's marked screenshot: Aesthetic Record is in Daily operations, the three extra Monday cards are removed, and Lab Training uses Quickbase. Attendee Sign-in still needs its URL. The Events URL intentionally preserves the supplied `conffidencelab` spelling.

Links were supplied by Ian on 2 October 2026, except the official Aesthetic Record and Weave login addresses.

## Brand styling

The supplied logo is used unchanged in the header and browser tab. Brand colours are rose `#c77975`, ivory `#f7f6f2`, orange `#dd7929`, blush `#d2a1a8`, chocolate `#5d3727` and white. The hub uses ivory, rose and chocolate as its main palette.

Typography follows the guide with serif headings, uppercase labels and buttons, and light sans-serif body copy. CSS prefers Canela and Avenir when installed, then falls back to Georgia and system sans-serif fonts. The PDF does not supply licensed webfont files. Add appropriately licensed webfonts if exact typography is needed on every device.

Existing white and dark cards keep their appearance when upgrading. Their colour is normalised on the next save, without resetting the stored board.

Custom colours are validated as six-digit hex values before saving and rendering. The Worker renders card colour rules in a per-response nonce-protected stylesheet. Preset colours and existing cards remain supported.
