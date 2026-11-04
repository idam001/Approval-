import { test, expect } from '@playwright/test';

test('home links, sections, and about page work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your AI copilot');
  await page.getByRole('link', { name: 'Explore capabilities' }).click();
  await expect(page).toHaveURL(/#capabilities/);
  await expect(page.locator('.capability-card')).toHaveCount(6);
  await page.getByRole('link', { name: 'About', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Built to think');
  await expect(page.getByText('About this recreation', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open the chat' }).click();
  await expect(page.getByRole('heading', { name: 'Hack the Earth!' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('themes persist between pages and reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/chat');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('suggestions, missing-provider errors, history and delete work', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('button', { name: /Find the weak spots/ }).click();
  await expect(page.getByRole('textbox', { name: 'Message RedMind' })).toHaveValue('How do I test my web app for stored XSS?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('alert')).toContainText('No AI provider is connected');
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.chat-message.user')).toContainText('stored XSS');
  await page.getByRole('button', { name: /Delete How do I test/ }).click();
  await expect(page.locator('.history-row')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Hack the Earth!' })).toBeVisible();
});

test('notes autosave, download, and clear confirmation work', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your notes' }).fill('# Field notes\nTest finding');
  await page.reload();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your notes' })).toHaveValue('# Field notes\nTest finding');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('redmind-notes.txt');
  await page.getByRole('button', { name: 'Clear notes', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your notes' })).not.toBeEmpty();
  await page.getByRole('button', { name: 'Clear notes', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('textbox', { name: 'Your notes' })).toBeEmpty();
});

test('settings persist and local data reset works', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'High', exact: true }).click();
  await page.locator('.system-prompt').fill('Use Python examples.');
  await page.reload();
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await expect(page.locator('.system-prompt')).toHaveValue('Use Python examples.');
  await expect(page.getByRole('button', { name: 'High', exact: true })).toHaveClass('selected');
  await page.getByRole('button', { name: 'Clear all local data' }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.locator('.system-prompt')).toBeEmpty();
  await expect(page.getByRole('button', { name: 'Medium', exact: true })).toHaveClass('selected');
});

test('text attachments can be attached, sent, and removed', async ({ page }) => {
  await page.goto('/chat');
  await page.locator('input[type=file]').setInputFiles({ name: 'test.py', mimeType: 'text/plain', buffer: Buffer.from('print("hello")') });
  await expect(page.locator('.attached-files')).toContainText('test.py');
  await page.getByRole('button', { name: 'Remove test.py' }).click();
  await expect(page.locator('.attached-files')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({ name: 'test.py', mimeType: 'text/plain', buffer: Buffer.from('print("hello")') });
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.message-files')).toContainText('test.py');
  await expect(page.getByRole('alert')).toBeVisible();
});

test('streamed answers render markdown and save to notes', async ({ page }) => {
  await page.route('**/api/status', r => r.fulfill({ json: { configured: true, model: 'test-model' } }));
  await page.route('**/api/chat', async route => {
    const body = route.request().postDataJSON();
    expect(body.messages.at(-1).content).toBe('Explain security headers.');
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"choices":[{"delta":{"content":"## Security headers\\n\\n"}}]}\n\ndata: {"choices":[{"delta":{"content":"Set **Content-Security-Policy** to reduce XSS risk."}}]}\n\ndata: [DONE]\n\n' });
  });
  await page.goto('/chat');
  await page.getByRole('textbox', { name: 'Message RedMind' }).fill('Explain security headers.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('heading', { name: 'Security headers', exact: true })).toBeVisible();
  await expect(page.locator('.message-heading .model-tag')).toHaveText('test-model');
  await page.getByRole('button', { name: 'Save to note' }).click();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your notes' })).toContainText('Content-Security-Policy');
});

test('mobile navigation, composer and landing fit viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Toggle menu' }).click();
  await expect(page.locator('.site-header nav')).toBeVisible();
  await page.goto('/chat');
  await expect(page.getByRole('button', { name: 'Open sidebar' })).toBeVisible();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your notes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open sidebar' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('thinking menu and Android modal work', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('button', { name: 'Thinking: Medium' }).click();
  await page.getByRole('button', { name: 'Max', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Thinking: Max' })).toBeVisible();
  await page.getByRole('button', { name: /RedMind for Android/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Android — coming soon');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('login and missing routes have working return links', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Sign-in isn’t configured', { exact: false })).toBeVisible();
  await page.goto('/missing-route');
  await expect(page.getByRole('heading', { name: 'This route is off the map.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3000/');
});
