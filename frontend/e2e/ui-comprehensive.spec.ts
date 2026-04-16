import { expect, Page, test } from '@playwright/test';

type Credentials = {
  username: string;
  email: string;
  password: string;
};

const registerUser = async (page: Page): Promise<Credentials> => {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const credentials: Credentials = {
    username: `allui${unique}`,
    email: `allui${unique}@example.com`,
    password: 'pass1234',
  };

  await page.goto('/register');
  await page.getByTestId('register-username').fill(credentials.username);
  await page.getByTestId('register-email').fill(credentials.email);
  await page.getByTestId('register-password').fill(credentials.password);
  await page.getByTestId('register-confirm-password').fill(credentials.password);
  await page.getByTestId('register-age').fill('28');
  await page.getByTestId('register-gender').selectOption('female');
  await page.getByTestId('register-weight').fill('66');
  await page.getByTestId('register-height').fill('168');
  await page.getByTestId('register-activity-level').selectOption('active');
  await page.getByTestId('register-medical-conditions').fill('seasonal migraine');
  await page.getByTestId('register-allergies').fill('dust');
  await page.getByTestId('register-dietary-preferences').fill('high protein');
  await page.getByTestId('register-submit').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('dashboard-page')).toBeVisible();

  return credentials;
};

const tomorrowDate = (): string => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dayAfterTomorrowDate = (): string => {
  const value = new Date();
  value.setDate(value.getDate() + 2);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

test('all tabs and interactive controls work end-to-end', async ({ page }) => {
  const credentials = await registerUser(page);

  await page.getByTestId('notifications-button').click();
  await expect(page.getByTestId('notifications-panel')).toBeVisible();
  await page.getByTestId('notifications-button').click();
  await expect(page.getByTestId('notifications-panel')).toBeHidden();

  await page.getByTestId('nav-dashboard').click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByTestId('nav-medicines').click();
  await expect(page).toHaveURL(/\/medicines$/);
  await expect(page.getByTestId('analyze-button')).toBeDisabled();
  await page.getByTestId('symptom-input').fill('fever with headache and sore throat');
  await expect(page.getByTestId('analyze-button')).toBeEnabled();
  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('Recommended Treatment')).toBeVisible();
  await expect(page.getByTestId('open-diet-from-medicines')).toBeVisible();

  const chipButtons = page.locator('.vs-common-searches button');
  const chipCount = await chipButtons.count();
  for (let index = 0; index < chipCount; index += 1) {
    await chipButtons.nth(index).click();
    await expect(page.getByText('Recommended Treatment')).toBeVisible();
  }

  await page.getByTestId('open-diet-from-medicines').click();

  await expect(page).toHaveURL(/\/diet$/);
  await page.getByTestId('generate-plan-button').click();
  await expect(page.getByText(/Diet plan regenerated|No previous symptoms found/)).toBeVisible();
  await page.getByTestId('edit-preferences-button').click();

  await expect(page).toHaveURL(/\/profile$/);
  await page.getByLabel('Gender').selectOption('other');
  await page.getByTestId('profile-activity-level').selectOption('very_active');
  await page.getByTestId('profile-allergies').fill('temporary-allergy-value');
  await page.getByTestId('profile-medical-history').fill('temporary-history-value');
  await page.getByTestId('profile-dietary-preferences').fill('temporary-diet-value');
  await page.getByTestId('profile-cancel-button').click();
  await expect(page.getByTestId('profile-allergies')).not.toHaveValue('temporary-allergy-value');

  await page.getByLabel('Gender').selectOption('female');
  await page.getByTestId('profile-activity-level').selectOption('active');
  await page.getByTestId('profile-allergies').fill('pollen');
  await page.getByTestId('profile-medical-history').fill('updated profile history');
  await page.getByTestId('profile-dietary-preferences').fill('updated profile preferences');
  await page.getByTestId('profile-save-button').click();
  await expect(page.getByText('Profile updated successfully.')).toBeVisible();

  await page.getByTestId('nav-appointments').click();
  await expect(page).toHaveURL(/\/appointments$/);

  await page.getByTestId('appointment-title').fill('Cardiology Consultation');
  await page.getByTestId('appointment-provider').fill('Dr. Mehta');
  await page.getByTestId('appointment-date').fill(tomorrowDate());
  await page.getByTestId('appointment-time').fill('10:10');
  await page.getByTestId('appointment-mode').selectOption('video');
  await page.getByTestId('appointment-notes').fill('Initial appointment');
  await page.getByTestId('add-appointment-button').click();
  await expect(page.getByText('Appointment added.')).toBeVisible();

  const firstEdit = page.getByTestId('upcoming-appointments').locator('[data-testid^="edit-appointment-"]').first();
  await firstEdit.click();
  await expect(page.getByTestId('reset-appointment-form')).toBeVisible();
  await page.getByTestId('reset-appointment-form').click();
  await expect(page.getByRole('heading', { name: 'Add Appointment' })).toBeVisible();

  await firstEdit.click();
  await page.getByTestId('appointment-time').fill('11:40');
  await page.getByTestId('add-appointment-button').click();
  await expect(page.getByText('Appointment updated.')).toBeVisible();

  const completeButton = page.getByTestId('upcoming-appointments').locator('[data-testid^="complete-appointment-"]').first();
  await completeButton.click();
  await expect(page.getByText('Appointment marked as completed.')).toBeVisible();
  await expect(page.getByTestId('history-appointments')).toContainText('Completed');

  await page.getByTestId('appointment-title').fill('Dermatology Follow-up');
  await page.getByTestId('appointment-provider').fill('Dr. Rao');
  await page.getByTestId('appointment-date').fill(dayAfterTomorrowDate());
  await page.getByTestId('appointment-time').fill('09:25');
  await page.getByTestId('appointment-mode').selectOption('in_person');
  await page.getByTestId('appointment-notes').fill('Skin review');
  await page.getByTestId('add-appointment-button').click();
  await expect(page.getByText('Appointment added.')).toBeVisible();

  const cancelButton = page.getByTestId('upcoming-appointments').locator('[data-testid^="cancel-appointment-"]').first();
  await cancelButton.click();
  await expect(page.getByText('Appointment cancelled.')).toBeVisible();

  const restoreButton = page.getByTestId('history-appointments').locator('[data-testid^="restore-appointment-"]').first();
  await restoreButton.click();
  await expect(page.getByText('Appointment restored to scheduled.')).toBeVisible();

  const deleteUpcoming = page.getByTestId('upcoming-appointments').locator('[data-testid^="delete-appointment-"]').first();
  await deleteUpcoming.click();
  await expect(page.getByText('Appointment deleted.')).toBeVisible();

  const deleteHistory = page.getByTestId('history-appointments').locator('[data-testid^="delete-appointment-"]').first();
  await deleteHistory.click();
  await expect(page.getByText('Appointment deleted.')).toBeVisible();

  await page.getByTestId('nav-settings').click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByTestId('dark-mode-switch').click();
  await page.getByTestId('medication-switch').click();
  await page.getByTestId('diet-switch').click();
  await page.getByTestId('weekly-switch').click();
  await page.getByTestId('save-settings-button').click();
  await expect(page.getByText('Settings saved successfully.')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/vs-dark-mode/);

  await page.getByTestId('notifications-button').click();
  const notificationsPanel = page.getByTestId('notifications-panel');
  await expect(notificationsPanel).toBeVisible();
  await expect(notificationsPanel).toContainText('Medication reminders disabled');
  await expect(notificationsPanel).toContainText('Diet alerts disabled');
  await expect(notificationsPanel).toContainText('Weekly reports enabled');
  await page.getByTestId('notifications-button').click();

  await page.getByTestId('chat-fab').click();
  await expect(page.getByTestId('chat-panel')).toBeVisible();
  await page.getByTestId('chat-input').fill('show me a quick health summary');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-msg-user').last()).toHaveText('show me a quick health summary');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');

  for (let index = 0; index < 3; index += 1) {
    const userMessageCount = await page.getByTestId('chat-msg-user').count();
    const botMessageCount = await page.getByTestId('chat-msg-bot').count();
    await page.getByTestId(`chat-quick-reply-${index}`).click();
    await expect(page.getByTestId('chat-msg-user')).toHaveCount(userMessageCount + 1);
    await expect(page.getByTestId('chat-msg-bot')).toHaveCount(botMessageCount + 1);
  }

  await page.getByTestId('chat-close').click();
  await expect(page.getByTestId('chat-panel')).toBeHidden();
  await page.getByTestId('chat-fab').click();
  await expect(page.getByTestId('chat-panel')).toBeVisible();

  await page.getByTestId('logout-button').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByTestId('login-username').fill(credentials.username);
  await page.getByTestId('login-password').fill(credentials.password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('empty-state controls behave correctly', async ({ page }) => {
  await registerUser(page);

  await page.getByTestId('nav-diet-plan').click();
  await expect(page).toHaveURL(/\/diet$/);
  await expect(page.getByTestId('go-medicines-button')).toBeVisible();
  await page.getByTestId('generate-plan-button').click();
  await expect(page.getByText('No previous symptoms found. Open Medicines and run analysis first.')).toBeVisible();
  await page.getByTestId('go-medicines-button').click();

  await expect(page).toHaveURL(/\/medicines$/);
  await expect(page.getByTestId('upload-trigger')).toHaveCount(0);
  await expect(page.getByTestId('upload-input')).toHaveCount(0);
  await page.getByTestId('symptom-input').fill('mild fever and cough');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('Recommended Treatment')).toBeVisible();
});

test('auth form validation errors are shown from UI', async ({ page }) => {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  await page.goto('/register');
  await page.getByTestId('register-username').fill(`mismatch${unique}`);
  await page.getByTestId('register-email').fill(`mismatch${unique}@example.com`);
  await page.getByTestId('register-password').fill('pass1234');
  await page.getByTestId('register-confirm-password').fill('pass12345');
  await page.getByTestId('register-age').fill('26');
  await page.getByTestId('register-weight').fill('70');
  await page.getByTestId('register-height').fill('171');
  await page.getByTestId('register-submit').click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();

  await page.goto('/login');
  await page.getByTestId('login-username').fill(`invalid${unique}`);
  await page.getByTestId('login-password').fill('wrongpass');
  await page.getByTestId('login-submit').click();
  await expect(page.getByText('Incorrect username or password')).toBeVisible();
});

test('medicines page stays stable with malformed cached recommendation data', async ({ page }) => {
  await registerUser(page);

  await page.goto('/medicines');
  await expect(page).toHaveURL(/\/medicines$/);

  await page.evaluate(() => {
    localStorage.setItem(
      'latestRecommendation',
      JSON.stringify({
        disease_analysis: { condition: 'Broken payload', possible_causes: 'not-an-array' },
        drug_recommendations: 'invalid-type',
        previous_drug_records: null,
        diet_plan: null,
      }),
    );
  });

  await page.reload();
  await expect(page.getByTestId('medicines-page')).toBeVisible();
  await expect(page.getByText('Why this condition is likely')).toBeVisible();

  await page.getByTestId('symptom-input').fill('fever and sore throat');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('Recommended Treatment')).toBeVisible();
});

test('medicines analysis triggers only on Analyze button click', async ({ page }) => {
  await registerUser(page);

  let recommendationCalls = 0;
  await page.route('**/recommendations', async (route) => {
    if (route.request().method() === 'POST') {
      recommendationCalls += 1;
    }
    await route.continue();
  });

  await page.getByTestId('nav-medicines').click();
  await expect(page).toHaveURL(/\/medicines$/);

  await page.getByTestId('symptom-input').fill('fever and sore throat');
  await page.waitForTimeout(300);
  await expect.poll(() => recommendationCalls).toBe(0);

  const firstChip = page.locator('.vs-common-searches button').first();
  await firstChip.click();
  await page.waitForTimeout(300);
  await expect.poll(() => recommendationCalls).toBe(0);

  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('Recommended Treatment')).toBeVisible();
  await expect.poll(() => recommendationCalls).toBe(1);

  await page.unroute('**/recommendations');
});

test('diet recommendations vary for different symptom profiles', async ({ page }) => {
  await registerUser(page);
  let recommendationCalls = 0;
  const recommendationStatuses: number[] = [];

  await page.route('**/recommendations', async (route) => {
    if (route.request().method() === 'POST') {
      const response = await route.fetch();
      recommendationCalls += 1;
      recommendationStatuses.push(response.status());
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });

  const readPlanSignature = async (): Promise<string> => {
    await expect(page.locator('.vs-meal-card')).toHaveCount(4);
    const meals = await page.locator('.vs-meal-card h3').allTextContents();
    const avoidItems = await page.locator('.vs-avoid-card .vs-list-item').allTextContents();
    return `${meals.join(' | ')} || ${avoidItems.join(' | ')}`;
  };

  await page.getByTestId('nav-medicines').click();
  await expect(page).toHaveURL(/\/medicines$/);
  await page.getByTestId('symptom-input').fill('fever, sore throat, cough, chills');
  await page.getByTestId('analyze-button').click();
  await expect.poll(() => recommendationCalls).toBe(1);
  await expect.poll(() => recommendationStatuses[0]).toBe(200);
  await expect(page.getByText('Recommended Treatment')).toBeVisible();
  await page.getByTestId('open-diet-from-medicines').click();
  await expect(page).toHaveURL(/\/diet$/);
  const firstPlan = await readPlanSignature();

  await page.getByTestId('nav-medicines').click();
  await expect(page).toHaveURL(/\/medicines$/);
  await page.getByTestId('symptom-input').fill('acidity, heartburn, nausea, stomach pain');
  await page.getByTestId('analyze-button').click();
  await expect.poll(() => recommendationCalls).toBe(2);
  await expect.poll(() => recommendationStatuses[1]).toBe(200);
  await expect(page.getByText('Recommended Treatment')).toBeVisible();
  await page.getByTestId('open-diet-from-medicines').click();
  await expect(page).toHaveURL(/\/diet$/);
  const secondPlan = await readPlanSignature();

  expect(secondPlan).not.toBe(firstPlan);
  await page.unroute('**/recommendations');
});
