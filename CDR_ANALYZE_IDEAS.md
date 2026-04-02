# CDR Analyze — Feature Ideas

The **Analyze CDR** button accepts a CSV export from the platform and runs it through an AI model (Claude). The AI returns structured JSON — agents, numbers, queues, call patterns, and recommendations. Below are two product directions built on top of this capability.

---

## Idea 1: CDR Analytics Report

### What it does
Instead of just surfacing basic call counts, the Analyze CDR button generates a **deep analytics report** from the raw CDR file. The user uploads their CDR export and gets back a full performance breakdown — no manual pivot tables, no Excel formulas.

### Report Output

**Call Volume & Patterns**
- Total calls by day, week, hour of day
- Inbound vs. outbound split
- Peak hours and busiest days of the week
- After-hours call volume (calls received outside business hours)

**Answer & Outcome Metrics**
- Answer rate, missed call rate, abandon rate
- Hold time distribution (avg, median, p90)
- Voicemail rate
- Average and median talk time
- Call result breakdown (Answered, Missed, Abandoned, Overflow, Voicemail)

**Queue & Department Performance**
- Per-queue: total calls, answered, abandoned, avg hold time
- Overflow frequency — which queues overflow most often
- After-hours queue activity

**Agent Performance**
- Per-agent: total calls handled, total talk time, avg duration, missed %
- Agents sorted by volume vs. sorted by efficiency
- Agents with unusually high missed rates (flagged)

**AI-Generated Summary**
- 5–6 sentence executive summary connecting the data to specific, actionable findings
- Written in plain language for a non-technical manager or owner

---

## Idea 2: Agent Coaching Recommendation

### What it does
After analyzing the CDR, the AI identifies **which specific agents would benefit most from coaching** and **what kind of coaching** would help their performance — based entirely on their call data patterns.

### How it works
The AI looks at each agent's metrics and detects behavioral patterns:

| Pattern Detected | What It Signals | Recommended Action |
|---|---|---|
| High missed % + low call volume | Availability or schedule issue | Adjust shift hours or ring timeout |
| Short avg talk time + high volume | Rushing through calls, may be dropping | Call quality coaching |
| Long avg talk time + few calls | Struggling to resolve calls efficiently | Resolution & wrap-up training |
| High hold time placed on calls | Not knowing answers, escalating too much | Product knowledge training |
| Consistent after-hours misses | No coverage handoff | After-hours routing or on-call setup |
| High abandon on their queue | Callers hanging up before agent answers | Staffing or response time issue |

### Output per Agent
```
Agent: Maria Lopez · Ext 104
Calls: 87 | Talk Time: 4h 12m | Missed: 31% | Avg Duration: 1m 48s

⚠ High missed rate (31%) combined with a short average talk time (1m 48s)
suggests calls are being dropped or abandoned before full resolution.

Recommendation: Review ring timeout settings for this extension and consider
a 1:1 coaching session focused on call handling and wrap-up time.
```

### Aggregate Coaching Summary
At the team level, the AI also surfaces:
- Which **type of coaching need** is most common across all agents (e.g. "6 of 9 agents show signs of availability issues")
- Whether the problem is **structural** (routing, staffing, schedules) vs. **individual** (agent skill gaps)
- A prioritized list of agents to address first, ranked by impact on overall answer rate

---

## Technical Implementation

### How the Button Works End-to-End

The button does **not** require the user to manually download and re-upload a CSV. When clicked, the frontend passes the `accountId` and a date range to a new backend endpoint. That endpoint queries the CDR data directly from your existing database, formats it, and sends it to OpenAI. The result comes back as structured JSON and is rendered in a modal.

```
[Frontend Button Click]
        │
        ▼
POST /api/analyze-cdr
  { accountId, dateFrom, dateTo, scope }
        │
        ▼
[Your Backend Service — running on AWS]
  1. Authenticate request (validate JWT, extract accountId)
  2. Query CDR records from your existing database
     — RDS: SELECT * FROM cdr WHERE account_id = ? AND call_date BETWEEN ? AND ?
     — DynamoDB: Query by accountId + callDate GSI
     — Limit to ~800 rows or 40,000 characters of CSV text to stay within GPT context window
  3. Serialize records to CSV string (same column format as your existing CSV export)
  4. Call OpenAI API (server-side, key never exposed to client)
  5. Parse JSON response
  6. Return structured result to frontend
        │
        ▼
[OpenAI GPT API]
  — Receives CSV text + prompt
  — Returns strict JSON (agents, insights, recommendations, agentInsights)
        │
        ▼
[Frontend renders modal]
```

### Where the OpenAI Key Lives

Store the OpenAI API key in **AWS Secrets Manager** (or AWS SSM Parameter Store as a `SecureString`). Your backend service retrieves it at startup or per-request. It must never appear in:
- Environment variables committed to source control
- Any client-side bundle
- API responses

```
AWS Secrets Manager
  └── /n2p/prod/openai-api-key   ← backend reads this at runtime
```

### CDR Data Size Management

GPT has a context window limit. Before sending to OpenAI, the backend must:

1. **Limit the query** — fetch at most 800 rows from the database (add `LIMIT 800` or equivalent)
2. **Serialize to CSV text** — use the same column order as your existing CDR export
3. **Hard truncate** — if the serialized text exceeds 40,000 characters, cut at the last complete newline and append `[... truncated]`
4. **Never send raw binary or blobs** — only the text fields relevant to analysis (timestamps, numbers, agent names, durations, statuses, queues)

### API Endpoint Spec

**New endpoint on your existing backend service** (not a separate Lambda):

```
POST /api/v1/accounts/{accountId}/analyze-cdr
Authorization: Bearer {jwt}

Request body:
{
  "dateFrom": "2025-01-01",
  "dateTo":   "2025-01-31",
  "scope":    "company" | "user"   // company = all agents, user = requesting user only
}

Response 200:
{
  "agents":          [{ "name": string, "extension": string }],
  "inboundNumbers":  string[],
  "queues":          string[],
  "insights":        string[],
  "agentInsights":   [{ "name": string, "extension": string, "metrics": {...}, "pattern": string, "recommendation": string }],
  "recommendations": { ... },
  "summary":         string
}

Response 429: { "error": "Too many requests", "retryAfterSec": number }
Response 413: { "error": "CDR dataset too large" }
Response 401: { "error": "Unauthorized" }
```

### OpenAI Model Selection

| Use Case | Model | Why |
|---|---|---|
| Idea 1 — Analytics Report (pre-computed KPIs sent as numbers) | `gpt-4o-mini` | Cheap, fast — just needs to write a summary from structured data |
| Idea 2 — Agent Coaching (raw CSV, pattern detection) | `gpt-4o` | Needs reasoning over raw text to detect behavioral patterns |

### Rate Limiting

Limit per `accountId` (not per IP, since you have account context in the JWT):
- **10 requests per account per hour** — these are expensive GPT calls
- Return `429` with a `Retry-After` header
- Implement using your existing Redis cluster if available, otherwise in-memory per instance

### Timeout

OpenAI calls on large CDR sets can take 15–45 seconds. Make sure:
- Your load balancer / API Gateway idle timeout is set to **at least 60 seconds**
- Your backend HTTP client timeout for the OpenAI call is **90 seconds**
- The frontend shows a loading state and does not retry automatically on slow responses

### Prompt Additions Needed per Idea

Both ideas use the same endpoint. The prompt controls what comes back:

- **Idea 1 (Analytics Report):** Add to the prompt — request `dailyVolume[]`, `hourlyPattern[]`, `queueBreakdown[]`, `resultBreakdown[]`
- **Idea 2 (Agent Coaching):** Add to the prompt — request `agentInsights[]` with one object per agent containing their computed metrics, the detected pattern, and a plain-English coaching recommendation sentence
