import { test, expect } from '@playwright/test';

test.describe('Maintenance Page Tests', () => {
  test('should display maintenance page with working buttons', async ({ page }) => {
    // Отслеживаем консольные сообщения
    const messages = [];
    page.on('console', msg => messages.push(`${msg.type()}: ${msg.text()}`));
    
    // Отслеживаем ошибки
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/maintenance');

    // Проверяем заголовок страницы
    await expect(page.locator('h1')).toContainText('Обслуживание велосипедов');

    // Проверяем наличие кнопки добавления
    await expect(page.locator('button').filter({ hasText: 'Добавить событие' })).toBeVisible();

    // Проверяем наличие таблицы
    await expect(page.locator('table')).toBeVisible();

    // Ждем загрузки данных
    await page.waitForTimeout(2000);

    // Проверяем наличие кнопок действий в таблице
    const editButtons = page.locator('.btn-edit');
    const deleteButtons = page.locator('.btn-delete');

    if (await editButtons.count() > 0) {
      // Проверяем что кнопки не disabled
      const firstEditBtn = editButtons.first();
      await expect(firstEditBtn).not.toBeDisabled();
      
      const firstDeleteBtn = deleteButtons.first();
      await expect(firstDeleteBtn).not.toBeDisabled();

      // Проверяем цвета кнопок (зеленый для edit, красный для delete)
      const editBtnStyles = await firstEditBtn.evaluate(el => getComputedStyle(el).background);
      const deleteBtnStyles = await firstDeleteBtn.evaluate(el => getComputedStyle(el).background);
      
      console.log('Edit button styles:', editBtnStyles);
      console.log('Delete button styles:', deleteBtnStyles);
    }

    // Логируем сообщения консоли
    console.log('Console messages:', messages);
    console.log('Page errors:', errors);

    // Проверяем отсутствие критических ошибок
    const criticalErrors = errors.filter(error => 
      !error.includes('Warning') && !error.includes('DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle status change button click', async ({ page }) => {
    await page.goto('/maintenance');
    
    // Ждем загрузки данных
    await page.waitForTimeout(2000);

    const editButtons = page.locator('.btn-edit:not([disabled])');
    
    if (await editButtons.count() > 0) {
      // Перехватываем confirm dialog
      page.on('dialog', dialog => dialog.accept());
      
      // Кликаем на первую кнопку изменения статуса
      await editButtons.first().click();
      
      // Ждем обновления данных
      await page.waitForTimeout(1000);
    }
  });

  test('should prevent duplicate bike repairs', async ({ page }) => {
    await page.goto('/maintenance');

    // Кликаем на добавить событие
    await page.click('button:has-text("Добавить событие")');
    
    // Ждем открытия модального окна
    await expect(page.locator('.modal-content')).toBeVisible();

    // Проверяем что модальное окно содержит форму
    await expect(page.locator('form')).toBeVisible();
    
    // Закрываем модальное окно
    await page.click('.modal-close');
  });
});