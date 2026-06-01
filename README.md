# Claude Teams Analytics

A local analytics dashboard for Claude Teams export data.

This project turns a Claude Teams export into a fast, browsable React dashboard with team-level, user-level, project-level, file, topic, and conversation insights that are not always visible in Claude's built-in analytics tab.

The app is designed to run locally against your exported data. It does not send chat content to an external service.

## What It Shows

- Team usage overview
- Active and inactive users
- Weekend usage
- User-level drilldowns
- Conversation history per user
- Full conversation message viewer
- Topic/theme detection
- Project and design chat summaries
- File/upload analytics
- Tool-use, tool-result, thinking, and token-budget block counts
- Daily, hourly, and weekday usage patterns

## Project Structure

```text
data/
  conversations.json
  users.json
  memories.json
  projects/
  design_chats/

scripts/
  analyze.mjs
  serve.mjs

src/
  main.jsx
  styles.css

public/generated/
  analytics.json
  conversations/
    {conversationUuid}.json

dist/
```

## How Data Flows

```text
Claude Teams export files
  -> scripts/analyze.mjs
  -> public/generated/analytics.json
  -> public/generated/conversations/{uuid}.json
  -> React dashboard
```

The analyzer reads the large `data/conversations.json` file as a top-level JSON stream, one conversation at a time. This avoids loading the full export into memory as one giant object.

The generated dashboard data is split into two layers:

- `public/generated/analytics.json`: compact summary/index data for the dashboard
- `public/generated/conversations/{uuid}.json`: one detail file per conversation, loaded only when a conversation is opened

This keeps the UI responsive even when the original export is large.

## Setup

Install dependencies:

```bash
npm install
```

Generate analytics from the local export:

```bash
npm run analyze
```

Run the development server:

```bash
npm run dev
```

Build the production app:

```bash
npm run build
```

Serve the built app locally:

```bash
npm run serve
```

By default, the production server uses:

```text
http://127.0.0.1:4173
```

The development server uses Vite and can be configured with a port:

```bash
npm run dev -- --port 3033
```

## Data Requirements

Place an extracted Claude Teams export in the `data/` folder.

Expected files:

```text
data/conversations.json
data/users.json
data/projects/*.json
data/design_chats/*.json
data/memories.json
```

The dashboard can still work if some optional folders are missing, but `conversations.json` and `users.json` are the primary files.

## Developer Notes

### Analyzer

The main analyzer lives in:

```text
scripts/analyze.mjs
```

It calculates:

- global summary metrics
- user-level aggregates
- conversation index rows
- topic buckets
- file extension/name counts
- project summaries
- design chat summaries
- per-conversation detail chunks

The analyzer currently uses simple local heuristics for topic detection. It does not call an LLM or external API.

### Frontend

The React app lives in:

```text
src/main.jsx
src/styles.css
```

The UI fetches:

```text
/generated/analytics.json
```

When opening a conversation, it fetches:

```text
/generated/conversations/{conversationUuid}.json
```

This is intentional. The full message text is kept out of the main dashboard payload.

### Generated Files

Generated analytics files are ignored by Git:

```text
public/generated/
dist/
```

This helps avoid accidentally committing private team chat data.

## Privacy Notes

Claude Teams exports can contain sensitive business information, code, customer details, uploaded file names, and user email addresses.

Before publishing, sharing, or deploying this project:

- Do not commit `data/`
- Do not commit `public/generated/`
- Do not commit `dist/` if it contains generated data
- Review screenshots before sharing them
- Consider adding sample/mock export data for public demos

## Open Source Readiness

This project is a good candidate for open source, with one important caveat: the export data is private and must never be included in the repository.

Recommended open-source steps:

- Add a clear license, such as MIT or Apache-2.0
- Add sanitized sample data under `sample-data/`
- Add a `data/.gitkeep` file and keep real exports ignored
- Document supported Claude export formats
- Add screenshots using fake/mock data
- Add a privacy/security section
- Add contribution guidelines once the structure stabilizes

## Current Limitations

- The app currently analyzes one extracted export folder at a time.
- Topic detection is keyword-based, not semantic clustering.
- There is no persistent database yet.
- There is no authentication or hosted backend.
- Multiple overlapping exports are not deduplicated yet.

For the planned multi-export backend direction, see:

```text
docs/multiple-exports-plan.md
```

