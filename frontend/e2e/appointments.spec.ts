import { expect, Page, test } from '@playwright/test';

const localDateAfterDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const registerAndOpenAppointments = async (page: Page) => {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const username = `appt${unique}`;
  const email = `${username}@example.com`;

  await page.goto('/register');
  await page.getByTestId('register-username').fill(username);
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('pass1234');
  await page.getByTestId('register-confirm-password').fill('pass1234');
  await page.getByTestId('register-age').fill('31');
  await page.getByTestId('register-weight').fill('74');
  await page.getByTestId('register-height').fill('175');
  await page.getByTestId('register-medical-conditions').fill('none');
  await page.getByTestId('register-allergies').fill('none');
  await page.getByTestId('register-dietary-preferences').fill('balanced');
  await page.getByTestId('register-submit').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByTestId('nav-appointments').click();
  await expect(page).toHaveURL(/\/appointments$/);
  await expect(page.getByTestId('appointments-page')).toBeVisible();
};

const createAppointment = async (
  page: Page,
  values: { title: string; provider: string; date: string; time: string; mode: string; notes: string },
) => {
  await page.getByTestId('appointment-title').fill(values.title);
  await page.getByTestId('appointment-provider').fill(values.provider);
  await page.getByTestId('appointment-date').fill(values.date);
  await page.getByTestId('appointment-time').fill(values.time);
  await page.getByTestId('appointment-mode').selectOption(values.mode);
  await page.getByTestId('appointment-notes').fill(values.notes);
  await page.getByTestId('add-appointment-button').click();
};

test('appointments tab supports add, edit, complete, cancel, restore, and delete flows', async ({ page }) => {
  await registerAndOpenAppointments(page);

  await page.getByTestId('add-appointment-button').click();
  await expect(page.getByText('Please fill title, provider, date, and time.')).toBeVisible();

  await createAppointment(page, {
    title: 'General Checkup',
    provider: 'Dr. Kumar',
    date: localDateAfterDays(2),
    time: '10:30',
    mode: 'in_person',
    notes: 'Initial appointment',
  });
  await expect(page.getByText('Appointment added.')).toBeVisible();
  await expect(page.getByTestId('upcoming-appointments')).toContainText('General Checkup');

  const editButton = page.getByTestId('upcoming-appointments').locator('[data-testid^="edit-appointment-"]').first();
  await editButton.click();
  await page.getByTestId('appointment-time').fill('11:45');
  await page.getByTestId('appointment-notes').fill('Rescheduled and updated notes');
  await page.getByTestId('add-appointment-button').click();
  await expect(page.getByText('Appointment updated.')).toBeVisible();
  await expect(page.getByTestId('upcoming-appointments')).toContainText('Rescheduled and updated notes');

  const completeButton = page
    .getByTestId('upcoming-appointments')
    .locator('[data-testid^="complete-appointment-"]')
    .first();
  await completeButton.click();
  await expect(page.getByText('Appointment marked as completed.')).toBeVisible();
  await expect(page.getByTestId('history-appointments')).toContainText('General Checkup');
  await expect(page.getByTestId('history-appointments')).toContainText('Completed');

  await createAppointment(page, {
    title: 'Dental Follow-up',
    provider: 'Dr. Patel',
    date: localDateAfterDays(3),
    time: '09:20',
    mode: 'video',
    notes: 'Teeth sensitivity review',
  });
  await expect(page.getByText('Appointment added.')).toBeVisible();
  await expect(page.getByTestId('upcoming-appointments')).toContainText('Dental Follow-up');

  const cancelButton = page
    .getByTestId('upcoming-appointments')
    .locator('[data-testid^="cancel-appointment-"]')
    .first();
  await cancelButton.click();
  await expect(page.getByText('Appointment cancelled.')).toBeVisible();
  await expect(page.getByTestId('history-appointments')).toContainText('Cancelled');

  const restoreButton = page
    .getByTestId('history-appointments')
    .locator('[data-testid^="restore-appointment-"]')
    .first();
  await restoreButton.click();
  await expect(page.getByText('Appointment restored to scheduled.')).toBeVisible();
  await expect(page.getByTestId('upcoming-appointments')).toContainText('Dental Follow-up');

  const reopenedEditButton = page
    .getByTestId('upcoming-appointments')
    .locator('[data-testid^="edit-appointment-"]')
    .first();
  await reopenedEditButton.click();
  await expect(page.getByTestId('reset-appointment-form')).toBeVisible();
  await page.getByTestId('reset-appointment-form').click();
  await expect(page.getByRole('heading', { name: 'Add Appointment' })).toBeVisible();

  const deleteUpcomingButton = page
    .getByTestId('upcoming-appointments')
    .locator('[data-testid^="delete-appointment-"]')
    .first();
  await deleteUpcomingButton.click();
  await expect(page.getByText('Appointment deleted.')).toBeVisible();

  const deleteHistoryButton = page
    .getByTestId('history-appointments')
    .locator('[data-testid^="delete-appointment-"]')
    .first();
  await deleteHistoryButton.click();
  await expect(page.getByText('Appointment deleted.')).toBeVisible();
});
