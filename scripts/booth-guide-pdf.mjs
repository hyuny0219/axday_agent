// 부스 안내판(docs/booth/booth-guide.html 진행 순서, agenda-guide.html 안건 안내)을 A3 PDF로 뽑는다.
// 스크린샷(docs/screenshots)이나 시나리오 문구를 갱신한 뒤 다시 실행한다.
// 사용: node scripts/booth-guide-pdf.mjs  → docs/booth/<이름>.pdf, docs/booth/<이름>-preview.png
// 인쇄용 글꼴은 Google Fonts에서 받으므로 네트워크가 필요하다(앱 런타임과 무관한 문서 도구).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// fit: 넘침을 재는 요소. agenda-guide는 근거 칸이 줄어들며 TIP 띠에 가려지므로 .sheet가 아니라 .agendas를 잰다.
const sheets = [
  { name: 'booth-guide', fit: '.sheet' },
  { name: 'agenda-guide', fit: '.agendas' },
];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1123, height: 1588 }, deviceScaleFactor: 1.5 });
const overflow = [];
for (const { name, fit } of sheets) {
  await page.goto(`file://${path.join(root, `docs/booth/${name}.html`)}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(root, `docs/booth/${name}.pdf`), format: 'A3', printBackground: true, preferCSSPageSize: true });
  await page.screenshot({ path: path.join(root, `docs/booth/${name}-preview.png`), fullPage: true });
  const { scroll, client } = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return { scroll: el.scrollHeight, client: el.clientHeight };
  }, fit);
  if (scroll > client) overflow.push(`${name}: ${scroll}px > ${client}px`);
  else console.log(`docs/booth/${name}.pdf 생성`);
}
await browser.close();
if (overflow.length) {
  console.error(`안내판이 A3 한 장을 넘칩니다: ${overflow.join(', ')}`);
  process.exit(1);
}
