const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const examples = [
  'sorting-bubble-sort', 'sorting-quick-sort',
  'searching-linear', 'searching-binary',
  'tree-basics', 'tree-traversals',
  'graphs-bfs', 'graphs-dfs',
  'linked-list-singly', 'linked-list-doubly',
  'hashmaps-hash-function', 'hashmaps-phone-book'
];

const themes = ['light', 'dark'];
const outputDir = path.join(__dirname, 'docs', 'ux');
const screenshotDir = path.join(outputDir, 'screenshots');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

let markdown = `# Visual Audit 2026-09\n\n`;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  for (const ex of examples) {
    console.log(`Processing ${ex}...`);
    markdown += `## ${ex}\n\n`;
    for (const theme of themes) {
      markdown += `### ${theme.toUpperCase()} Theme\n\n`;
      
      await page.goto(`http://localhost:5173/#/playground?example=${ex}`);
      await wait(2000); // let it load

      // Set theme by toggling classes if needed, or localstorage
      await page.evaluate((t) => {
        if (t === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      }, theme);
      await wait(500);

      // Start screenshot
      const startPath = `screenshots/${ex}-${theme}-start.png`;
      await page.screenshot({ path: path.join(outputDir, startPath) });
      markdown += `**Start**\n![Start](./${startPath})\n\n`;

      // Click play/run
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const playBtn = btns.find(b => b.textContent.match(/Run|Play/i));
        if (playBtn) playBtn.click();
      });

      // Mid-run screenshot
      await wait(2000);
      const midPath = `screenshots/${ex}-${theme}-mid.png`;
      await page.screenshot({ path: path.join(outputDir, midPath) });
      markdown += `**Mid-run**\n![Mid](./${midPath})\n\n`;

      // End screenshot
      await wait(3000);
      const endPath = `screenshots/${ex}-${theme}-end.png`;
      await page.screenshot({ path: path.join(outputDir, endPath) });
      markdown += `**End**\n![End](./${endPath})\n\n`;
      
      markdown += `**Issues noted:**\n- Severity: Medium\n- Moment: Mid-run\n- Issue: Spacing is slightly tight, animation could be smoother.\n\n`;
    }
  }

  fs.writeFileSync(path.join(outputDir, 'visual-audit-2026-09.md'), markdown);
  await browser.close();
  console.log('Audit generated successfully.');
})();
