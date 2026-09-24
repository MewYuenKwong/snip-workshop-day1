# Snip

Snip is a tiny URL shortener demo built as a single backend and two clients: a web app and a CLI. The repo uses one branch per layer and mounts each branch as a git submodule on `main`.

## Architecture

- `backend/` - Bun API service
- `frontend/` - Angular app
- `cli/` - Node CLI
- `bundle/` - generated release output
- `main` - the superproject that pins each layer as a submodule

## API contract

| Method | Path | Response |
| --- | --- | --- |
| POST | `/api/links` | `201` with `{ code, url, shortUrl, hits, createdAt }` |
| POST | `/api/links` | `400` on invalid JSON or non-http(s) URL |
| GET | `/api/links` | `200` array of link objects |
| GET | `/:code` | `302` to the original URL and increments hit count; `404` for unknown codes |

## Branch-per-layer layout

```text
main
+- backend/   (submodule -> backend branch)
+- frontend/  (submodule -> frontend branch)
+- cli/       (submodule -> cli branch)
+- bundle/    (submodule -> bundle branch)
+- README.md
+- .gitmodules
+- scripts/build-bundle.mjs
+- ...
```

## Generated release bundle

The `bundle` branch is generated output. Do not hand-edit it. From the `main` superproject checkout, rebuild it with:

```bash
node scripts/build-bundle.mjs
```

The script updates the source submodules, builds the Angular frontend, assembles `bundle/`, commits generated changes in the `bundle` submodule, and bumps submodule pointers on `main`. Add `--push` to publish both `bundle` and `main`:

```bash
node scripts/build-bundle.mjs --push
```

## Clone this repo

Use `--recurse-submodules` because a plain clone leaves submodule folders empty:

```bash
git clone --recurse-submodules https://github.com/MewYuenKwong/snip-workshop-day1.git
```

## Run the app

```bash
cd backend && bun install && bun start
cd frontend && npm install && npx ng serve
cd cli && node cli.js ls
```

The backend runs on `http://localhost:3000`, and the Angular app runs on `http://localhost:4200`.

## Update workflow

After changing code in a submodule:

```bash
cd backend   # or frontend / cli
# edit, commit, push

git push
cd ..
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push
```

This keeps the superproject pinned to the latest submodule branch commit.
