/**
 * Visual verification: 5-step journey animation on MediKiosk homepage
 * Tests auto-cycling, click interaction, and smooth transitions.
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', '..', '..', 'screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('1. Loading homepage...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  await sleep(1500);

  // Scroll to the journey section
  console.log('2. Scrolling to journey section...');
  await page.evaluate(() => {
    const el = document.getElementById('journey');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(1000);

  // Read initial active step from the sticky card
  async function getActiveStepLabel() {
    return page.evaluate(() => {
      // Desktop sticky card shows "Step XX — Label" in a span
      const card = document.querySelector('.lg\\:sticky');
      if (!card) return null;
      const span = card.querySelector('span');
      return span ? span.textContent.trim() : null;
    });
  }

  async function getActiveStepIndex() {
    return page.evaluate(() => {
      // Find which step div has opacity-100 (active)
      const stepDivs = document.querySelectorAll('[data-journey-index]');
      for (const div of stepDivs) {
        if (div.className.includes('opacity-100')) {
          return Number(div.getAttribute('data-journey-index'));
        }
      }
      return -1;
    });
  }

  async function getProgressDots() {
    return page.evaluate(() => {
      // Check for progress dot buttons
      const dots = document.querySelectorAll('button[aria-label^="Go to step"]');
      return dots.length;
    });
  }

  // Screenshot 1: Initial state
  const step1Label = await getActiveStepLabel();
  const step1Idx = await getActiveStepIndex();
  const dots = await getProgressDots();
  console.log(`   Initial state: "${step1Label}" (index: ${step1Idx}), Progress dots: ${dots}`);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-initial.png'), fullPage: false });

  // Wait for auto-cycle (3.5s + buffer)
  console.log('3. Waiting 4.5s for auto-cycle...');
  await sleep(4500);
  const step2Label = await getActiveStepLabel();
  const step2Idx = await getActiveStepIndex();
  console.log(`   After 1st cycle: "${step2Label}" (index: ${step2Idx})`);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-after-first-cycle.png'), fullPage: false });

  // Wait for another auto-cycle
  console.log('4. Waiting 4.5s for 2nd auto-cycle...');
  await sleep(4500);
  const step3Label = await getActiveStepLabel();
  const step3Idx = await getActiveStepIndex();
  console.log(`   After 2nd cycle: "${step3Label}" (index: ${step3Idx})`);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-after-second-cycle.png'), fullPage: false });

  // Click Step 05 (index 4) on the left
  console.log('5. Clicking Step 05...');
  const step05 = await page.$('[data-journey-index="4"]');
  if (step05) {
    await step05.click();
    await sleep(1000);
  }
  const step5Label = await getActiveStepLabel();
  const step5Idx = await getActiveStepIndex();
  console.log(`   After click: "${step5Label}" (index: ${step5Idx})`);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-after-click-step05.png'), fullPage: false });

  // Summary
  console.log('\n=== VERIFICATION RESULTS ===');
  const autoCycleWorks = step1Idx !== step2Idx && step2Idx !== step3Idx;
  const clickWorks = step5Idx === 4;
  const dotsVisible = dots === 5;
  const sequentialCycle = step2Idx === step1Idx + 1 && step3Idx === step2Idx + 1;

  console.log(`✅ Auto-cycle changes step:      ${autoCycleWorks ? 'YES' : 'NO'} (${step1Idx} → ${step2Idx} → ${step3Idx})`);
  console.log(`✅ Sequential order:             ${sequentialCycle ? 'YES' : 'NO'}`);
  console.log(`✅ Click updates right card:      ${clickWorks ? 'YES' : 'NO'} (clicked 05, got index ${step5Idx})`);
  console.log(`✅ Progress dots visible (5):     ${dotsVisible ? 'YES' : 'NO'} (found ${dots})`);
  console.log(`✅ Sticky card label updates:     ${step1Label !== step5Label ? 'YES' : 'NO'}`);

  const allPass = autoCycleWorks && clickWorks && dotsVisible && sequentialCycle;
  console.log(`\n${allPass ? '🎉 ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);

  await browser.close();
  process.exit(allPass ? 0 : 1);
})();

