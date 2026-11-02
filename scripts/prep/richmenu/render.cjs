// Renders richmenu.html to richmenu.jpg (2500×1686, under LINE's 1 MB limit): node scripts/prep/richmenu/render.cjs
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2500, height: 1686 } });
  await p.goto('file://' + path.join(__dirname, 'richmenu.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(__dirname, 'richmenu.jpg'), type: 'jpeg', quality: 90 });
  await b.close();
})();
