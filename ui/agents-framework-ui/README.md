# Agents Framework UI

An interactive walkthrough of the Utopia Studio Agents Framework. It routes a request to the smallest appropriate build path, then demonstrates the resulting agent flow, harness, and handoff artifacts.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The Weekly Research Brief is shown as a Claude scheduled-task skill. Managed Surface and Coded Agent examples use Mastra as their standard agent harness. The production build uses Next.js so it can deploy directly to Vercel.
