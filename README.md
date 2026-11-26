# KSRM College RAG Assistant

A Retrieval-Augmented Generation (RAG) assistant for K.S.R.M. College of Engineering, built on the college's public website ([ksrmce.ac.in](https://ksrmce.ac.in)). Answers stream in real time and cite the pages they came from. Guardrails block off-topic and prompt-injection questions, and an evaluation suite scores the system at four levels.

**Stack:** FastAPI · ChromaDB · sentence-transformers (embeddings + cross-encoder re-ranker) · Google Gemini · React (Vite) · Tailwind CSS · lucide-react

## Features

- **Streaming chat**: answers appear token by token over Server-Sent Events. Each answer has copy-to-clipboard and expandable source pills (page title, URL, relevance, quoted passages). A Details panel shows retrieval, guardrail and judge scores.
- **Guardrails**: an input filter, friendly small-talk handling ("who are you?"), a three-zone scope check, and a grounded prompt.
- **Knowledge map**: an interactive 3-D view of every indexed chunk. Drag to rotate. Type a question to see where it lands and which chunks retrieval returns for it. ChromaDB stores and searches the full 384-dimensional vectors; PCA reduces them to 3 axes only for display.
- **Evaluation**: a golden set of in-scope, small-talk, off-topic and attack questions, scored for retrieval, generation, guardrails and system performance.
- **Responsive UI**: a sticky header with live backend status, a welcome screen with sample questions, and light/dark themes. Works from phone to desktop.

## How it works

```
OFFLINE   ksrmce.ac.in ─► scrape (text + page title) ─► clean ─► chunk 600/100 ─► embed ─► ChromaDB (backend/chroma_db)

ONLINE    question
            ─► [G1] input filter (prompt injection / misuse)            → refuse
            ─► small talk? ("hi", "who are you", "thanks")              → fixed friendly reply
            ─► vector search top-30 ─► cross-encoder re-rank ─► top-4
            ─► [G2] scope check, three zones:
                    re-rank score ≥ 0.01      → answer
                    nearest distance > 1.6    → refuse
                    otherwise (ambiguous)     → ask Gemini "is this about KSRM?"
            ─► [G3] grounded prompt ─► Gemini streams tokens ─► sources ─► judge scores
```

G1 and small talk run before retrieval. G2 needs the retrieval scores, so it runs after retrieval but **before generation**: a refused question never produces a token.

Why three zones: short, casual questions ("college name") score low on both distance and re-rank even though they are clearly about KSRM. A single number cut-off either refuses real questions or lets off-topic ones through, so only the ambiguous middle pays for an extra LLM call.

## Evaluation

A RAG system can't be summed up in one accuracy number, so each stage is measured separately:

| Level | Question it answers | Metrics |
|---|---|---|
| **Retrieval** | Did we fetch the right chunks? | Hit rate, MRR, Precision@k, Recall@k |
| **Generation** | Is the answer good? | Faithfulness, Relevancy, Correctness (LLM-judged) |
| **Guardrails** | Are real questions answered and the rest refused? | Accuracy, Precision, Recall, F1, confusion matrix |
| **System** | Is it fast and reliable? | Avg / p95 latency, errors, LLM scope checks |

The golden set is [`backend/eval/golden_set.json`](backend/eval/golden_set.json). A chunk counts as relevant when it contains one of a question's `evidence` strings, so the labels survive index rebuilds.

### Latest results (62 questions: 39 in-scope, 4 small talk, 13 off-topic, 6 attacks)

| Level | Metric | Score |
|---|---|---|
| Retrieval | Hit rate / MRR | 85% / 0.73 |
| Retrieval | Precision@4 / Recall@4 | 32% / 69% |
| Generation | Faithfulness / Relevancy / Correctness | 99.5% / 99.5% / 84% |
| Guardrails | Accuracy / Precision / Recall | 100% / 100% / 100% (0 wrongly refused, 0 leaked) |
| System | Avg / p95 latency | 3.4s / 8.4s (11 of 62 needed the LLM scope check) |

How we got here: vector search alone reached a 77% hit rate and 75% guardrail recall. The re-ranker raised both. A single re-rank cut-off then refused 25% of casually worded questions, which the three-zone check fixed. Widening the re-rank pool from 20 to 30 candidates recovered answers that vector search ranked 21st–30th, such as "Who is the principal?".

> Thresholds were tuned on this same golden set (`python -m scripts.tune_thresholds`), so treat the scores as optimistic and keep adding new, unseen questions.

## Project structure

```
backend/
  app/
    main.py                  # app factory, CORS, routers; instant startup + background model warm-up
    config.py                # every setting, overridable via env vars
    schemas.py               # request/response + SSE event models
    dependencies.py          # shared RagEngine + EvaluationJob instances
    api/
      chat.py                # POST /api/chat (SSE stream)
      health.py              # GET /api/health
      knowledge.py           # POST /api/index/rebuild, GET /api/vectors
      evaluation.py          # POST/GET /api/evaluate
      sse.py                 # SSE frame encoder
    services/
      scraper.py             # fetch pages, extract text + title
      chunker.py             # split pages into chunks (keeps URL + title)
      vector_store.py        # embeddings, persistent ChromaDB, 3-D PCA projection
      reranker.py            # cross-encoder re-ranking
      guardrails.py          # input filter, small talk, three-zone scope decision
      llm.py                 # Gemini: streaming answers, scope check, judge, retry/backoff
      rag_engine.py          # RagEngine: build_index / retrieve / ask / ask_stream
    evaluation/
      dataset.py             # load + validate the golden set
      metrics.py             # pure metric functions (unit-tested)
      runner.py              # run the golden set, summarise, background job
  eval/golden_set.json       # test questions, expected answers, evidence
  scripts/
    build_index.py           # offline: scrape + embed into chroma_db/
    cli.py                   # terminal chat
    evaluate.py              # four-level scorecard in the terminal
    tune_thresholds.py       # guardrail threshold sweep (no LLM calls)
  tests/                     # pytest: metrics, guardrails, small talk, SSE, citations
frontend/
  src/
    api/client.js            # REST calls + SSE stream parser (fetch + ReadableStream)
    hooks/useChatStream.js   # chat state, token streaming, stop/abort
    hooks/useHealth.js       # polls /api/health for the status pill
    components/
      layout/Header.jsx      # sticky header: branding, tabs, health pill
      chat/                  # ChatView, WelcomeScreen, MessageBubble, TypingIndicator, SourcePills, AnswerMetrics
      knowledge-map/         # KnowledgeMap, Scatter3D (rotatable 3-D SVG plot)
      evaluation/            # EvaluationView, ScoreSection, ConfusionMatrix, CaseTable
      ui.jsx                 # Card, Button, Alert, Tag, ProgressBar, page layout
    utils/format.js
    index.css                # Tailwind entry + theme tokens
    App.jsx
```

## Getting started

**Prerequisites:** Python 3.10+, Node.js 18+, a [Gemini API key](https://aistudio.google.com/apikey).

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # put your GEMINI_API_KEY in .env (never in .env.example)
python -m scripts.build_index        # one-time: scrape ksrmce.ac.in into chroma_db/ (~1 min)
uvicorn app.main:app --reload --port 8000
```

The API is up within a few seconds. The models load in the background, and the status pill turns green when they're ready. To refresh the knowledge base later, re-run `build_index` or use **Rebuild index** on the Knowledge Map tab.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. In development, Vite forwards `/api` requests to the backend on port 8000.

### Command-line tools

```bash
cd backend
python -m scripts.cli               # chat in the terminal
python -m scripts.evaluate          # full evaluation scorecard (~70 LLM calls)
python -m scripts.tune_thresholds   # guardrail threshold sweep (no LLM calls)
pip install -r requirements-dev.txt && pytest   # unit tests
```

## API

| Method | Endpoint             | Description                                                   |
| ------ | -------------------- | ------------------------------------------------------------- |
| GET    | `/api/health`        | Status, index/model readiness, configuration                  |
| POST   | `/api/chat`          | `{ "question": "..." }` → **SSE stream** (see below)          |
| GET    | `/api/vectors?query` | 3-D PCA projection of chunks (+ query and its retrieved chunks) |
| POST   | `/api/index/rebuild` | Re-scrape the website and rebuild the index                   |
| POST   | `/api/evaluate`      | Start an evaluation run in the background                     |
| GET    | `/api/evaluate`      | Progress of the current run and the latest report             |

`POST /api/chat` streams `event: <name>` / `data: <json>` frames in this order:

| Event | Data | When |
|---|---|---|
| `status` | `{stage: "retrieving" \| "generating"}` | pipeline stage changes |
| `token` | `{text}` | each piece of the answer |
| `blocked` | `{reason, message}` | a guardrail refused the question (no tokens follow) |
| `sources` | `[{title, url, score, snippets}]` | after the answer, one entry per cited page |
| `metrics` | retrieval, guardrail and judge scores, `latency_ms` | after sources |
| `done` / `error` | `{}` / `{message}` | stream ends |

```bash
curl -N -X POST localhost:8000/api/chat -H "Content-Type: application/json" -d '{"question":"Who is the principal?"}'
```

Interactive docs: http://localhost:8000/docs

## Configuration

All settings live in `backend/app/config.py` and can be overridden in `backend/.env`:

| Variable             | Default                 | Meaning                                              |
| -------------------- | ----------------------- | ---------------------------------------------------- |
| `GEMINI_API_KEY`     | (none, required)        | Google Gemini API key                                |
| `GEMINI_MODEL`       | `gemini-3.5-flash-lite` | Model for answers, scope checks and judging          |
| `TOP_K`              | `4`                     | Chunks passed to the LLM                             |
| `USE_RERANKER`       | `true`                  | Enable cross-encoder re-ranking                      |
| `CANDIDATE_K`        | `30`                    | Candidates fetched before re-ranking                 |
| `ACCEPT_RERANK`      | `0.01`                  | Answer directly if the best re-rank score ≥ this     |
| `BLOCK_DISTANCE`     | `1.6`                   | Refuse directly if the nearest chunk is farther      |
| `CHROMA_DIR`         | `backend/chroma_db`     | Where the vector index is stored                     |
| `WARMUP_ON_START`    | `true`                  | Load models in the background at startup             |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `600` / `100` | Chunking parameters                                  |
| `VERIFY_SSL`         | `false`                 | Verify the college site's TLS certificate            |
