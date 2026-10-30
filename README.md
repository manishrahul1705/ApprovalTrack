# ApprovalTrack

ApprovalTrack is an AICTE approval-workflow prototype with a React frontend,
an Express/MongoDB API, and local OCR and M1/M2/M3 document models. Extracted
values require human confirmation; deterministic rules control workflow stages.
The included institutions, model datasets, and sample documents are fictional.

## Local setup

Use Node.js 20+, Python 3.11, and MongoDB 7+. Start MongoDB separately. A local
standalone MongoDB works with the non-atomic compatibility fallback; use a
replica set for transactional multi-document writes.

From the repository root, install model dependencies in your chosen Python
environment:

```powershell
python -m pip install -r .\mlmodels\Model1\ocr\requirements.txt -r .\mlmodels\Model1\m1_training\requirements.txt
```

Install the Tesseract executable separately for scanned documents and images.
The checked-in model artifacts support inference without retraining. Generated
training CSV/JSONL files are excluded from Git; each model directory contains
its generator, dataset documentation, samples, and recorded evaluation evidence.

In one terminal, configure and start the API:

```powershell
Set-Location .\backend
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env for your MongoDB URI, cookie secret, origin, and Python interpreter.
# Optional: set DEMO_PASSWORD to a unique local-only password before seeding.
npm.cmd run seed
npm.cmd run dev
```

Seeding creates fictional demo accounts in the configured database. See
[backend setup](backend/README.md) for account behavior and workflow details.

In another terminal, starting from the repository root:

```powershell
Set-Location .\frontend
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

Open the Vite URL, normally `http://localhost:5173`. The default API URL is
`http://localhost:4000/api/v1`. Frontend `VITE_` settings are public browser
configuration. [Frontend instructions](frontend/README.md) describe the demo
accounts and walkthrough.

## Checks

From the repository root, with the corresponding dependencies installed:

```powershell
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
npm.cmd --prefix backend test
python -m pytest mlmodels ai-service/tests -q
git diff --check
```

Python tests additionally use `pytest`, `httpx`, `reportlab`, `python-docx`, and
`pypdf`; the AI service tests require [its dependencies](ai-service/requirements.txt).
The [backend README](backend/README.md#browser-end-to-end-tests) documents the
Playwright suite and its guarded disposable local database.

## Components and evidence

- [Backend API, configuration, and Compose setup](backend/README.md)
- [Optional isolated FastAPI model service](ai-service/README.md)
- [M1 classifier](mlmodels/Model1/m1_training/README.md),
  [M2 field extractor](mlmodels/Model2/README_M2.md), and
  [M3 lease reader](mlmodels/Model3/README_M3.md)
- [Synthetic upload fixtures](test-documents/README.txt)
- [Original project specification](Project.md) and
  [stakeholder specification](Student_Faculty.md)
- [Historical runtime validation evidence](runtime-validation-report.md)

The root Compose file packages MongoDB, Redis, ClamAV, API/worker, AI service,
and frontend. Copy `.env.compose.example` to `.env` and replace its placeholders
before following the backend's Compose instructions. Container builds and live
integrations require separate runtime verification. Workflow assumptions and
synthetic model metrics do not establish official AICTE rules or real-document
accuracy.
