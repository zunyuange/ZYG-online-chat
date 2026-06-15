/**
 * Screenshot script for generating documentation images
 * Usage: npx tsx scripts/screenshot.ts
 */

import { chromium, Browser, Page } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:3010';
const SCREENSHOT_DIR = join(process.cwd(), 'docs', 'screenshots');

// Ensure screenshot directory exists
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });

  console.log('📸 Starting screenshot capture...');
  console.log(`📁 Saving to: ${SCREENSHOT_DIR}`);

  // PC viewport
  const pcViewport = { width: 1280, height: 800 };
  // Mobile viewport (iPhone SE)
  const mobileViewport = { width: 375, height: 667 };

  try {
    // ==========================================
    // PC Screenshots
    // ==========================================
    console.log('\n🖥️  PC Screenshots (1280x800)');

    const pcContext = await browser.newContext({ viewport: pcViewport });
    const pcPage = await pcContext.newPage();

    // Chat page - empty state
    console.log('  📷 chat-pc-empty.png');
    await pcPage.goto(`${BASE_URL}/chat`, { waitUntil: 'domcontentloaded' });
    await pcPage.waitForTimeout(2000);
    await pcPage.screenshot({
      path: join(SCREENSHOT_DIR, 'chat-pc-empty.png'),
      fullPage: false
    });

    // Chat page - with conversation (need to interact)
    console.log('  📷 chat-pc-conversation.png');
    // Enter name and start chat
    const nameInput = pcPage.locator('input[placeholder*="名字"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('测试用户');
      await pcPage.keyboard.press('Enter');
      await pcPage.waitForTimeout(500);
    }
    // Send a message
    const messageInput = pcPage.locator('input[placeholder*="消息"], textarea[placeholder*="消息"]').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('你好，我想咨询一下产品问题');
      await pcPage.keyboard.press('Enter');
      await pcPage.waitForTimeout(500);
    }
    await pcPage.screenshot({
      path: join(SCREENSHOT_DIR, 'chat-pc-conversation.png'),
      fullPage: false
    });

    // Staff page - overview
    console.log('  📷 staff-pc-overview.png');
    await pcPage.goto(`${BASE_URL}/staff`, { waitUntil: 'domcontentloaded' });
    await pcPage.waitForTimeout(1500);
    await pcPage.screenshot({
      path: join(SCREENSHOT_DIR, 'staff-pc-overview.png'),
      fullPage: false
    });

    // Staff page - with chat
    console.log('  📷 staff-pc-chat.png');
    // Click on a session if available
    const sessionItem = pcPage.locator('[data-session-id], .session-item, li').first();
    if (await sessionItem.isVisible()) {
      await sessionItem.click();
      await pcPage.waitForTimeout(500);
    }
    await pcPage.screenshot({
      path: join(SCREENSHOT_DIR, 'staff-pc-chat.png'),
      fullPage: false
    });

    await pcContext.close();

    // ==========================================
    // Mobile Screenshots
    // ==========================================
    console.log('\n📱 Mobile Screenshots (375x667)');

    const mobileContext = await browser.newContext({
      viewport: mobileViewport,
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();

    // Chat page - mobile
    console.log('  📷 chat-h5-empty.png');
    await mobilePage.goto(`${BASE_URL}/chat`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({
      path: join(SCREENSHOT_DIR, 'chat-h5-empty.png'),
      fullPage: false
    });

    // Chat with conversation
    console.log('  📷 chat-h5-conversation.png');
    const mobileNameInput = mobilePage.locator('input[placeholder*="名字"]').first();
    if (await mobileNameInput.isVisible()) {
      await mobileNameInput.fill('移动用户');
      await mobilePage.keyboard.press('Enter');
      await mobilePage.waitForTimeout(500);
    }
    const mobileMsgInput = mobilePage.locator('input[placeholder*="消息"], textarea[placeholder*="消息"]').first();
    if (await mobileMsgInput.isVisible()) {
      await mobileMsgInput.fill('你好');
      await mobilePage.keyboard.press('Enter');
      await mobilePage.waitForTimeout(500);
    }
    await mobilePage.screenshot({
      path: join(SCREENSHOT_DIR, 'chat-h5-conversation.png'),
      fullPage: false
    });

    // Staff page - mobile
    console.log('  📷 staff-h5-overview.png');
    await mobilePage.goto(`${BASE_URL}/staff`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot({
      path: join(SCREENSHOT_DIR, 'staff-h5-overview.png'),
      fullPage: false
    });

    // Staff chat - mobile
    console.log('  📷 staff-h5-chat.png');
    const mobileSession = mobilePage.locator('[data-session-id], .session-item, li').first();
    if (await mobileSession.isVisible()) {
      await mobileSession.click();
      await mobilePage.waitForTimeout(500);
    }
    await mobilePage.screenshot({
      path: join(SCREENSHOT_DIR, 'staff-h5-chat.png'),
      fullPage: false
    });

    await mobileContext.close();

    console.log('\n✅ Screenshots completed!');
    console.log(`📁 Files saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshots();
