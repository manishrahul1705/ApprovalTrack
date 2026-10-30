# ApprovalTrack: Vercel + Render

Prepared 2026-10-31 IST. No service has been deployed, no credits spent, no Git push performed, and no Atlas data changed. Branch: `deployment-vercel-render`, based on `7f800b9`. All nine published commits remain unchanged. No applicable AGENTS.md was found in this repository or its accessible ancestor locations. Existing historical validation files are retained unchanged.

## Service choice and cost

| Design | Files and processes | Resources and tradeoff |
| --- | --- | --- |
| **Chosen: one Render Docker web service** | Node API + inline Mongo-backed scheduled jobs; Python CLI model execution; loopback ClamAV + freshclam; one disk | Start with **4 GB RAM / 2 CPU (Pro)**, one instance. No Redis, worker service, or AI HTTP service. Python document pipelines are serialized with `LOCAL_AI_SERIAL=true`. Lowest service count and no document-transfer protocol. |
| Separate backend and AI | Each has its own filesystem; current JSON inference API sends **local absolute file paths** | Requires new bounded authenticated binary transfer, receiver-owned temporary files, cleanup, anti-replay/authorization, deadlines and retries. A disk cannot be shared between Render services. Backend still needs ClamAV, and AI needs OCR/model RAM. More services and failure modes; current remote mode is unsuitable for separate Render services. |

The existing root Compose layout remains a separate local option: its shared upload volume is valid on a single Docker host. Do not copy its remote AI settings to Render.

Memory is an estimate, not a measured deployment result: ClamAV/signatures can use around 1–1.5 GB and have reload peaks; Node, Python/scikit-learn, image rendering, Tesseract and LibreOffice need additional headroom. 512 MB is unsuitable. A 2 GB Standard service (~$25/month) might work at very low load but is **not the selected reliable configuration** without peak-memory measurements during signature reload and scanned-document processing. The selected Pro service is budgeted at roughly **$85/month + $2.50/month for 10 GB disk**, excluding domain registration, Atlas, provider email/SMS, bandwidth and workspace charges. At that rate $50 credit is about **17 days**, not a full month. Confirm the actual instance price in Render before creating anything; do not upgrade the workspace merely to select a compute instance. There is no claim of staying under $50/month while preserving all requirements.

10 GB is an initial disk size, not an assertion that the unprovided ZIP fits. Reserve at least 2 GB for ClamAV/current and replacement signatures, plus the uncompressed uploads, OCR text, quarantine and growth. During import allow the ZIP size too, unless it is uploaded outside the disk. Size the disk before creation using actual archive totals; keep at least 20% free. All durable state is under `/var/data`; image/model code is read-only runtime content, and conversion scratch space is ephemeral. The three checked-in model artifacts total about 7.2 MB, but Python/system packages make the image much larger. Back up uploads independently; disk snapshots do not substitute for a matching database/files backup. A disk restricts the service to one instance and prevents zero-downtime deployment: plan a maintenance window.

References: [Render disks](https://render.com/docs/disks), [pricing](https://render.com/pricing), [ports](https://render.com/docs/web-services), [health checks](https://render.com/docs/health-checks), [shutdown](https://render.com/docs/deploys), [Blueprint settings](https://render.com/docs/blueprint-spec). Prices are estimates to verify at creation, since the live pricing page is dynamically rendered.

## Exact Render settings

Use `render.yaml` as a reviewed settings specification; importing it creates a paid service, so do that only when separately authorized. Otherwise create manually with the same settings:

| Setting | Value |
| --- | --- |
| Type / runtime | Web Service / Docker |
| Repository branch | `deployment-vercel-render` after manual commit/push |
| Root directory / context | Repository root (`.`), **not backend/** |
| Dockerfile | `deploy/Dockerfile` |
| Region | Singapore; prefer the Atlas region if different and supported |
| Plan / instance count | Pro, 4 GB / 2 CPU; 1 |
| Auto deploy | Off; no pre-deploy/post-deploy/seed command |
| Build / start commands | Leave Docker overrides empty; use Dockerfile ENTRYPOINT |
| Port / binding | `PORT=10000`, Node binds `0.0.0.0` |
| Health path | `/health` |
| Shutdown delay | 300 seconds |
| Disk | 10 GB minimum initial allocation, `/var/data`, name `approvaltrack-data` |

Use the complete variable names in `deploy/render.env.example`. `MONGODB_URI` must specify the restored **approvaltrack** database, TLS and Atlas credentials, with a least-privilege application account. Add Render's outbound IP ranges to Atlas network access. Do not allow all internet IPs merely to avoid configuration. Keep the URI out of shell history, logs, screenshots and Git. `COOKIE_SECRET` must be a random secret of at least 32 characters. `FRONTEND_ORIGIN` is the exact HTTPS frontend origin with no trailing slash or path. Do not enable arbitrary preview origins.

The fixed production values are in the Blueprint. Initial `STORAGE_MAINTENANCE=true` starts a dedicated production maintenance HTTP process after all model/scanner checks. It makes no Atlas connection and starts no application jobs; `/health` explicitly returns `status: storage-maintenance, applicationReady: false`, while all application paths return 503. After storage import, path/index verification and separate authorization for database-writing application startup, set `STORAGE_MAINTENANCE=false` and manually redeploy. The normal application then performs the database startup described below. `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` stay empty; no separate AI service is created. `REDIS_URL` is unused in inline mode. `LOCAL_AI_SERIAL=true` prevents multiple documents loading model/OCR subprocesses concurrently. Jobs remain in MongoDB and scanners retry pending uploads after restart; this is single-instance operation, not a durable distributed queue. A forced termination can leave `PROCESSING` records: inspect ProcessingRun and document status during maintenance and requeue only individually confirmed abandoned records after backup. Do not bulk reset statuses.

`NOTIFY_MODE=log` is the initial cost-free delivery setting (notifications are recorded; provider delivery is not sent). For live email set `NOTIFY_MODE=send`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and verified `MAIL_FROM`. Configure the provider webhook at `https://api.<your-domain>/webhooks/resend`. Set `TEXTBEE_API_KEY` and `TEXTBEE_DEVICE_ID` only if SMS is required and authorized. No provider credentials are in the image. Email template `backend/templates/email/notification.html` is included.

Startup verifies dependencies and unpickles all three model artifacts, validates upload permissions, refreshes signatures, starts clamd/freshclam, waits for a real ClamAV PONG, then starts Node. Failure stops deployment; there is no development/scanner bypass. ClamAV binds **only loopback**, is not exposed publicly, and retains signatures on the disk. Every application upload still passes the existing INSTREAM scanner. Uploads are capped at **20 MiB, one file/request** in existing Multer routes; ClamAV stream/file cap is 25 MiB. JSON bodies remain 1 MiB. API and Python run as UID 1000; startup root initializes ownership and clamd drops to its own user. Imported files must be owned by appuser with mode 0600, directories 0700. Do not chmod uploads 777.

`/health` requires Mongo connection, writable storage, Python executable and a successful scanner stream probe; it returns 503 for scanner/Python failure. Model loading is checked at startup rather than reloading models on every health request. Node stops accepting requests and drains scheduler/document work on SIGTERM; a 290-second deadline leaves time before Render's 300-second kill. Tini forwards signals and reaps children. In-flight large OCR requests still require operational verification, especially SSE connections and forced shutdown.

**Database startup caution:** existing `connectDatabase()` creates the two document-owner indexes and drops an old index if present. Production autoIndex is otherwise disabled. Before first production startup, verify restored indexes against all schema definitions using a read-only connection; test unique-index compatibility on a restored staging copy. If legacy index replacement is needed, back up index definitions and schedule it as an explicit database change. Do not run the application simply to inspect the restored database: its scheduler and index setup perform writes. Nothing in this work ran that startup against Atlas.

## Exact Vercel settings and browser sessions

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework | Vite |
| Node | 22.x |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Production branch | `deployment-vercel-render` initially (change only after a reviewed merge) |
| Production variable | `VITE_API_BASE_URL=https://api.<your-owned-domain>/api/v1` |
| SPA routing | Checked-in `frontend/vercel.json` rewrites deep links to `/index.html` |

Use an actual domain you control in place of the notation above; `.example` values are documentation only. The frontend build tested locally used an explicitly non-live example API URL to verify substitution. Rebuild after setting the actual production URL; Vite bakes it into JavaScript. No MongoDB URI, API token or cookie secret belongs in any `VITE_` variable. Keep previews pointed to staging or disable their deployments. Creating/linking a Vercel Git project can deploy immediately: do not do so as part of preparation. Configure Git deployment controls for manual release if connecting it later.

**Preferred browser setup:** Vercel `https://app.<owned-domain>` and Render `https://api.<same-owned-domain>`, both HTTPS. Configure custom domains and the exact DNS records returned by each provider. They must share the same registrable domain (eTLD+1), including public suffix rules such as `.co.uk`; do not guess from the final two labels. Set `SESSION_COOKIE_SAME_SITE=lax`. Cookies remain HttpOnly, Secure, Path=/ and host-only on the API; no Domain attribute is needed. `TRUST_PROXY_HOPS=1` recognizes Render's HTTPS proxy and makes login rate limits use the forwarded client address. Verify this hop count against actual forwarding headers before release; never use unconditional trust-proxy true.

If using `https://<project>.vercel.app` + `https://<service>.onrender.com`, these are **cross-site**: set `SESSION_COOKIE_SAME_SITE=none`, use exact Vercel `FRONTEND_ORIGIN`, and set `VITE_API_BASE_URL=https://<service>.onrender.com/api/v1`. SameSite=None; Secure is necessary but browser third-party-cookie policies can still block sessions. This is not a reliable universal production setup. Use the preferred custom domains before sign-off if sessions are blocked. No unverified proxy workaround is configured, and default host suffixes are not assumed to share a cookie site.

Frontend fetches use `credentials: include`; SSE uses `withCredentials: true`. CORS allows only the configured frontend origin, credentials, explicit methods and headers. Mutations require `X-Requested-With: XMLHttpRequest`; an explicit mismatched Origin is now rejected even when that header is present. Origin-less non-browser callers still need the header and authentication. Resend webhook uses its existing signature protection. Verify a foreign-origin preflight cannot read responses, a mutation without the header returns 403, and a foreign Origin with the header returns `CSRF_ORIGIN_REJECTED`.

In a fresh normal and privacy-restricted browser: log in, inspect Secure/HttpOnly/SameSite, refresh a deep application URL, call `/auth/me`, navigate roles, open SSE, download an authorized document, and log out. Confirm another user's document remains inaccessible. Confirm cookies persist on reload and disappear at logout. This hosted browser verification has not been performed.

See [Vercel Vite routing](https://vercel.com/docs/frameworks/frontend/vite) and [rewrites](https://vercel.com/docs/rewrites).

## Import the existing uploads ZIP

The ZIP was not present in this workspace. Do not recreate uploads by seeding. Preserve the original ZIP offline and record its SHA256. Inspect its directory listing: existing storage keys are relative to `UPLOAD_DIR`, including `quarantine/` and OCR text files. Preserve file names and subdirectories exactly; never flatten to basename or rename by document ID. An archive containing an enclosing `uploads/` folder needs the explicit `--prefix uploads/` option. Other layouts need a reviewed staging arrangement, not blind extraction. Review the archive for paths referenced in the database before import.

During a later authorized maintenance window, deploy with `STORAGE_MAINTENANCE=true` (the supplied initial Blueprint setting). This keeps real clamd/freshclam running and gives SSH access while all application requests return 503; neither the API nor scheduled jobs connects to Atlas. Confirm `/health` reports `storage-maintenance` before copying files. For an existing installation, enabling this mode requires a manual redeploy and downtime. Prefer importing on a staging clone first. Keep maintenance mode enabled through import, audit and any separately authorized path migration. Set it false only after backups/import/path and index verification are complete.

Use Render's SSH connection command from its dashboard. Transfer with `scp -s` (substitute the actual SSH service/region from Render; never a URI containing database credentials):

```sh
# In Render shell, prepare a private staging directory as root:
install -d -m 700 -o appuser -g appuser /var/data/imports
# From your own computer, after verifying ZIP hash and remote connection:
scp -s /local/path/uploads.zip SERVICE@ssh.REGION.render.com:/var/data/imports/uploads.zip
# In the remote maintenance shell, after confirming storage-maintenance health:
chown appuser:appuser /var/data/imports/uploads.zip
chmod 600 /var/data/imports/uploads.zip
gosu appuser python /app/deploy/import-uploads.py /var/data/imports/uploads.zip --prefix uploads/ --manifest /var/data/imports/import-manifest.jsonl
```

Omit `--prefix` when the archive already contains root-relative keys. The importer rejects traversal, Windows absolute paths, duplicates, symlinks, existing destinations and entries above the scan limit. It scans each staged file through **real clamd**, writes exclusively without overwrite, and journals size/SHA256. A mid-import error may leave a partial import: reconcile the journal and disk against the archive before a new run. Do not automatically delete or overwrite partial results. Keep the ZIP/journal outside the uploads root and remove only through a separately reviewed retention process after verification. Large imports may need a larger disk to hold both ZIP and extracted content.

Run the read-only database/files audit described below with `UPLOAD_DIR=/var/data/uploads`. Require all referenced safe relative paths to exist; reconcile hashes with original ZIP content/import manifest and `documents.sha256` or evidence hashes. The audit emits document and evidence hash comparisons where available. Quarantined files must stay quarantined; importing/scanning clean does not authorize clearing a document's quarantine state. Then authenticate as the owning user and request `GET /api/v1/documents/<id>/download`. Verify 200, correct filename, bytes and SHA256. Check representative PDF, image, DOCX, lease, OCR text/evidence paths and quarantined/missing-file rejection; do not require quarantined downloads to succeed. Verify after a restart that the same files still download. Existing evidence download endpoints are role-scoped and should be tested too.

## Read-only inspection and explicit path migration

Current `localStorage.save()` writes relative keys; `localStorage.resolve()` rejects Unix paths outside the upload root. Legacy Windows absolute paths do not map correctly on Linux. Inspected schema fields: `documents.file_path`, `aiextractions.ocr_text_path`, `complaints.proof_document.storage_path`, and `evidence[].storage_path` in complaints, yearlyreports and institutionannualreports. No real records were inspected: no Atlas URI was configured in the environment or local `.env`, so the absolute-path count is unknown.

The raw-driver script imports no app models, does not create indexes, seed, schedule jobs or write during `audit`. Keep output private: it contains IDs and stored paths. Create `deployment-private/` locally (Git-ignored), set `MONGODB_URI` through a private environment injection, preferably using a **read-only Atlas account**, then:

```powershell
# From repository root; MONGODB_URI is already privately injected:
New-Item -ItemType Directory -Force deployment-private
node backend/scripts/storage-paths.mjs audit deployment-private/paths-before.json
```

Set `UPLOAD_DIR` as well when auditing against the imported files. In Render, the equivalent script is `/app/backend/scripts/storage-paths.mjs`. Audit output is create-only and refuses to overwrite an earlier report. Relative paths with backslashes, traversal or empty segments also need review. Missing files must be restored from backup, not fixed by inventing database paths.

If all paths are safe relative and present, **perform no migration**. Otherwise, a future explicitly authorized migration must follow this order:

1. Freeze uploads, document processing and schedulers. Take an Atlas snapshot or `mongodump` of `approvaltrack` including indexes using private environment-based credential injection; separately back up the upload disk. Restore the dump to an isolated staging database and test the procedure there first. Keep an immutable checksum of the ZIP, dump and path audit. Do not put any backup in Git.
2. Build a reviewed JSON plan with `database: "approvaltrack"` and `rows: [{collection, id, field, before, after, sha256}]`. `before` must equal the exact current string. Derive `after` by removing **only a verified old upload-root prefix** and normalizing separators to `/`; never blindly take basename. For nested evidence use a concrete field like `evidence.0.storage_path`. Match each target to the archive/import manifest and its SHA256. Stop for missing/ambiguous files, duplicate mappings or inconsistent ownership. Hash OCR text too.
3. Re-run audit and compare IDs/counts against the approved plan. Set a temporary least-privilege write credential only during the authorized maintenance window, then run the apply command below. It validates every target's content hash, checks all before values, creates an exclusive backup **before the first write**, and uses compare-and-set updates. It modifies only allowlisted path fields. It is not transactional across rows; a partial failure requires reconciliation, not a blind rerun.
4. Audit again: no unexpected absolute/unsafe paths; every referenced file exists and hashes match. Compare document/extraction/evidence counts, status, IDs and all non-path fields with the snapshot; no seeds or data replacement. Test owner-authorized downloads and denied cross-user downloads. Re-enable writers only after verification.
5. If rollback is required, freeze writers again and use the original apply backup. Rollback checks that each path still equals the applied value and creates its own backup before compare-and-set writes. On partial apply, first make a reviewed rollback input containing **only successfully applied rows**. Do not restore the entire Atlas database over unrelated newer work.

```sh
# Examples for a later separately approved migration, never run during preparation:
node backend/scripts/storage-paths.mjs apply deployment-private/path-backup.json deployment-private/reviewed-plan.json
node backend/scripts/storage-paths.mjs audit deployment-private/paths-after.json
node backend/scripts/storage-paths.mjs rollback deployment-private/rollback-backup.json deployment-private/path-backup.json
```

## Container verification to run on a Docker host

Hindi Tesseract data and Noto fonts are packaged, but the current M1 OCR code explicitly uses English; this deployment does not claim Hindi OCR accuracy. Docker CLI is unavailable locally. These commands are provided for a later host with Docker; no container was built or started here:

```sh
docker build --progress=plain -f deploy/Dockerfile -t approvaltrack-render .
docker volume create approvaltrack-validation-data
# Private env file must point to an isolated restored staging DB, never the restored production DB.
docker run --name approvaltrack-validation --env-file deployment-private/staging.env -p 10000:10000 -v approvaltrack-validation-data:/var/data approvaltrack-render
curl --fail http://localhost:10000/health
docker stats --no-stream approvaltrack-validation
docker stop --time 300 approvaltrack-validation
```

The build runs dependency/model preflight; runtime runs it again under the application user. Verify startup permissions with a fresh volume and an existing imported volume. Exercise a real English scanned PDF, DOCX conversion, each model, and a normal upload/download. Test a standard antivirus test fixture in isolated staging: it must be rejected/quarantined; stop clamd to confirm `/health` becomes 503 and uploads fail closed, then restart and confirm recovery. Do not upload malware fixtures into the restored database. Observe memory during freshclam reload plus OCR, disk growth, SIGTERM, restart and download persistence. There is no claim these checks have passed.

## Manual Git release commands

Review the diff and ensure private files are ignored. No commit or push was made by this task. From PowerShell at the project root:

```powershell
git switch deployment-vercel-render
git status --short
git diff --check
git diff --stat
git add .gitattributes .dockerignore .gitignore backend/.env.example backend/src/app.js backend/src/config/env.js backend/src/middleware/auth.js backend/src/modules/ai/pipeline.js backend/src/server.js backend/scripts/storage-paths.mjs backend/tests/deployment.test.js backend/tests/storage-paths.test.js backend/tests/storage-maintenance.test.js deploy frontend/vercel.json render.yaml
git diff --cached --stat
git diff --cached
git commit -m "build: prepare Vercel frontend and Render local-AI deployment"
git push -u origin deployment-vercel-render
```

Do not amend, rebase, force-push or rewrite main. Deploying after push remains a separate manual action requiring its own authorization and review of cost, private variables, domains, backups and runtime checks.
