import { test, expect } from '@playwright/test';

test.describe('Bike Rental App - Homepage', () => {
  test('should load homepage and display sidebar navigation', async ({ page }) => {
    // Отслеживаем консольные сообщения
    const messages = [];
    page.on('console', msg => messages.push(`${msg.type()}: ${msg.text()}`));
    
    // Отслеживаем ошибки
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');

    // Проверяем заголовок страницы
    await expect(page).toHaveTitle(/Vite \+ React/);

    // Проверяем наличие основных элементов навигации
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.nav-item').first()).toBeVisible();

    // Проверяем наличие пунктов меню
    await expect(page.locator('text=Велосипеды')).toBeVisible();
    await expect(page.locator('text=Аренда')).toBeVisible();
    await expect(page.locator('text=Обслуживание')).toBeVisible();
    await expect(page.locator('text=Запчасти')).toBeVisible();

    // Проверяем main content area
    await expect(page.locator('.main-content')).toBeVisible();

    // Логируем сообщения консоли
    console.log('Console messages:', messages);
    console.log('Page errors:', errors);

    // Проверяем отсутствие критических ошибок
    const criticalErrors = errors.filter(error => 
      !error.includes('Warning') && !error.includes('DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');

    // Переходим на страницу обслуживания
    await page.click('text=Обслуживание');
    await expect(page.url()).toContain('/maintenance');

    // Переходим на страницу запчастей
    await page.click('text=Запчасти');  
    await expect(page.url()).toContain('/parts');

    // Возвращаемся на главную
    await page.click('text=Велосипеды');
    await expect(page.url()).toBe('http://localhost:5173/');
  });

  test('should load bikes data from API', async ({ page }) => {
    // Отслеживаем сетевые запросы
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push(request.url());
      }
    });

    await page.goto('/');

    // Ждем загрузки данных (если есть таблица или список велосипедов)
    await page.waitForTimeout(2000);

    // Логируем API запросы
    console.log('API requests made:', requests);

    // Проверяем что были сделаны запросы к API
    const bikesRequests = requests.filter(url => url.includes('/api/bikes'));
    expect(bikesRequests.length).toBeGreaterThan(0);
  });
});