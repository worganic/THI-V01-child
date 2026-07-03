const { chromium } = require('@playwright/test');
const fs = require('fs');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    console.log('Navigating to http://localhost:4202/...');
    await page.goto('http://localhost:4202/', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // 1. Initial State Screenshot
    await page.screenshot({ path: 'step1_landing.png' });
    console.log('Initial page screenshot saved.');
    
    // 2. Click Login button to open modal
    console.log('Clicking login button (.btn-login)...');
    await page.click('.btn-login');
    
    // Wait for modal to appear
    await page.waitForSelector('.modal-box', { timeout: 5000 });
    await page.screenshot({ path: 'step2_login_modal.png' });
    console.log('Login modal opened and screenshot saved.');
    
    // Extract elements from the login modal
    const loginModalInfo = await page.evaluate(() => {
      const modal = document.querySelector('.modal-box');
      if (!modal) return null;
      
      const title = modal.querySelector('.modal-title')?.innerText || null;
      const subtitle = modal.querySelector('.modal-sub')?.innerText || null;
      const inputs = Array.from(modal.querySelectorAll('input')).map(input => {
        const wrap = input.closest('.form-group');
        const label = wrap ? wrap.querySelector('label')?.innerText : null;
        return {
          tagName: 'input',
          type: input.getAttribute('type'),
          name: input.getAttribute('name') || input.getAttribute('formcontrolname') || null,
          id: input.getAttribute('id') || null,
          placeholder: input.getAttribute('placeholder') || null,
          label: label ? label.trim() : null,
          required: input.hasAttribute('required') || false
        };
      });
      const buttons = Array.from(modal.querySelectorAll('button')).map(btn => {
        return {
          tagName: 'button',
          type: btn.getAttribute('type') || null,
          className: btn.getAttribute('class') || null,
          text: btn.innerText ? btn.innerText.trim().replace(/\s+/g, ' ') : null
        };
      });
      
      return { title, subtitle, inputs, buttons };
    });

    // 3. Click the link to switch to Register (creating account) if present
    console.log('Checking for switch to register option in modal...');
    const switchButton = page.locator('.modal-box button.link-btn, .modal-box .cta-ghost');
    let registerModalInfo = null;
    
    if (await switchButton.count() > 0) {
      console.log('Switching to register modal...');
      await switchButton.first().click();
      await page.waitForTimeout(500); // short wait for state transition
      await page.screenshot({ path: 'step3_register_modal.png' });
      
      // Extract register modal elements
      registerModalInfo = await page.evaluate(() => {
        const modal = document.querySelector('.modal-box');
        if (!modal) return null;
        
        const title = modal.querySelector('.modal-title')?.innerText || null;
        const subtitle = modal.querySelector('.modal-sub')?.innerText || null;
        const inputs = Array.from(modal.querySelectorAll('input')).map(input => {
          const wrap = input.closest('.form-group');
          const label = wrap ? wrap.querySelector('label')?.innerText : null;
          return {
            tagName: 'input',
            type: input.getAttribute('type'),
            name: input.getAttribute('name') || input.getAttribute('formcontrolname') || null,
            id: input.getAttribute('id') || null,
            placeholder: input.getAttribute('placeholder') || null,
            label: label ? label.trim() : null,
            required: input.hasAttribute('required') || false
          };
        });
        const buttons = Array.from(modal.querySelectorAll('button')).map(btn => {
          return {
            tagName: 'button',
            type: btn.getAttribute('type') || null,
            className: btn.getAttribute('class') || null,
            text: btn.innerText ? btn.innerText.trim().replace(/\s+/g, ' ') : null
          };
        });
        
        return { title, subtitle, inputs, buttons };
      });
    }

    const result = {
      landingUrl: page.url(),
      title: await page.title(),
      loginModal: loginModalInfo,
      registerModal: registerModalInfo
    };

    fs.writeFileSync('dom-analysis.json', JSON.stringify(result, null, 2));
    console.log('DOM analysis updated and saved to dom-analysis.json');

  } catch (error) {
    console.error('Error during DOM exploration:', error);
    try {
      await page.screenshot({ path: 'error-exploration.png' });
      console.log('Error screenshot saved to error-exploration.png');
    } catch (e) {
      console.error('Could not take error screenshot:', e);
    }
  } finally {
    await browser.close();
  }
}

run();
