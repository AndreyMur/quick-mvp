export const TEST_USER = {
  email: process.env.E2E_USER_EMAIL ?? "e2e@example.com",
  password: process.env.E2E_USER_PASSWORD ?? "e2e-password-123",
};

export const canUseTestUser = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD)
);
