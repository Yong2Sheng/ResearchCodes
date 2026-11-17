/**
 * Event-cone-only display regression:
 * large projection typography, switchable text sizes, offline KaTeX math,
 * 1920×1080 / 1280×720 / 1024×768 layouts, and bilingual behaviour.
 *
 * Usage: node tests/typography-math.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pageUrl = pathToFileURL(path.join(root, 'event-cone-rotation.html')).href;
const artifacts = path.join(root, 'artifacts');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await fs.mkdir(artifacts, { recursive: true });

const results = [];
let failed = 0;
function check(id, label, ok, detail = '') {
  results.push({ id, label, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(4)} ${label}${detail ? ` — ${detail}` : ''}`);
}
function near(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
}
async function newPage(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const external = [];
  const errors = [];
  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(pageUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__COMPTON__), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  return { page, external, errors };
}
async function shot(page, name) {
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(artifacts, name) });
  console.log(`      saved artifacts/${name}`);
}
function computed(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = getComputedStyle(el);
    return { fontSize: parseFloat(style.fontSize), lineHeight: style.lineHeight, display: style.display };
  }, selector);
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});
try {
  // ------------------------------------------------------------------
  // 1920 × 1080 — default large mode
  // ------------------------------------------------------------------
  const wide = await newPage(browser, 1920, 1080);
  const page = wide.page;
  const initial = await page.evaluate(() => {
    const fontSize = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const math = [...document.querySelectorAll('[data-tex]')];
    return {
      fontMode: window.__COMPTON__.getState().fontMode,
      body: fontSize('body'),
      title: fontSize('.brand h1'),
      readout: fontSize('.readout-row code'),
      value: fontSize('.value-readout'),
      labelMain: fontSize('.scene-label .label-main'),
      formulaCount: math.length,
      katexCount: document.querySelectorAll('.katex').length,
      mathErrors: math.filter((el) => el.classList.contains('math-error')).length,
      mathStatements: math.filter((el) => el.classList.contains('math-typeset')).length,
      fontsStatus: document.fonts?.status,
    };
  });
  check(
    'T1.1',
    '1920×1080 默认大字号：标题/正文/读数/场景标签都不再是 8–12px',
    initial.fontMode === 'large' &&
      initial.title >= 32 &&
      initial.body >= 17 &&
      initial.readout >= 15 &&
      initial.value >= 30 &&
      initial.labelMain >= 18,
    `title=${initial.title}, body=${initial.body}, readout=${initial.readout}, label=${initial.labelMain}`,
  );
  check(
    'T1.2',
    '14 个公式节点全部由 KaTeX 成功排版',
    initial.formulaCount === 14 &&
      initial.katexCount === 14 &&
      initial.mathErrors === 0 &&
      initial.mathStatements === 14 &&
      initial.fontsStatus === 'loaded',
    `formulas=${initial.formulaCount}, katex=${initial.katexCount}, errors=${initial.mathErrors}`,
  );
  check(
    'T1.3',
    '页面仍不加载任何 HTTP(S) 外部资源',
    wide.external.length === 0,
    `external=${wide.external.length}`,
  );
  await shot(page, 'typography-1920-large.png');

  // Real UI font-size buttons: standard < large < xlarge.
  const sizes = {};
  for (const mode of ['standard', 'large', 'xlarge']) {
    await page.locator(`button[data-font-size="${mode}"]`).click();
    await page.waitForTimeout(180);
    sizes[mode] = await page.evaluate(() => ({
      mode: document.documentElement.dataset.fontSize,
      body: parseFloat(getComputedStyle(document.body).fontSize),
      label: parseFloat(getComputedStyle(document.querySelector('.scene-label .label-main')).fontSize),
      active: document.querySelector('button[data-font-size].is-active')?.dataset.fontSize,
      pressed: [...document.querySelectorAll('button[data-font-size]')].map((b) => b.getAttribute('aria-pressed')),
    }));
  }
  check(
    'T1.4',
    '投影字号按钮可在标准 / 大字 / 特大之间实时切换，并更新选中状态',
    sizes.standard.mode === 'standard' &&
      sizes.large.mode === 'large' &&
      sizes.xlarge.mode === 'xlarge' &&
      sizes.standard.body < sizes.large.body &&
      sizes.large.body < sizes.xlarge.body &&
      sizes.standard.label < sizes.large.label &&
      sizes.large.label < sizes.xlarge.label &&
      sizes.xlarge.active === 'xlarge' &&
      JSON.stringify(sizes.xlarge.pressed) === JSON.stringify(['false', 'false', 'true']),
    `body ${sizes.standard.body}/${sizes.large.body}/${sizes.xlarge.body}px`,
  );
  // Return to the default for the remaining wide-screen checks.
  await page.locator('button[data-font-size="large"]').click();
  await page.waitForTimeout(250);

  // Help modal math.
  await page.locator('#help-open').click();
  await page.waitForTimeout(350);
  const help = await page.evaluate(() => {
    const modal = document.querySelector('#help-modal');
    const blocks = [...modal.querySelectorAll('.formula-block')];
    const overflows = blocks.filter((el) => el.scrollWidth > el.clientWidth + 2).length;
    return {
      visible: !modal.hidden,
      displayBlocks: blocks.length,
      displayKatex: blocks.filter((el) => el.querySelector('.katex-display')).length,
      overflows,
    };
  });
  check(
    'T1.5',
    '帮助弹层中的 LaTeX 公式块全部排版，且 1920 宽度下不横向溢出',
    help.visible && help.displayBlocks === 7 && help.displayKatex === 7 && help.overflows === 0,
    `blocks=${help.displayBlocks}, displayMath=${help.displayKatex}, overflow=${help.overflows}`,
  );
  await shot(page, 'typography-1920-help-math.png');
  await page.locator('#help-modal .modal-close').click();
  await page.waitForTimeout(200);

  // English must preserve every KaTeX expression and translate the new controls.
  await page.locator('#language-toggle').click();
  await page.waitForTimeout(450);
  const english = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.querySelector('.brand h1')?.textContent,
    fontControl: document.querySelector('.font-size-row')?.innerText,
    critical: document.querySelector('.hint-critical')?.innerText,
    katex: document.querySelectorAll('.katex').length,
    errors: document.querySelectorAll('.math-error').length,
    chineseInControls: /[\u4e00-\u9fff]/.test(document.querySelector('.controls-panel').innerText),
  }));
  check(
    'T1.6',
    '英文模式保留 KaTeX，并翻译新增的字号控件与关键提示',
    english.lang === 'en' &&
      english.katex === 14 &&
      english.errors === 0 &&
      /Text size/i.test(english.fontControl) &&
      /Mouse input changes the view only/i.test(english.critical) &&
      !/[\u4e00-\u9fff]/.test(english.critical),
  );
  await shot(page, 'typography-1920-english.png');
  check(
    'T1.7',
    '1920×1080 主页面没有 console/page error',
    wide.errors.length === 0,
    `errors=${wide.errors.length}`,
  );
  await page.close();

  // ------------------------------------------------------------------
  // 1280 × 720 — automatic extra-large mode, panels remain usable and math fits.
  // ------------------------------------------------------------------
  const compact = await newPage(browser, 1280, 720);
  const compactPage = compact.page;
  const compactState = await compactPage.evaluate(() => {
    const readoutFormula = [...document.querySelectorAll('.readout-panel [data-tex]')];
    return {
      fontMode: window.__COMPTON__.getState().fontMode,
      body: parseFloat(getComputedStyle(document.body).fontSize),
      label: parseFloat(getComputedStyle(document.querySelector('.scene-label .label-main')).fontSize),
      readoutDisplay: getComputedStyle(document.querySelector('.readout-panel')).display,
      formulaOverflow: readoutFormula.filter((el) => el.scrollWidth > el.clientWidth + 2).length,
      katex: document.querySelectorAll('.katex').length,
    };
  });
  check(
    'T2.1',
    '1280×720 自动采用特大字号，场景标签与正文同步放大',
    compactState.fontMode === 'xlarge' &&
      compactState.body >= 19 &&
      compactState.label >= 21,
    `mode=${compactState.fontMode}, body=${compactState.body}, label=${compactState.label}`,
  );
  check(
    'T2.2',
    '1280×720 下右侧读数可见，公式不横向溢出并被裁切',
    compactState.readoutDisplay !== 'none' &&
      compactState.formulaOverflow === 0 &&
      compactState.katex === 14,
    `overflow=${compactState.formulaOverflow}, katex=${compactState.katex}`,
  );
  await shot(compactPage, 'typography-1280-xlarge.png');

  await compactPage.locator('button[data-font-size="large"]').click();
  await compactPage.waitForTimeout(250);
  const compactLarge = await computed(compactPage, 'body');
  check(
    'T2.3',
    '1280×720 下可以切回“大字”，字号按钮状态更新',
    compactLarge.fontSize < compactState.body &&
      (await compactPage.evaluate(() => document.querySelector('button[data-font-size].is-active')?.dataset.fontSize)) === 'large',
  );

  // Large type must not create overlapping HTML scene labels.
  const labelOverlap = await compactPage.evaluate(() => {
    const labels = [...document.querySelectorAll('.scene-label')]
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { text: el.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
    const overlaps = [];
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const a = labels[i];
        const b = labels[j];
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
          overlaps.push(`${a.text} / ${b.text}`);
        }
      }
    }
    return { labels: labels.length, overlaps };
  });
  check(
    'T2.4',
    '1280×720 大字场景标签互相避让，没有文字重叠',
    labelOverlap.labels >= 6 && labelOverlap.overlaps.length === 0,
    `labels=${labelOverlap.labels}, overlaps=${labelOverlap.overlaps.join('; ') || 'none'}`,
  );

  await compactPage.locator('#help-open').click();
  await compactPage.waitForTimeout(350);
  const compactHelp = await compactPage.evaluate(() => {
    const modal = document.querySelector('#help-modal .modal');
    return {
      open: !document.querySelector('#help-modal').hidden,
      scrollable: modal.scrollHeight > modal.clientHeight,
      katex: document.querySelectorAll('#help-modal .katex').length,
    };
  });
  check(
    'T2.5',
    '1280×720 下帮助/公式卡片可滚动阅读，KaTeX 完整保留',
    compactHelp.open && compactHelp.scrollable && compactHelp.katex >= 10,
    `scrollable=${compactHelp.scrollable}, katex=${compactHelp.katex}`,
  );
  await shot(compactPage, 'typography-1280-help.png');
  check(
    'T2.6',
    '1280×720 主页面没有 console/page error',
    compact.errors.length === 0,
    `errors=${compact.errors.length}`,
  );
  await compactPage.close();

  // ------------------------------------------------------------------
  // 1024 × 768 — narrow-screen readout drawer.
  // ------------------------------------------------------------------
  const narrow = await newPage(browser, 1024, 768);
  const narrowPage = narrow.page;
  const beforeDrawer = await narrowPage.evaluate(() => ({
    readout: getComputedStyle(document.querySelector('.readout-panel')).display,
    toggle: getComputedStyle(document.querySelector('#readout-toggle')).display,
    bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
    katex: document.querySelectorAll('.katex').length,
  }));
  check(
    'T3.1',
    '1024×768 默认隐藏右侧面板、显示“读数”入口，页面字号仍为大字级',
    beforeDrawer.readout === 'none' &&
      beforeDrawer.toggle !== 'none' &&
      beforeDrawer.bodyFont >= 19 &&
      beforeDrawer.katex === 14,
    `readout=${beforeDrawer.readout}, toggle=${beforeDrawer.toggle}, body=${beforeDrawer.bodyFont}`,
  );
  await narrowPage.locator('#readout-toggle').click();
  await narrowPage.waitForTimeout(300);
  const afterDrawer = await narrowPage.evaluate(() => {
    const panel = document.querySelector('.readout-panel');
    const visible = getComputedStyle(panel).display !== 'none';
    const rect = panel.getBoundingClientRect();
    const formulae = [...panel.querySelectorAll('[data-tex]')];
    return {
      visible,
      inViewport: rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1,
      overflow: formulae.filter((el) => el.scrollWidth > el.clientWidth + 2).length,
      katexInside: panel.querySelectorAll('.katex').length,
    };
  });
  check(
    'T3.2',
    '1024×768 点击“读数”后，右侧读数以覆盖抽屉显示且公式完整',
    afterDrawer.visible &&
      afterDrawer.inViewport &&
      afterDrawer.overflow === 0 &&
      afterDrawer.katexInside >= 3,
    `visible=${afterDrawer.visible}, inViewport=${afterDrawer.inViewport}, overflow=${afterDrawer.overflow}`,
  );
  await shot(narrowPage, 'typography-1024-readout-drawer.png');
  await narrowPage.locator('#readout-toggle').click();
  await narrowPage.waitForTimeout(200);
  const closedDrawer = await narrowPage.evaluate(() => getComputedStyle(document.querySelector('.readout-panel')).display);
  check('T3.3', '1024×768 再次点击“读数”可收起抽屉', closedDrawer === 'none');
  check('T3.4', '1024×768 主页面没有 console/page error', narrow.errors.length === 0, `errors=${narrow.errors.length}`);
  await shot(narrowPage, 'typography-1024-main.png');
  await narrowPage.close();

  console.log('');
  console.log(`RESULT: ${results.length - failed}/${results.length} display checks passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
} catch (error) {
  console.error('Display regression crashed:', error);
  process.exitCode = 2;
} finally {
  await browser.close();
}
