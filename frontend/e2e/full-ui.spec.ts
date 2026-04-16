import { expect, test } from '@playwright/test';

test('full website interactions are functional', async ({ page }) => {
  const unique = Date.now();
  const username = `uiuser${unique}`;
  const email = `${username}@example.com`;

  await page.goto('/register');

  await page.getByTestId('register-username').fill(username);
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('pass1234');
  await page.getByTestId('register-confirm-password').fill('pass1234');
  await page.getByTestId('register-age').fill('27');
  await page.getByTestId('register-weight').fill('68');
  await page.getByTestId('register-height').fill('172');
  await page.getByTestId('register-medical-conditions').fill('asthma');
  await page.getByTestId('register-allergies').fill('none');
  await page.getByTestId('register-dietary-preferences').fill('vegetarian');
  await page.getByTestId('register-submit').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('dashboard-page')).toBeVisible();

  await page.getByTestId('notifications-button').click();
  await expect(page.getByTestId('notifications-panel')).toBeVisible();

  await page.getByTestId('nav-profile').click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByTestId('profile-allergies').fill('dust allergy');
  await page.getByTestId('profile-medical-history').fill('mild asthma, no recent flare-ups');
  await page.getByTestId('profile-save-button').click();
  await expect(page.getByText('Profile updated successfully.')).toBeVisible();

  await page.getByTestId('nav-medicines').click();
  await expect(page).toHaveURL(/\/medicines$/);
  await page.getByTestId('symptom-input').fill('fever and sore throat');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('Recommended Treatment')).toBeVisible();
  await expect(page.getByText('Natural Alternative')).toBeVisible();
  await expect(page.getByText('Duration')).toBeVisible();

  await page.getByTestId('open-diet-from-medicines').click();
  await expect(page).toHaveURL(/\/diet$/);
  await page.getByTestId('generate-plan-button').click();
  await expect(page.getByText(/Diet plan regenerated|No previous symptoms found/)).toBeVisible();

  await page.getByTestId('edit-preferences-button').click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByTestId('nav-diet-plan').click();
  await expect(page).toHaveURL(/\/diet$/);

  await page.getByTestId('nav-settings').click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByTestId('dark-mode-switch').click();
  await page.getByTestId('medication-switch').click();
  await page.getByTestId('diet-switch').click();
  await page.getByTestId('weekly-switch').click();
  await page.getByTestId('save-settings-button').click();
  await expect(page.getByText('Settings saved successfully.')).toBeVisible();

  await page.getByTestId('nav-appointments').click();
  await expect(page).toHaveURL(/\/appointments$/);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);

  await page.getByTestId('appointment-title').fill('General Checkup');
  await page.getByTestId('appointment-provider').fill('Dr. Sharma');
  await page.getByTestId('appointment-date').fill(date);
  await page.getByTestId('appointment-time').fill('10:30');
  await page.getByTestId('appointment-notes').fill('Follow-up visit');
  await page.getByTestId('add-appointment-button').click();
  await expect(page.getByText('Appointment added.')).toBeVisible();

  const cancelButton = page.locator('[data-testid^="cancel-appointment-"]').first();
  await expect(cancelButton).toBeVisible();
  await cancelButton.click();
  await expect(page.getByText('Appointment cancelled.')).toBeVisible();

  const deleteButton = page.locator('[data-testid^="delete-appointment-"]').first();
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();
  await expect(page.getByText('Appointment deleted.')).toBeVisible();

  await page.getByTestId('chat-fab').click();
  await page.getByTestId('chat-input').fill('show my medicine history');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText(/assistant is informational only/)).toBeVisible();
});
