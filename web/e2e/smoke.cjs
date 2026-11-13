const { chromium } = require('playwright');
const fs = require('fs');
const dir = process.argv[2];
(async () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const tampered = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n ');
  fs.writeFileSync(dir + '/orig.pdf', pdf); fs.writeFileSync(dir + '/edited.pdf', tampered);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const log = (m) => console.log('✔', m);
  await p.goto('http://localhost:4173/verify/1'); await p.getByTestId('status').first().waitFor();
  log('verify #1 = ' + (await p.getByTestId('status').first().innerText()));
  for (const [id, want] of [[2,'Revoked'],[3,'Expired'],[999,'Not found']]) {
    await p.goto('http://localhost:4173/verify/' + id); await p.getByText(want, { exact: false }).first().waitFor(); log(`verify #${id} = ${want}`);
  }
  await p.goto('http://localhost:4173/');
  await p.getByLabel('Mock account').selectOption({ label: /student/ }).catch(async () => {
    const opts = await p.$$eval('select[aria-label="Mock account"] option', (o) => o.map((x) => [x.value, x.textContent]));
    await p.getByLabel('Mock account').selectOption(opts.find((o) => o[1].startsWith('student'))[0]);
  });
  await p.goto('http://localhost:4173/issuer');
  // full-page nav resets the in-memory mock account → use client-side nav instead
  await p.goto('http://localhost:4173/');
  const pick = async (role) => { const opts = await p.$$eval('select[aria-label="Mock account"] option', (o) => o.map((x) => [x.value, x.textContent])); await p.getByLabel('Mock account').selectOption(opts.find((o) => o[1].startsWith(role + ' '))[0]); };
  const nav = async (path) => { await p.evaluate((u) => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, path); };
  await pick('student'); await nav('/issuer'); await p.getByTestId('no-role').waitFor(); log('student sees "Not authorised" on /issuer');
  await pick('issuer'); await nav('/issuer'); await p.getByText('Issue one credential').waitFor();
  await p.getByPlaceholder('0x…').fill('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
  await p.getByLabel('Recipient name').fill('A. Perera');
  await p.getByLabel('Course / programme').fill('Full-Stack Web Development');
  await p.getByTestId('issue-pdf').setInputFiles(dir + '/orig.pdf');
  await p.getByTestId('sha-preview').waitFor(); log('SHA-256 preview ' + (await p.getByTestId('sha-preview').innerText()).slice(0, 18) + '…');
  await p.getByRole('button', { name: 'Issue credential' }).click();
  await p.getByTestId('issued').waitFor(); const h = await p.getByTestId('issued').locator('h2').innerText(); log(h);
  const id = h.match(/#(\d+)/)[1];
  await p.screenshot({ path: dir + '/1-issued.png' });
  await nav('/verify/' + id); await p.getByTestId('status').first().waitFor();
  log('verify new token = ' + (await p.getByTestId('status').first().innerText()));
  await p.getByTestId('pdf-input').setInputFiles(dir + '/orig.pdf'); await p.getByText('Document matches').waitFor(); log('original PDF → match');
  await p.getByTestId('pdf-input').setInputFiles(dir + '/edited.pdf'); await p.getByText('MISMATCH').waitFor(); log('edited PDF → MISMATCH');
  await p.screenshot({ path: dir + '/2-mismatch.png', fullPage: true });
  await nav('/issuer'); await p.getByRole('button', { name: 'Issued / Revoke' }).click();
  await p.getByPlaceholder('Revoke by token ID').fill(id); await p.getByRole('button', { name: 'Revoke…' }).click();
  await p.getByPlaceholder(/Reason/).fill('Issued to the wrong student'); await p.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
  await p.getByText('Revoked. Tx').waitFor(); log('revoked');
  await p.getByRole('button', { name: 'Close' }).click();
  await nav('/verify/' + id); await p.getByTestId('revoke-reason').waitFor();
  log('verify after revoke: ' + (await p.getByTestId('status').first().innerText()) + ' | ' + (await p.getByTestId('revoke-reason').innerText()));
  // CSV batch
  fs.writeFileSync(dir + '/batch.csv', 'address,recipientName,grade\n' + Array.from({ length: 10 }, (_, i) => `0x${(i + 0x1000).toString(16).padStart(40, '0')},Student ${i + 1},Pass`).join('\n'));
  await nav('/issuer'); await p.getByRole('button', { name: 'Batch CSV' }).click();
  await p.getByLabel('Course / programme').fill('Docker 101');
  await p.getByTestId('csv-input').setInputFiles(dir + '/batch.csv');
  await p.getByRole('button', { name: /Issue 10 credentials/ }).click();
  await p.getByTestId('batch-done').waitFor(); log((await p.getByTestId('batch-done').locator('h2').innerText()) + ' (CSV)');
  await pick('student'); await nav('/me'); await p.getByText('My credentials', { exact: true }).first().waitFor();
  await p.getByRole('button', { name: 'Try transfer' }).first().click(); await p.getByTestId('transfer-msg').waitFor();
  log('transfer: ' + (await p.getByTestId('transfer-msg').innerText()));
  await p.screenshot({ path: dir + '/3-mine.png', fullPage: true });
  const m = await b.newPage({ viewport: { width: 375, height: 812 } }); await m.goto('http://localhost:4173/verify/1'); await m.getByTestId('status').first().waitFor();
  const sw = await m.evaluate(() => document.documentElement.scrollWidth); log('phone width 375 → scrollWidth ' + sw);
  await m.screenshot({ path: dir + '/4-phone.png', fullPage: true });
  console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
