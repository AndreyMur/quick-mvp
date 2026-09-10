import { test, expect } from "@playwright/test";

test.describe("публичные страницы", () => {
  test("главная страница показывает заголовок и CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("MVP Calculator");
    await expect(
      page.getByRole("heading", { name: /Узнайте бюджет и сроки MVP/ })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Попробовать бесплатно" })
    ).toBeVisible();
  });

  test("страница тарифов показывает три тарифа", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Тарифы" })).toBeVisible();
    await expect(page.getByText("Бесплатный", { exact: true })).toBeVisible();
    await expect(page.getByText("Профессиональный", { exact: true })).toBeVisible();
    await expect(page.getByText("Бизнес", { exact: true })).toBeVisible();
  });

  test("страница API-документации открывается", async ({ page }) => {
    await page.goto("/api-docs");
    await expect(page).toHaveTitle("API Docs | MVP Calculator");
    await expect(page.locator("#swagger-ui")).toBeVisible();
  });
});
