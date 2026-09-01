import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolvePlay, evaluateNumberPlay, createRoundState, dealRound,
  enumerateLegalPlays, resolveCpuPolicy, playRound, createRng,
} from "./index.ts";

test("core.ts split: all headline symbols resolve through the barrel", () => {
  for (const fn of [
    resolvePlay, evaluateNumberPlay, createRoundState, dealRound,
    enumerateLegalPlays, resolveCpuPolicy, playRound, createRng,
  ]) {
    assert.equal(typeof fn, "function");
  }
});
