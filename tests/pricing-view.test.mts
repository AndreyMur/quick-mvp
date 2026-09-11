import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getPlanButtonState,
  getSubscriptionStatusView,
  getCheckoutErrorKey,
  parseCheckoutOutcome,
} from "../lib/pricing/view.ts";

/**
 * Тесты логики страницы тарифов (фаза 23, #68/#69/#70).
 */

test("текущий тариф заблокирован (нет повторной оплаты)", () => {
  for (const tier of ["free", "pro", "business"] as const) {
    const state = getPlanButtonState({
      tier,
      currentTier: tier,
      isAuthenticated: true,
    });
    assert.equal(state.disabled, true);
    assert.equal(state.action, "none");
    assert.equal(state.isCurrent, true);
  }
});

test("платные тарифы активны для бесплатного пользователя", () => {
  const pro = getPlanButtonState({
    tier: "pro",
    currentTier: "free",
    isAuthenticated: true,
  });
  const business = getPlanButtonState({
    tier: "business",
    currentTier: "free",
    isAuthenticated: true,
  });

  assert.deepEqual(pro, { disabled: false, action: "checkout", isCurrent: false });
  assert.deepEqual(business, {
    disabled: false,
    action: "checkout",
    isCurrent: false,
  });
});

test("для гостя клик по платному тарифу ведёт на вход", () => {
  const pro = getPlanButtonState({
    tier: "pro",
    currentTier: "free",
    isAuthenticated: false,
  });
  assert.equal(pro.disabled, false);
  assert.equal(pro.action, "login");
});

test("понижение тарифа недоступно", () => {
  const toPro = getPlanButtonState({
    tier: "pro",
    currentTier: "business",
    isAuthenticated: true,
  });
  const toFree = getPlanButtonState({
    tier: "free",
    currentTier: "pro",
    isAuthenticated: true,
  });

  assert.equal(toPro.disabled, true);
  assert.equal(toPro.action, "none");
  assert.equal(toFree.disabled, true);
});

test("повышение pro → business активно", () => {
  const state = getPlanButtonState({
    tier: "business",
    currentTier: "pro",
    isAuthenticated: true,
  });
  assert.equal(state.disabled, false);
  assert.equal(state.action, "checkout");
});

test("бесплатный тариф нельзя оплатить", () => {
  const state = getPlanButtonState({
    tier: "free",
    currentTier: "free",
    isAuthenticated: true,
  });
  assert.equal(state.disabled, true);
});

test("parseCheckoutOutcome разбирает success/cancelled/error", () => {
  assert.equal(parseCheckoutOutcome("success"), "success");
  assert.equal(parseCheckoutOutcome("cancelled"), "cancelled");
  assert.equal(parseCheckoutOutcome("error"), "error");
  assert.equal(parseCheckoutOutcome(null), null);
  assert.equal(parseCheckoutOutcome("unknown"), null);
});

test("статусы подписки получают понятный ключ и тон", () => {
  assert.equal(getSubscriptionStatusView("active").key, "active");
  assert.equal(getSubscriptionStatusView("trialing").key, "trialing");
  assert.equal(getSubscriptionStatusView("past_due").tone, "warning");
  assert.equal(getSubscriptionStatusView("canceled").key, "canceled");
  assert.equal(
    getSubscriptionStatusView("active", true).tone,
    "warning",
    "отмена в конце периода подсвечивается предупреждением"
  );
  assert.equal(getSubscriptionStatusView(null).key, "inactive");
});

test("ошибки checkout преобразуются в ключи сообщений", () => {
  assert.equal(getCheckoutErrorKey(401), "unauthorized");
  assert.equal(getCheckoutErrorKey(409), "alreadyActive");
  assert.equal(getCheckoutErrorKey(503), "notConfigured");
  assert.equal(getCheckoutErrorKey(500), "error");
});
