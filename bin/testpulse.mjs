#!/usr/bin/env node
// Thin launcher so `npx testpulse` works without a separate build step.
// Uses tsx's programmatic API to run the TypeScript CLI directly.
import { tsImport } from 'tsx/esm/api';

// Relative specifier resolved against this file's URL (tsImport requires a
// file:// parent, not a bare Windows path).
await tsImport('../src/cli.ts', import.meta.url);
