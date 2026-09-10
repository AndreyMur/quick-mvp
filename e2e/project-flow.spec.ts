import { test, expect } from "@playwright/test";
import { canUseTestUser, signIn } from "./helpers/auth";

test.describe("конструктор и результат", () => {
  test.skip(!canUseTestUser, "задайте E2E_USER_EMAIL/E2E_USER_PASSWORD или SUPABASE_SERVICE_ROLE_KEY");

  test("проходит шаги 1-4, считает, сохраняет и перезагружает результат", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/projects/new");

    await page.getByLabel("Название проекта").fill(`E2E проект ${Date.now()}`);
    await page.getByLabel("Краткое описание").fill("Проект для E2E-теста");
    await page.getByRole("button", { name: "Далее" }).click();

    await page.getByText("Аутентификация", { exact: true }).click();
    await expect(page.getByText(/Выбрано сервисов: 1/)).toBeVisible();
    await page.getByRole("button", { name: "Далее" }).click();

    await page.getByRole("button", { name: "Далее" }).click();

    await page.getByRole("button", { name: "Далее" }).click();

    await expect(
      page.getByRole("heading", { name: "Саммари и расчёт" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Рассчитать" }).click();

    await expect(page).toHaveURL(/\/projects\/[^/]+\/result/, {
      timeout: 30_000,
    });
    await expect(page.getByText("Роли и стоимость")).toBeVisible();

    const projectId = page.url().match(/\/projects\/([^/]+)\/result/)?.[1];

    try {
      await page.getByRole("button", { name: "Сохранить проект" }).click();
      await expect(page.getByText("Проект сохранён")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Сохранён" })
      ).toBeVisible({ timeout: 30_000 });

      await page.reload();
      await expect(page.getByRole("button", { name: "Сохранён" })).toBeVisible();
    } finally {
      if (projectId) {
        await page.request.delete(`/api/projects/${projectId}`);
      }
    }
  });
});
