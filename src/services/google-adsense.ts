import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

let oauth2Client: OAuth2Client | null = null;

function getOAuth2Client(): OAuth2Client {
  if (!oauth2Client) {
    oauth2Client = new OAuth2Client(
      process.env.GOOGLE_ADSENSE_CLIENT_ID,
      process.env.GOOGLE_ADSENSE_CLIENT_SECRET,
      process.env.GOOGLE_ADSENSE_REDIRECT_URI || 'https://capibaratraductor.com/oauth2callback',
    );
    if (process.env.GOOGLE_ADSENSE_REFRESH_TOKEN) {
      oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_ADSENSE_REFRESH_TOKEN });
    }
  }
  return oauth2Client;
}

/**
 * Fetch total Google AdSense revenue (USD) for the given calendar month.
 * Returns 0 if no account / no data / API failure (logs the error).
 *
 * @param year e.g. 2026
 * @param monthIndex 0-indexed (0 = January)
 */
export async function fetchGoogleAdsenseRevenue(year: number, monthIndex: number): Promise<number> {
  try {
    const client = getOAuth2Client();
    if (!client.credentials.refresh_token) {
      console.warn('[GoogleAdSense] No refresh token configured; returning $0');
      return 0;
    }
    await client.getAccessToken();

    const adsense = google.adsense({ version: 'v2', auth: client });
    const accounts = await adsense.accounts.list();
    if (!accounts.data.accounts || accounts.data.accounts.length === 0) {
      console.warn('[GoogleAdSense] No accounts visible to OAuth client; returning $0');
      return 0;
    }
    const accountId = accounts.data.accounts[0].name!;

    const month = monthIndex + 1; // AdSense API uses 1-indexed months
    const lastDay = new Date(year, month, 0).getDate();

    const report = await adsense.accounts.reports.generate({
      account: accountId,
      dateRange: 'CUSTOM',
      'startDate.year': year,
      'startDate.month': month,
      'startDate.day': 1,
      'endDate.year': year,
      'endDate.month': month,
      'endDate.day': lastDay,
      dimensions: ['DOMAIN_NAME'],
      metrics: ['ESTIMATED_EARNINGS'],
      currencyCode: 'USD',
      limit: 50000,
    } as any);

    const data = report.data as any;
    let total = 0;
    if (data.rows) {
      for (const row of data.rows) {
        const earnings = parseFloat(row.cells?.[1]?.value ?? '0');
        if (Number.isFinite(earnings)) total += earnings;
      }
    }
    console.log(`[GoogleAdSense] ${year}-${month.toString().padStart(2, '0')} total revenue: $${total.toFixed(2)}`);
    return total;
  } catch (err) {
    console.error('[GoogleAdSense] Error fetching revenue:', err);
    return 0;
  }
}
