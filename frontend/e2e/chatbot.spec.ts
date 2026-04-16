import { expect, Page, Route, test } from '@playwright/test';

const registerAndOpenDashboard = async (page: Page) => {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const username = `chatbot${unique}`;
  const email = `${username}@example.com`;

  await page.goto('/register');
  await page.getByTestId('register-username').fill(username);
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('pass1234');
  await page.getByTestId('register-confirm-password').fill('pass1234');
  await page.getByTestId('register-age').fill('29');
  await page.getByTestId('register-weight').fill('72');
  await page.getByTestId('register-height').fill('174');
  await page.getByTestId('register-medical-conditions').fill('mild seasonal cold');
  await page.getByTestId('register-allergies').fill('none');
  await page.getByTestId('register-dietary-preferences').fill('vegetarian');
  await page.getByTestId('register-submit').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('dashboard-page')).toBeVisible();
};

const openChatPanel = async (page: Page) => {
  await page.getByTestId('chat-fab').click();
  await expect(page.getByTestId('chat-panel')).toBeVisible();
  await expect(page.getByText('AI Health Bot')).toBeVisible();
};

const sendChatMessage = async (page: Page, message: string) => {
  await page.getByTestId('chat-input').fill(message);
  await page.getByTestId('chat-send').click();
};

test('chatbot opens/closes and shows default content', async ({ page }) => {
  await registerAndOpenDashboard(page);
  await openChatPanel(page);

  await expect(page.getByTestId('chat-msg-bot').first()).toContainText(
    'I can help with symptoms, medicines, diet, and previous records.',
  );
  await expect(page.getByTestId('chat-quick-reply-0')).toHaveText('Analyze symptoms');
  await expect(page.getByTestId('chat-quick-reply-1')).toHaveText('Recent drugs');
  await expect(page.getByTestId('chat-quick-reply-2')).toHaveText('Diet suggestions');

  await page.getByTestId('chat-close').click();
  await expect(page.getByTestId('chat-panel')).toBeHidden();

  await openChatPanel(page);
  await expect(page.getByTestId('chat-msg-bot').first()).toBeVisible();
});

test('chatbot blocks blank input and supports Enter submit with trimming', async ({ page }) => {
  await registerAndOpenDashboard(page);
  await openChatPanel(page);

  await expect(page.getByTestId('chat-msg-user')).toHaveCount(0);
  await expect(page.getByTestId('chat-send')).toBeDisabled();

  await page.getByTestId('chat-input').fill('   ');
  await expect(page.getByTestId('chat-send')).toBeDisabled();

  await page.getByTestId('chat-input').fill('   tell me about profile   ');
  await expect(page.getByTestId('chat-send')).toBeEnabled();
  await page.getByTestId('chat-input').press('Enter');

  await expect(page.getByTestId('chat-msg-user').last()).toHaveText('tell me about profile');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');
});

test('chatbot handles generic, diet, and medicine branches', async ({ page }) => {
  await registerAndOpenDashboard(page);
  await openChatPanel(page);

  await sendChatMessage(page, 'hello assistant');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');

  await sendChatMessage(page, 'need meal and diet support');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');
  await expect(page.getByTestId('chat-quick-reply-0')).toHaveText('Open Diet Plan');
  await expect(page.getByTestId('chat-quick-reply-1')).toHaveText('Foods to avoid');
  await expect(page.getByTestId('chat-quick-reply-2')).toHaveText('Superfoods');

  await sendChatMessage(page, 'show my medicine history');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');
  await expect(page.getByTestId('chat-quick-reply-0')).toHaveText('Analyze symptoms');
  await expect(page.getByTestId('chat-quick-reply-1')).toHaveText('Safety warning');
  await expect(page.getByTestId('chat-quick-reply-2')).toHaveText('Diet plan');
});

test('chatbot quick replies are clickable and produce contextual responses', async ({ page }) => {
  await registerAndOpenDashboard(page);
  await openChatPanel(page);

  await page.getByRole('button', { name: 'Recent drugs' }).click();
  await expect(page.getByTestId('chat-msg-user').last()).toHaveText('Recent drugs');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');

  await page.getByRole('button', { name: 'Diet plan' }).click();
  await expect(page.getByTestId('chat-msg-user').last()).toHaveText('Diet plan');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');
});

test('chatbot uses previous recommendations in medicine-history answers', async ({ page }) => {
  await registerAndOpenDashboard(page);

  await page.getByTestId('nav-medicines').click();
  await expect(page).toHaveURL(/\/medicines$/);
  await page.getByTestId('symptom-input').fill('fever and sore throat');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('Recommended Treatment')).toBeVisible();

  await openChatPanel(page);
  await sendChatMessage(page, 'show my medicine history');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');
  await expect(page.getByTestId('chat-quick-reply-0')).toHaveText('Analyze symptoms');
});

test('chatbot keeps working when panel stays open across tab navigation', async ({ page }) => {
  await registerAndOpenDashboard(page);
  await openChatPanel(page);

  await sendChatMessage(page, 'hello from dashboard');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');

  await page.getByTestId('nav-settings').click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId('chat-panel')).toBeVisible();

  await sendChatMessage(page, 'diet suggestions please');
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('informational only');
});

test('chatbot shows fallback message when API call fails', async ({ page }) => {
  await registerAndOpenDashboard(page);

  const abortChat = async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.abort('failed');
      return;
    }
    await route.continue();
  };

  await page.route('**/ai-chat', abortChat);
  await openChatPanel(page);
  await sendChatMessage(page, 'any medicine advice?');

  await expect(page.getByTestId('chat-msg-bot').last()).toContainText(
    'Chat service is unavailable right now. Try again in a few seconds.',
  );
  await page.unroute('**/ai-chat', abortChat);
});

test('chatbot send button state handles pending and post-response flows', async ({ page }) => {
  await registerAndOpenDashboard(page);

  const delayedReply = async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        reply: 'Delayed bot response from mocked test route.',
        quick_replies: ['Analyze symptoms', 'Recent drugs', 'Diet suggestions'],
      }),
    });
  };

  await page.route('**/ai-chat', delayedReply);
  await openChatPanel(page);

  await page.getByTestId('chat-input').fill('check send loading state');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-send')).toBeDisabled();
  await expect(page.getByTestId('chat-loading')).toBeVisible();
  await expect(page.getByTestId('chat-input')).toBeDisabled();
  await expect(page.getByTestId('chat-msg-bot').last()).toContainText('Delayed bot response from mocked test route.');
  await expect(page.getByTestId('chat-loading')).toHaveCount(0);

  await page.getByTestId('chat-input').fill('new request');
  await expect(page.getByTestId('chat-send')).toBeEnabled();
  await page.unroute('**/ai-chat', delayedReply);
});
