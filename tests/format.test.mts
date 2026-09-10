import { test } from "node:test";
import assert from "node:assert/strict";
import { createFormatter } from "next-intl";
import { defaultLocale } from "../i18n/config.ts";

const format = createFormatter({ locale: defaultLocale, timeZone: "UTC" });

test("форматирует дату по локали ru", () => {
  const value = format.dateTime(new Date(Date.UTC(2026, 0, 15)), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  assert.equal(value, "15 января 2026 г.");
});

test("форматирует короткую дату по локали ru", () => {
  assert.equal(format.dateTime(new Date(Date.UTC(2026, 0, 15))), "15.01.2026");
});

test("форматирует число с разделителями по локали ru", () => {
  assert.equal(format.number(1234567.89), "1\u00A0234\u00A0567,89");
  assert.equal(format.number(1234), "1\u00A0234");
});

test("форматирует коэффициент с фиксированной точностью по локали ru", () => {
  assert.equal(
    format.number(1.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    "1,50",
  );
});

test("форматирует проценты по локали ru", () => {
  assert.equal(format.number(0.5, { style: "percent" }), "50\u00A0%");
  assert.equal(format.number(45.7, { maximumFractionDigits: 0 }), "46");
});
