import { test, expect } from "@playwright/test";
import { canUseTestUser, signIn } from "./helpers/auth";

test.describe("авторизация", () => {
  test("страница входа показывает форму и ссылку на регистрацию", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Вход", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Зарегистрироваться" }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("страница регистрации показывает форму и ссылку на вход", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText("Регистрация", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("валидация отклоняет короткий пароль", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Пароль").fill("123");
    await page.locator("form").getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Минимум 6 символов")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("неверные учётные данные не пускают в систему", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`wrong-${Date.now()}@example.com`);
    await page.getByLabel("Пароль").fill("wrong-password");
    const authResponse = page.waitForResponse(
      (res) => res.url().includes("/auth/v1/token"),
      { timeout: 60_000 }
    );
    await page.locator("form").getByRole("button", { name: "Войти" }).click();
    await authResponse;
    await expect(page.locator("[data-sonner-toast]")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("регистрация отклоняет короткий пароль", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Имя").fill("E2E User");
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Пароль").fill("123");
    await page
      .locator("form")
      .getByRole("button", { name: "Зарегистрироваться" })
      .click();
    await expect(page.getByText("Минимум 6 символов")).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("регистрация нового пользователя показывает успех", async ({ page }) => {
    await page.route("**/auth/v1/signup*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "00000000-0000-0000-0000-000000000000",
          aud: "authenticated",
          role: "authenticated",
          email: "e2e-new@example.com",
          email_confirmed_at: null,
          phone: "",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: { full_name: "E2E User" },
          identities: [],
          created_at: "2026-09-10T00:00:00.000Z",
          updated_at: "2026-09-10T00:00:00.000Z",
        }),
      })
    );

    await page.goto("/register");
    await page.getByLabel("Имя").fill("E2E User");
    await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.com`);
    await page.getByLabel("Пароль").fill("password123");
    await page
      .locator("form")
      .getByRole("button", { name: "Зарегистрироваться" })
      .click();
    await expect(page.getByText(/Регистрация успешна/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test("вход существующего пользователя открывает дашборд", async ({ page }) => {
    test.skip(!canUseTestUser, "задайте E2E_USER_EMAIL/E2E_USER_PASSWORD или SUPABASE_SERVICE_ROLE_KEY");
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Мои проекты" })
    ).toBeVisible();
  });
});
