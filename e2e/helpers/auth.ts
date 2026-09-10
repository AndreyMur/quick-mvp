import { expect, type Page } from "@playwright/test";
import { TEST_USER } from "./user";

export { TEST_USER, canUseTestUser } from "./user";

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Пароль").fill(TEST_USER.password);
  await page.locator("form").getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}
