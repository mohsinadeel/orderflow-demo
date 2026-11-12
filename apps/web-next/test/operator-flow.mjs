import { chromium } from 'playwright-core';

const baseUrl = process.env.ORDERFLOW_WEB_URL ?? 'http://localhost:8086';
const executablePath = process.env.BRAVE_PATH ?? 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const name = `000 Browser verification ${crypto.randomUUID()}`;

const created = await fetch(`${baseUrl}/api/orderflow/products`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, unitPriceMinor: 1750, stockAvailable: 2 }),
});
if (created.status !== 201) throw new Error(`Product setup failed with ${created.status}`);
const product = await created.json();

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Product').selectOption(product.id);
  await page.getByLabel('Quantity').fill('3');
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Reserve stock' }).click();
  const errorAlert = page.locator('.alert.error');
  await errorAlert.waitFor();
  if (!(await errorAlert.innerText()).includes('Insufficient stock')) throw new Error(`Unexpected error: ${await errorAlert.innerText()}`);
  const productCard = page.locator('.product').filter({ hasText: name });
  if (!/2\s+available/.test(await productCard.innerText())) throw new Error('Stock changed after rejected order');

  await page.getByLabel('Quantity').fill('1');
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Reserve stock' }).click();
  await page.getByText(/reserved successfully/).waitFor();
  await page.waitForTimeout(500);
  if (!/1\s+available/.test(await productCard.innerText())) throw new Error('Successful reservation did not deduct stock');

  const orderCard = page.locator('.order').filter({ hasText: name }).first();
  await orderCard.getByRole('button', { name: 'Cancel and release' }).click();
  await page.getByText(/cancelled; stock released/).waitFor();
  await page.waitForTimeout(500);
  if (!/2\s+available/.test(await productCard.innerText())) throw new Error('Cancellation did not restore stock');

  await page.setViewportSize({ width: 390, height: 844 });
  const panels = page.locator('.grid > .panel');
  const first = await panels.nth(0).boundingBox();
  const second = await panels.nth(1).boundingBox();
  if (!first || !second || second.y <= first.y + first.height) throw new Error('Mobile panels did not stack');

  console.log(JSON.stringify({ insufficientStock: 'passed', reservation: 'passed', cancellation: 'passed', mobileLayout: 'passed', productId: product.id }, null, 2));
} finally {
  await browser.close();
}
