# Legal Document Processing Pipeline

A backend service that extracts structured metadata from raw, unstructured commercial
real estate lease text, validates it deterministically, and stores the result.

An LLM is used for one job only: transcribing seven facts out of messy prose. Every
business rule, type coercion, and calculation happens afterwards in Python and Pydantic,
where it is predictable and testable.

- **Backend** (required) — Python 3.12 + FastAPI + SQLAlchemy + Alembic + SQLite
- **Frontend** (optional) — Next.js 16 + Tailwind CSS, in `frontend/`
- **Docker** (bonus) — Dockerfiles for both services plus a Compose file

---

## Table of contents

- [Architecture](#architecture)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Running the API](#running-the-api)
- [Test commands](#test-commands)
- [API reference](#api-reference)
- [curl examples](#curl-examples)
- [Prompt structure and deterministic JSON](#prompt-structure-and-deterministic-json)
- [Validation rules](#validation-rules)
- [Error handling and retries](#error-handling-and-retries)
- [Database and migrations](#database-and-migrations)
- [Frontend](#frontend)
- [Docker](#docker)
- [Project layout](#project-layout)

---

## Architecture

Requests flow in one direction through four layers. Each layer knows only about the one
below it.

```
routes/      HTTP concerns only — parse the request, map exceptions to status codes
   ↓
services/    Business logic — call the model, validate, orchestrate
   ↓
repos/       Persistence — SQLAlchemy queries, nothing else
   ↓
models/      ORM table definitions and the database session
```

`POST /api/v1/extract` walks the whole stack:

```
raw text
  → services/llm_client.py      strict structured output call, returns LeaseExtraction
  → app/schema.py               ValidatedContract enforces the business rules
  → repos/contract_repo.py      row inserted
  → app/schema.py               ContractResponse computes contract_duration_days
```

The split matters: the model never calculates, and the database never receives a record
that has not passed `ValidatedContract`.

---

## Setup

Requires **Python 3.11+** (developed on 3.12) and an OpenAI API key.

### 1. Clone and enter the project

```bash
git clone <repository-url>
cd pwc-case-study
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate          # macOS / Linux
.venv\Scripts\activate             # Windows PowerShell
```

### 3. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Then open `.env` and set `API_KEY` to a real key. See the next section for every
available option.

### 5. Apply database migrations

```bash
alembic upgrade head
```

This creates `contracts.db` with the `contracts` table. Run it once before first start,
and again after pulling any new migration.

### 6. Start the server

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API docs are at <http://localhost:8000/docs>.

---

## Environment variables

Loaded by `config.py` through `pydantic-settings`, which reads `.env` and real
environment variables (a real environment variable wins, which is how Docker overrides
the database path).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `API_KEY` | **yes** | — | OpenAI API key. The app refuses to start without it. |
| `MODEL` | no | `gpt-5-mini` | Model used for extraction. |
| `DATABASE_URL` | no | `sqlite:///<project>/contracts.db` | SQLAlchemy URL. |
| `CORS_ORIGINS` | no | `["http://localhost:3000"]` | Browser origins allowed to call the API. JSON array. |

Notes:

- `.env` is gitignored. `.env.example` is the committed template — never put a real key
  in it.
- `CORS_ORIGINS` is a list, so as an environment variable it must be JSON:
  `CORS_ORIGINS=["http://localhost:3000"]`.
- Prefer an **absolute** `DATABASE_URL`. A relative path such as `sqlite:///./contracts.db`
  resolves against the working directory of whichever process opens it, so launching from
  a different folder silently creates a second, empty database. Leaving `DATABASE_URL`
  unset avoids this entirely — the default is absolute.

---

## Running the API

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

| URL | What it is |
|---|---|
| <http://localhost:8000/docs> | Swagger UI |
| <http://localhost:8000/redoc> | ReDoc |
| <http://localhost:8000/health> | Liveness probe, used by the Docker healthcheck |

---

## Test commands

### Verify the service is up

```bash
curl -s http://localhost:8000/health
# {"status":"ok"}
```

### Exercise the full pipeline

Run the [curl examples](#curl-examples) below in order: extract a contract, list
contracts, fetch one by id, then trigger each failure case. Between them they cover
201, 404, and both 422 branches.

### Verify migrations apply and reverse

```bash
alembic upgrade head      # apply
alembic current           # should print the head revision
alembic check             # "No new upgrade operations detected" — models match schema
alembic downgrade base    # reverse
alembic upgrade head      # re-apply
```

### Inspect stored data directly

```bash
sqlite3 contracts.db "select id, lessor, monthly_rent, currency from contracts;"
```

> **Note on automated tests:** `pytest` and `pytest-asyncio` are pinned in
> `requirements.txt`, but this submission ships no `tests/` directory — the endpoints
> were verified manually with the curl commands below and through the frontend. Adding a
> pytest suite that stubs `services.llm_client.extract_lease_fields` would let the
> validation and persistence layers be tested without spending API calls.

---

## API reference

Base URL: `http://localhost:8000`

| Method | Path | Purpose | Success |
|---|---|---|---|
| `POST` | `/api/v1/extract` | Extract, validate, and store a lease | `201 Created` |
| `GET` | `/api/v1/contracts` | List processed contracts, newest first | `200 OK` |
| `GET` | `/api/v1/contracts/{id}` | Fetch one contract | `200 OK` |
| `GET` | `/health` | Liveness check | `200 OK` |

`GET /api/v1/contracts` accepts `limit` (1–100, default 20) and `offset` (default 0), so
no request can return an unbounded result set.

Only contracts that passed validation are ever inserted, so the list and detail
endpoints can only return successfully processed records.

### Response shape

```json
{
  "id": 1,
  "lessor": "Apex Holdings LLC",
  "lessee": "Vertex Tech Solutions Corp",
  "commencement_date": "2024-06-01",
  "expiration_date": "2026-05-31",
  "monthly_rent": 12500.0,
  "currency": "AED",
  "termination_notice_days": 90,
  "created_at": "2026-09-05T10:05:05",
  "contract_duration_days": 729
}
```

`contract_duration_days` is derived, not stored — see [Validation rules](#validation-rules).

### Error shape

```json
{
  "detail": {
    "code": "CONTRACT_NOT_FOUND",
    "message": "No contract exists with id 999."
  }
}
```

Validation failures add a per-field `errors` array.

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_CONTRACT` | 422 | Extracted data broke a business rule |
| `CONTRACT_NOT_FOUND` | 404 | No such id |
| `LLM_INVALID_RESPONSE` | 502 | Model replied, but not with a usable payload |
| `LLM_UNAVAILABLE` | 503 | Model unreachable after retries — timeout, rate limit, outage |

---

## curl examples

> **JSON gotcha:** a raw line break inside a JSON string is invalid
> ([RFC 8259 §7](https://www.rfc-editor.org/rfc/rfc8259#section-7)) and produces
> `Invalid control character`. Use `\n`, or the `jq` recipe at the end of this section.

### 1. Extract a contract — 201

```bash
curl -X POST 'http://localhost:8000/api/v1/extract' \
  -H 'Content-Type: application/json' \
  -d '{"raw_text": "MEMORANDUM OF LEASE \nThis agreement is entered into this 12th day of May, 2024, by and between Apex Holdings LLC \n(hereafter the Landlord) and Vertex Tech Solutions Corp (hereafter the Tenant). The property \nlocated at Suite 404, Dubai Sports City, is leased for a term starting on June 1st, 2024, and \nending exactly two years later on May 31st, 2026. The agreed monthly consideration is 12500.00 \nAED, payable on the first of each month. Either party may terminate this agreement early by \nproviding at least 90 days written notice to the other party."}'
```

```json
{
  "id": 1,
  "lessor": "Apex Holdings LLC",
  "lessee": "Vertex Tech Solutions Corp",
  "commencement_date": "2024-06-01",
  "expiration_date": "2026-05-31",
  "monthly_rent": 12500.0,
  "currency": "AED",
  "termination_notice_days": 90,
  "created_at": "2026-09-05T10:05:05",
  "contract_duration_days": 729
}
```

Worth noting what the extraction got right: the commencement date is **2024-06-01**, not
the 12 May signing date mentioned first in the document, and the duration is **729** days
rather than 730 — real `datetime` subtraction, not an approximation.

### 2. List contracts — 200

```bash
curl -s 'http://localhost:8000/api/v1/contracts'
curl -s 'http://localhost:8000/api/v1/contracts?limit=5&offset=0'
```

### 3. Fetch one contract — 200

```bash
curl -s 'http://localhost:8000/api/v1/contracts/1'
```

### 4. Unknown contract — 404

```bash
curl -s -i 'http://localhost:8000/api/v1/contracts/999'
```

```json
{"detail":{"code":"CONTRACT_NOT_FOUND","message":"No contract exists with id 999."}}
```

### 5. Expiration before commencement — 422

```bash
curl -X POST 'http://localhost:8000/api/v1/extract' \
  -H 'Content-Type: application/json' \
  -d '{"raw_text": "LEASE RECORD\nEntered by Palm Grove Holdings (Landlord) and Kestrel Media Group (Tenant). The tenancy begins on 1 October 2026 and terminates on 1 October 2025. Monthly rent of 15000 AED applies. 45 days notice required."}'
```

```json
{
  "detail": {
    "code": "INVALID_CONTRACT",
    "message": "The extracted contract failed validation.",
    "errors": [
      {
        "field": "",
        "message": "Value error, Expiration date must not be earlier than commencement date (got 2025-10-01 before 2026-10-01)."
      }
    ]
  }
}
```

Nothing is written to the database — the record never reaches the repository layer.

### 6. Negative rent — 422

```bash
curl -X POST 'http://localhost:8000/api/v1/extract' \
  -H 'Content-Type: application/json' \
  -d '{"raw_text": "LEASE ADDENDUM\nLandlord Summit Ridge Ventures and Tenant Halcyon Foods Co. agree the premises are held from 1 February 2025 until 31 January 2027. Due to a recorded credit adjustment the monthly rent is stated as -4500.00 USD. Termination notice period is 90 days."}'
```

```json
{
  "detail": {
    "code": "INVALID_CONTRACT",
    "message": "The extracted contract failed validation.",
    "errors": [
      { "field": "monthly_rent", "message": "Value error, Monthly rent must not be negative." }
    ]
  }
}
```

### Sending a document from a file

Avoids escaping altogether — `jq -Rs` reads the file raw and escapes it correctly:

```bash
jq -Rs '{raw_text: .}' lease.txt \
  | curl -X POST 'http://localhost:8000/api/v1/extract' \
      -H 'Content-Type: application/json' --data-binary @-
```

---

## Prompt structure and deterministic JSON

*(the architectural note requested in the deliverables)*

Determinism comes from three layers that reinforce each other, in `app/prompt.py`,
`app/schema.py`, and `services/llm_client.py`.

**Schema enforcement, not parsing.** The call in `services/llm_client.py` uses the
OpenAI Responses API with `text_format=LeaseExtraction`, passing a Pydantic v2 model as
a strict JSON Schema. The model is constrained during decoding, so it cannot emit a
missing key, an extra key, or a wrong scalar type — the schema is a hard guarantee rather
than a request. There is no regex, no markdown-fence stripping, and no `json.loads` over
free text anywhere in the codebase. `LeaseExtraction` sets `extra="forbid"` and gives
every field a `description`, which is carried into the schema and acts as inline
per-field instruction.

**A system instruction that narrows the job to transcription.** `SYSTEM_INSTRUCTIONS`
opens by casting the model as an extraction engine, then states one rule per known
ambiguity in real lease prose: transcribe party names without their `(hereafter the
Landlord)` role labels; normalise dates such as "the 12th day of May, 2024" to ISO 8601;
treat the signing date as *not* the commencement date; prefer an explicit calendar date
over a relative phrase like "two years later"; strip currency symbols and separators from
the rent; report the rent per month; convert notice periods expressed in months or weeks
into whole days. It closes by forbidding the model from calculating durations or
validating values, which keeps it out of business logic. The user message
(`build_extraction_prompt`) is deliberately thin — one instruction line plus the document
inside `<document>` tags, so document text can never be confused with instructions.

**Nothing downstream trusts the model.** The strict schema guarantees *shape*, not
*truth*, so the payload is immediately re-validated by `ValidatedContract`
([Validation rules](#validation-rules)), which parses the date strings into real `date`
objects, coerces the rent to `Decimal`, enforces the ISO currency pattern, and applies
both business rules. Only then is anything persisted, and the contract duration is
computed in Python from the validated dates. Prompt changes can affect extraction
accuracy, but they cannot put an invalid record in the database.

---

## Validation rules

Enforced by `ValidatedContract` in `app/schema.py`, after the model returns and before
anything is stored. Any failure raises `pydantic.ValidationError`, which `routes/extract.py`
converts into a `422` listing every offending field.

| Rule | Field | Behaviour |
|---|---|---|
| Expiration must not precede commencement | model-level | 422 `INVALID_CONTRACT` |
| Monthly rent must not be negative | `monthly_rent` | 422 `INVALID_CONTRACT` |
| Dates must be real ISO 8601 dates | both dates | Parsed into `date`; 422 if unparseable |
| Currency must be a 3-letter ISO code | `currency` | Uppercased, then matched against `^[A-Z]{3}$` |
| Rent precision | `monthly_rent` | `Decimal`, max 14 digits, 2 decimal places |
| Notice period must not be negative | `termination_notice_days` | 422 |
| Party names must not be blank | `lessor`, `lessee` | Trimmed, 1–255 characters |

`contract_duration_days` is **calculated, never stored**. `ContractResponse` derives it
with `(expiration_date - commencement_date).days` on every read, so it cannot drift out
of sync with the dates it comes from.

The same two business rules are mirrored as named `CHECK` constraints on the table
(`models/contract.py`), so the database rejects an invalid row even if it were reached by
some other path.

---

## Error handling and retries

**Retries with exponential backoff** are handled by the official OpenAI SDK, configured
in `services/llm_client.py`:

```python
OpenAI(api_key=..., timeout=30.0, max_retries=3)
```

The SDK retries connection errors, timeouts, `429` rate limits, and `5xx` responses,
backing off exponentially with jitter between attempts and honouring `Retry-After` when
the API sends one. It does not retry `4xx` errors such as a bad API key, which would fail
identically every time. Each request is capped at 30 seconds.

**Failures are translated, never swallowed.** `services/llm_client.py` catches the SDK's
exceptions, logs the original, and re-raises one of two domain errors, which
`routes/extract.py` maps to status codes:

| Situation | Raised | HTTP |
|---|---|---|
| Unreachable after retries — timeout, rate limit, outage | `LLMUnavailableError` | 503 `LLM_UNAVAILABLE` |
| Response truncated by the token limit | `LLMResponseError` | 502 `LLM_INVALID_RESPONSE` |
| No schema-conforming payload returned (refusal, empty parse) | `LLMResponseError` | 502 `LLM_INVALID_RESPONSE` |
| Extracted data broke a business rule | `ValidationError` | 422 `INVALID_CONTRACT` |

JSON decoding cannot fail silently: outbound, the strict schema plus `output_parsed`
means a non-conforming payload surfaces as a 502 rather than a crash; inbound, a malformed
request body is rejected by FastAPI as a 422 before any model call is made.

---

## Database and migrations

SQLite via SQLAlchemy 2.0 ORM, with Alembic owning every schema change.

```bash
alembic upgrade head                              # apply all migrations
alembic downgrade -1                              # reverse the last one
alembic current                                   # show the applied revision
alembic check                                     # detect model/schema drift
alembic revision --autogenerate -m "description"  # generate a new migration
```

The `contracts` table stores the seven extracted fields plus `id`, the original
`raw_text`, and `created_at` / `updated_at`. It carries three named `CHECK` constraints
and an index on `created_at`, which the list endpoint orders by.

`alembic/env.py` reads the database URL from `config.Settings` rather than `alembic.ini`,
so credentials never live in a committed config file, and it imports `models` so
autogenerate can see every table through `Base.metadata`.

---

## Frontend

Optional deliverable. A separate Next.js 16 codebase in `frontend/`, talking to this API
over HTTP — three pages: submit raw text, browse processed contracts, view one contract.

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

See [`frontend/README.md`](frontend/README.md) for the full write-up. The backend must be
running, and its `CORS_ORIGINS` must include the frontend's origin (it does by default).

---

## Docker

Bonus deliverable. Runs the API and the UI together with one command.

### Run everything

```bash
cp .env.example .env      # then set a real API_KEY
docker compose up --build
```

| Service | URL |
|---|---|
| Backend | <http://localhost:8000> |
| Swagger UI | <http://localhost:8000/docs> |
| Frontend | <http://localhost:3000> |

The backend container installs dependencies, runs `alembic upgrade head`, and only then
starts uvicorn — see `entrypoint.sh`. The frontend waits for the backend's healthcheck to
pass before it starts.

### Other commands

```bash
docker compose up -d --build     # detached
docker compose logs -f backend   # follow logs
docker compose ps                # status and health
docker compose down              # stop, keeping the database
docker compose down -v           # stop and delete the database volume
```

### Where the data lives

The database is on the named volume `contracts-data`, mounted at `/data` in the
container, so contracts survive rebuilds and restarts. It deliberately does **not** appear
in the project folder — writing it into the container's filesystem would destroy it on
every recreate. To inspect or extract it:

```bash
docker compose exec backend python -c "import sqlite3; print(sqlite3.connect('/data/contracts.db').execute('select count(*) from contracts').fetchone())"
docker compose cp backend:/data/contracts.db ./contracts.db
```

To see the file in the project folder instead, replace `contracts-data:/data` with
`./data:/data` in `docker-compose.yml`.

### Environment notes

- `API_KEY` and `MODEL` come from your host `.env` via `env_file`.
- `DATABASE_URL` and `CORS_ORIGINS` are set in `environment:`, which overrides `.env` —
  the container needs the absolute volume path, not your local relative one.
- `NEXT_PUBLIC_API_BASE_URL` is a **build argument**, not a runtime variable. Next.js
  inlines `NEXT_PUBLIC_*` values into the client bundle at build time, and the browser
  runs on your host, so it must be `http://localhost:8000` — the published port — rather
  than the Compose service name, which a browser cannot resolve.

---

## Project layout

```
.
├── app/
│   ├── main.py              FastAPI app, CORS, router registration
│   ├── prompt.py            System instructions and user prompt builder
│   └── schema.py            Pydantic v2 models: LLM schema, validation, response
├── routes/
│   ├── extract.py           POST /api/v1/extract
│   └── contracts.py         GET /api/v1/contracts and /{id}
├── services/
│   ├── llm_client.py        Strict structured output call, retries, error translation
│   └── contract_service.py  Business logic: extract → validate → store
├── repos/
│   └── contract_repo.py     SQLAlchemy queries
├── models/
│   ├── db.py                Engine, session factory, get_db dependency
│   └── contract.py          Contract ORM model with CHECK constraints
├── alembic/                 Migration environment and versions
├── frontend/                Optional Next.js UI (own README)
├── config.py                Settings via pydantic-settings
├── entrypoint.sh            Docker: migrate, then serve
├── Dockerfile               Backend image
├── docker-compose.yml       Backend + frontend
└── requirements.txt         Pinned dependencies
```
