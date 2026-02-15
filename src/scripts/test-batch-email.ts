/**
 * Test script to verify Resend batch API works correctly.
 * Run with: bun run src/scripts/test-batch-email.ts
 */
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || Bun.env.RESEND_API_KEY);
const FROM_ADDRESS = 'Capibara Traductor <noreply@capibaratraductor.com>';

const TEST_EMAILS = [
  'luis.choque.castro@outlook.com',
  'ghoulhunter@outlook.com.pe',
];

const testHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="background-color:#09090b;padding:32px 16px;">
    <div style="max-width:600px;margin:0 auto;background-color:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
      <div style="background:linear-gradient(135deg,#09090b,#18181b);padding:32px;text-align:center;border-bottom:1px solid #27272a;">
        <span style="color:#ffffff;font-size:24px;font-weight:900;">Capibara</span><span style="color:#06b6d4;font-size:24px;font-weight:900;">Traductor</span>
      </div>
      <div style="padding:32px;color:#a1a1aa;font-size:14px;line-height:1.7;">
        <h2 style="color:#ffffff;font-size:22px;font-weight:900;">Test de Batch Email API</h2>
        <p>Este es un email de prueba para verificar que el batch API de Resend funciona correctamente.</p>
        <p style="color:#06b6d4;font-weight:800;">Timestamp: ${new Date().toISOString()}</p>
        <p style="color:#71717a;font-size:13px;">Si recibes este email, el batch API funciona!</p>
      </div>
    </div>
  </div>
</body>
</html>`;

async function testSingleEmail() {
  console.log('\n--- Test 1: Single email send ---');
  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: TEST_EMAILS[0],
      subject: `[TEST] Single Email - ${new Date().toLocaleTimeString()}`,
      html: testHtml,
    });
    console.log('Single email result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('Single email error:', error?.message || error);
  }
}

async function testBatchEmail() {
  console.log('\n--- Test 2: Batch email send (2 emails in 1 API call) ---');
  try {
    const payloads = TEST_EMAILS.map((to, i) => ({
      from: FROM_ADDRESS,
      to,
      subject: `[TEST] Batch Email #${i + 1} - ${new Date().toLocaleTimeString()}`,
      html: testHtml,
    }));

    const result = await resend.batch.send(payloads);
    console.log('Batch email result:', JSON.stringify(result, null, 2));
    console.log(`Sent ${(result.data as any)?.length || 0} emails in 1 API call`);
  } catch (error: any) {
    console.error('Batch email error:', error?.message || error);
  }
}

async function testRateLimitHandling() {
  console.log('\n--- Test 3: Rate limit handling (3 rapid batch calls) ---');
  const RATE_LIMIT_INTERVAL_MS = 600;
  let lastRequestTime = 0;

  async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      const waitTime = RATE_LIMIT_INTERVAL_MS - elapsed;
      console.log(`  Waiting ${waitTime}ms for rate limit...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
  }

  for (let batch = 1; batch <= 3; batch++) {
    try {
      await waitForRateLimit();
      const start = Date.now();
      const result = await resend.batch.send(
        TEST_EMAILS.map((to, i) => ({
          from: FROM_ADDRESS,
          to,
          subject: `[TEST] Rate Limit Batch ${batch} Email #${i + 1} - ${new Date().toLocaleTimeString()}`,
          html: testHtml,
        }))
      );
      const elapsed = Date.now() - start;
      console.log(`  Batch ${batch}: OK (${elapsed}ms) - ${(result.data as any)?.length || 0} emails`);
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('rate limit') || error?.message?.includes('Too many requests');
      console.error(`  Batch ${batch}: ${isRateLimit ? 'RATE LIMITED' : 'ERROR'} - ${error?.message}`);

      if (isRateLimit) {
        const retryDelay = 5000 + Math.random() * 3000;
        console.log(`  Retrying in ${Math.round(retryDelay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        try {
          const retryResult = await resend.batch.send(
            TEST_EMAILS.map((to, i) => ({
              from: FROM_ADDRESS,
              to,
              subject: `[TEST] RETRY Batch ${batch} Email #${i + 1} - ${new Date().toLocaleTimeString()}`,
              html: testHtml,
            }))
          );
          console.log(`  Retry batch ${batch}: OK - ${(retryResult.data as any)?.length || 0} emails`);
        } catch (retryError: any) {
          console.error(`  Retry batch ${batch}: FAILED - ${retryError?.message}`);
        }
      }
    }
  }
}

async function main() {
  console.log('=== Resend Batch Email API Test ===');
  console.log(`Test emails: ${TEST_EMAILS.join(', ')}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await testSingleEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testBatchEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testRateLimitHandling();

  console.log('\n=== All tests complete ===');
  console.log('Check both inboxes for the test emails.');
}

main().catch(console.error);
