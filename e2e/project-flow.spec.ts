import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { canUseTestUser, signIn } from "./helpers/auth";

async function buildAndCalculate(page: Page, name: string) {
  await signIn(page);
  await page.goto("/projects/new");

  await page.getByLabel("Название проекта").fill(name);
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
}

function projectIdFromUrl(page: Page): string | undefined {
  return page.url().match(/\/projects\/([^/]+)\/result/)?.[1];
}

// @react-pdf stores the document title in the PDF info dictionary as raw
// UTF-16BE bytes, so the project name appears in the file in that encoding.
function utf16be(value: string): Buffer {
  return Buffer.from(value, "utf16le").swap16();
}

test.describe("конструктор и результат", () => {
  test.skip(!canUseTestUser, "задайте E2E_USER_EMAIL/E2E_USER_PASSWORD или SUPABASE_SERVICE_ROLE_KEY");

  test("проходит шаги 1-4, считает, сохраняет и перезагружает результат", async ({
    page,
  }) => {
    await buildAndCalculate(page, `E2E проект ${Date.now()}`);
    const projectId = projectIdFromUrl(page);

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

  test("кнопка «Экспорт в PDF» скачивает project-name.pdf с корректным содержимым (#60)", async ({
    page,
  }) => {
    const projectName = `E2E экспорт ${Date.now()}`;
    await buildAndCalculate(page, projectName);
    const projectId = projectIdFromUrl(page);

    try {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Экспорт в PDF" }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(`${projectName}.pdf`);

      const filePath = await download.path();
      expect(filePath).toBeTruthy();
      const buffer = readFileSync(filePath!);

      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(buffer.includes(Buffer.from("%%EOF"))).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.includes(utf16be(projectName))).toBe(true);

      await expect(page.getByText("PDF скачан")).toBeVisible();
    } finally {
      if (projectId) {
        await page.request.delete(`/api/projects/${projectId}`);
      }
    }
  });
});
