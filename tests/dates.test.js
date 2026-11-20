import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonthsClamped, daysBetween, formatDuration, isDateKey } from "../src/lib/dates.js";

test("daysBetween cuenta días enteros sin importar horario de verano", () => {
  assert.equal(daysBetween("2025-01-01", "2025-01-31"), 30);
  assert.equal(daysBetween("2024-03-01", "2025-03-01"), 365);
  assert.equal(daysBetween("2025-05-10", "2025-05-01"), -9);
});

test("addMonthsClamped ajusta los días 29–31 al último del mes", () => {
  assert.equal(addMonthsClamped("2025-01-31", 1), "2025-02-28");
  assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsClamped("2025-01-31", 2, 31), "2025-03-31");
  assert.equal(addMonthsClamped("2025-11-15", 3), "2026-02-15");
});

test("formatDuration es legible", () => {
  assert.equal(formatDuration("2025-01-01", "2025-01-13"), "12 días");
  assert.equal(formatDuration("2025-01-01", "2026-04-02"), "1 año y 3 meses");
});

test("isDateKey valida el formato", () => {
  assert.ok(isDateKey("2025-02-03"));
  assert.ok(!isDateKey("2025-2-3"));
  assert.ok(!isDateKey(null));
});
