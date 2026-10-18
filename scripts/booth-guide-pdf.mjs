// 부스 안내판(docs/booth/booth-guide.html)을 A3 PDF로 뽑는다. 스크린샷(docs/screenshots)을 갱신한 뒤 다시 실행한다.
// 사용: node scripts/booth-guide-pdf.mjs  → docs/booth/booth-guide.pdf, docs/booth/booth-guide-preview.png
// 인쇄용 글꼴은 Google Fonts에서 받으므로 네트워크가 필요하다(앱 런타임과 무관한 문서 도구).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = path.join(root, 'docs/booth/booth-guide.html');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1123, height: 1588 }, deviceScaleFactor: 1.5 });
await page.goto(`file://${html}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: path.join(root, 'docs/booth/booth-guide.pdf'), format: 'A3', printBackground: true, preferCSSPageSize: true });
await page.screenshot({ path: path.join(root, 'docs/booth/booth-guide-preview.png'), fullPage: true });
const { scroll, client } = await page.evaluate(() => {
  const sheet = document.querySelector('.sheet');
  return { scroll: sheet.scrollHeight, client: sheet.clientHeight };
});
await browser.close();
if (scroll > client) {
  console.error(`안내판이 A3 한 장을 넘칩니다: ${scroll}px > ${client}px`);
  process.exit(1);
}
console.log('docs/booth/booth-guide.pdf 생성');
