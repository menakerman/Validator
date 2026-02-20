# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Bump patch version, type-check, and build to `dist/`
- `npm run lint` — Run ESLint (flat config, TS/TSX only)
- `npm run preview` — Preview the production build locally
- `npm run start` — Serve the `dist/` folder (used for Railway deployment)

## Architecture

This is a client-side-only React + TypeScript app for validating Israeli Excel data (ID numbers, phone numbers, landlines, emails). It uses Vite, Tailwind CSS v4 (via `@tailwindcss/vite` plugin), and Zustand for state management. No backend — all processing happens in the browser.

### App Flow (4 steps)

The app follows a linear step machine defined by `AppStep`: `upload` → `mapping` → `validating` → `results`. The current step lives in the Zustand store (`src/stores/validatorStore.ts`), which is the central orchestrator for the entire app lifecycle.

### Key Layers

**Excel Parsing** (`src/utils/excelParser.ts`): Uses SheetJS (`xlsx`) to parse .xlsx/.xls/.csv files. Handles HTML-based `.xls` files (common in Israeli exports) by detecting HTML content and parsing the `<table>` directly with correct charset encoding. Auto-detects the header row (first row with 3+ non-empty cells).

**Column Auto-Detection** (`src/utils/columnDetector.ts`): Two-pass detection — first matches Hebrew/English header patterns against known regex maps, then falls back to data sampling (checks first 20 rows against data patterns). Unrecognized columns default to `ignore`.

**Validators** (`src/validators/`): Each column type has a dedicated validator returning `CellValidation` with status (`valid`/`warning`/`error`), i18n message key, and optional `suggestion` for auto-fix. Email validation includes Levenshtein distance typo detection against known Israeli and international domains (`src/validators/domainTypos.ts`).

**Web Worker** (`src/workers/validation.worker.ts`): For files with >10,000 rows, validation runs in a Web Worker with progress reporting. Below that threshold, validation runs inline with `requestAnimationFrame` batching.

**Excel Export** (`src/utils/excelExporter.ts`): Uses ExcelJS to generate a styled .xlsx with color-coded cells and a summary sheet.

### Internationalization

Hebrew-first bilingual app (Hebrew + English) using `react-i18next`. Default/fallback language is Hebrew. The root `index.html` is set to `dir="rtl"`. Translation files are in `src/i18n/he.json` and `src/i18n/en.json`. Validator messages use i18n keys (e.g., `validators.phone.invalidPrefix`), not raw strings.

### Column Types

Defined as `ColumnType` in `src/types/index.ts`: `id` (Israeli ID with Luhn-variant check digit), `phone` (Israeli mobile), `landline` (Israeli landline), `email`, `ignore`.
