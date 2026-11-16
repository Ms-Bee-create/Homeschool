/* Morning print job: opens the live Forge Academy, signs in, takes today's Christy Times, makes a PDF and emails it.
   Runs from .github/workflows/christy-times-print.yml. Needs these secrets (never put real values in this file):
     APP_EMAIL, APP_PASSWORD     the family's Forge Academy login
     GMAIL_USER, GMAIL_APP_PASSWORD   the Gmail account that sends (an app password, not the normal one)
     PRINT_TO                    the printer's email address
     TEST_TO                     where a test copy goes (Mom's own inbox)
   MODE: "test" sends to TEST_TO now; "print" sends to PRINT_TO now; "scheduled" sends to PRINT_TO only on a weekday at 8am New York time.
   The kids' names appear on the paper; the job logs nothing but the date, lesson count and result. */
const fs = require('fs');
const APP = process.env.APP_URL || 'https://ms-bee-create.github.io/Homeschool/';
const MODE = process.env.MODE || 'scheduled';
const need = n => { const v = process.env[n]; if (!v) { console.error('Missing setting: ' + n); process.exit(1); } return v; };

function nyNow() {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  return { wd: g('weekday'), hour: parseInt(g('hour'), 10) % 24 };
}

exports.renderPdf = async function (page) {
  const html = await page.evaluate(() => window.__christyPrint && window.__christyPrint());
  return html;
};

async function main() {
  if (MODE === 'scheduled') {
    const t = nyNow();
    if (['Sat', 'Sun'].includes(t.wd) || t.hour !== 8) { console.log('Not 8am on a weekday in New York (' + t.wd + ' ' + t.hour + 'h). Nothing to do.'); return; }
  }
  const to = MODE === 'test' ? need('TEST_TO') : need('PRINT_TO');
  const { chromium } = require('playwright-core');
  const nodemailer = require('nodemailer');
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome' });
  const ctx = await browser.newContext({ timezoneId: 'America/New_York', locale: 'en-US', viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP + '?christyprint=1');
  await page.fill('#loginEmail', need('APP_EMAIL'));
  await page.fill('#loginPass', need('APP_PASSWORD'));
  await page.click('#loginBtn');
  let got = null;
  for (let i = 0; i < 60 && !got; i++) { await page.waitForTimeout(2000); got = await page.evaluate(() => window.__christyPrint && window.__christyPrint()).catch(() => null); }
  if (!got) { console.error('The paper never loaded (sign-in failed or no lessons loaded). Nothing sent.'); process.exit(2); }
  await page.waitForTimeout(4000); /* let any late sync land, then take the final copy */
  got = await page.evaluate(() => window.__christyPrint()) || got;
  const m = got.html.match(/Two Scholars, (\d+) Lessons/);
  const lessons = m ? parseInt(m[1], 10) : -1;
  console.log('Date ' + got.iso + ', ' + lessons + ' lessons, mode ' + MODE);
  if (lessons === 0 && MODE === 'scheduled') { console.log('No lessons today. Not printing.'); await browser.close(); return; }
  const pp = await ctx.newPage();
  await pp.setContent(got.html, { waitUntil: 'load' });
  const pdf = await pp.pdf({ format: 'Letter', printBackground: true, margin: { top: '0.3in', bottom: '0.3in', left: '0.3in', right: '0.3in' } });
  await browser.close();
  if (process.env.PDF_OUT) fs.writeFileSync(process.env.PDF_OUT, pdf);
  if (process.env.NO_SEND) { console.log('NO_SEND set. PDF bytes: ' + pdf.length); return; }
  const tx = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: need('GMAIL_USER'), pass: need('GMAIL_APP_PASSWORD') } });
  await tx.sendMail({
    from: process.env.GMAIL_USER, to,
    subject: (MODE === 'test' ? 'TEST ' : '') + 'The Christy Times ' + got.iso,
    text: 'The Christy Times, ' + got.iso + '.',
    attachments: [{ filename: 'christy-times-' + got.iso + '.pdf', content: pdf, contentType: 'application/pdf' }]
  });
  console.log('Sent (' + (MODE === 'test' ? 'test copy' : 'to printer') + ').');
}
if (require.main === module) main().catch(e => { console.error('Failed: ' + e.message); process.exit(1); });
