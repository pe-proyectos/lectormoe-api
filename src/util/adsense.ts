import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface AdSenseRevenueData {
  slug: string; // Organization slug extracted from URL path
  revenue: number;
  currency: string;
  date: string;
}

interface AdSenseReportResponse {
  rows?: Array<{
    cells: Array<{
      value: string;
    }>;
  }>;
  headers?: Array<{
    name: string;
    type: string;
  }>;
}

let oauth2Client: OAuth2Client | null = null;

// Initialize OAuth2 client
function getOAuth2Client(): OAuth2Client {
  if (!oauth2Client) {
    oauth2Client = new OAuth2Client(
      process.env.GOOGLE_ADSENSE_CLIENT_ID,
      process.env.GOOGLE_ADSENSE_CLIENT_SECRET,
      process.env.GOOGLE_ADSENSE_REDIRECT_URI || 'https://senshimanga.capibaratraductor.com/oauth2callback'
    );
    if (process.env.GOOGLE_ADSENSE_REFRESH_TOKEN) {
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_ADSENSE_REFRESH_TOKEN,
      });
    }
  }
  return oauth2Client;
}

// Initialize AdSense API
function getAdSenseAPI() {
  const oauth2Client = getOAuth2Client();
  return google.adsense({
    version: 'v2',
    auth: oauth2Client
  });
}

/**
 * Authorize the OAuth2 client
 * @returns Promise<void>
 */
export async function authorizeAdSense(): Promise<void> {
  try {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client.credentials.refresh_token) {
      throw new Error('Refresh token not found. Please run the OAuth2 setup.');
    }
    await oauth2Client.getAccessToken();
    console.log('✅ OAuth2 authentication successful');
  } catch (error) {
    console.error('❌ OAuth2 authentication failed:', error);
    throw error;
  }
}

/**
 * Get revenue data for a specific month
 * @param year - Year (e.g., 2024)
 * @param month - Month (1-12)
 * @returns Promise<AdSenseRevenueData[]>
 */
export async function getMonthlyAdSenseRevenue(year: number, month: number): Promise<AdSenseRevenueData[]> {
  try {
    await authorizeAdSense();
    const adsense = getAdSenseAPI();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📊 Fetching AdSense revenue data for ${startDateStr} to ${endDateStr}`);

    const accounts = await adsense.accounts.list();
    console.log(accounts?.data);

    if (!accounts.data.accounts || accounts.data.accounts.length === 0) {
      console.log('⚠️  No AdSense accounts found. This could mean:');
      console.log('   1. The OAuth2 client doesn\'t have access to any AdSense accounts');
      console.log('   2. No AdSense accounts are associated with this Google account');
      console.log('   3. The AdSense account is not approved yet');
      console.log('   Returning empty revenue data for all organizations...');
      return [];
    }

    const accountId = accounts.data.accounts[0].name;
    console.log(`📋 Using AdSense account: ${accountId}`);

    // Generate report for the specified date range using direct query parameters
    // Using PAGE_URL instead of DOMAIN_NAME to get URL paths for organization matching
    const report = await adsense.accounts.reports.generate({
      account: accountId,
      dateRange: 'CUSTOM',
      'startDate.year': year,
      'startDate.month': month,
      'startDate.day': 1,
      'endDate.year': year,
      'endDate.month': month,
      'endDate.day': endDate.getDate(),
      dimensions: ['PAGE_URL'],
      metrics: ['ESTIMATED_EARNINGS'],
      currencyCode: 'USD'
    } as any);

    const reportData = report.data as any;
    
    if (!reportData.rows || reportData.rows.length === 0) {
      console.log('📊 No revenue data found for the specified period');
      return [];
    }

    // Group revenue by organization slug
    const revenueBySlug = new Map<string, number>();

    for (const row of reportData.rows) {
      if (row.cells && row.cells.length >= 2) {
        const pageUrl = row.cells[0]?.value || '';
        const earnings = parseFloat(row.cells[1]?.value || '0');

        if (pageUrl && earnings > 0) {
          try {
            // Parse URL to extract organization slug
            // Expected format: capibaratraductor.com/senshimanga/... or https://capibaratraductor.com/senshimanga/...
            const url = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);
            const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);

            if (pathSegments.length > 0) {
              const slug = pathSegments[0]; // First segment is the organization slug

              // Aggregate earnings for this slug
              const currentEarnings = revenueBySlug.get(slug) || 0;
              revenueBySlug.set(slug, currentEarnings + earnings);
            }
          } catch (error) {
            console.warn(`⚠️  Failed to parse URL: ${pageUrl}`, error);
          }
        }
      }
    }

    // Convert map to array of revenue data
    const revenueData: AdSenseRevenueData[] = Array.from(revenueBySlug.entries()).map(([slug, revenue]) => ({
      slug: slug,
      revenue: revenue,
      currency: 'USD',
      date: `${year}-${month.toString().padStart(2, '0')}`
    }));

    console.log(`📊 Found revenue data for ${revenueData.length} organizations`);
    revenueData.forEach(data => {
      console.log(`   - ${data.slug}: $${data.revenue.toFixed(2)}`);
    });
    return revenueData;

  } catch (error) {
    console.error('❌ Error fetching AdSense revenue data:', error);
    throw error;
  }
}

/**
 * Get revenue data for a specific month combining both subdomain and path-based data
 * This is useful during the transition period from subdomain.capibaratraductor.com to capibaratraductor.com/subdomain
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12)
 * @returns Promise<AdSenseRevenueData[]>
 */
export async function getMonthlyAdSenseRevenueCombined(year: number, month: number): Promise<AdSenseRevenueData[]> {
  try {
    await authorizeAdSense();
    const adsense = getAdSenseAPI();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📊 Fetching COMBINED AdSense revenue data for ${startDateStr} to ${endDateStr}`);
    console.log('   This includes both subdomain and path-based URLs\n');

    const accounts = await adsense.accounts.list();
    console.log(accounts?.data);

    if (!accounts.data.accounts || accounts.data.accounts.length === 0) {
      console.log('⚠️  No AdSense accounts found.');
      return [];
    }

    const accountId = accounts.data.accounts[0].name;
    console.log(`📋 Using AdSense account: ${accountId}\n`);

    const revenueBySlug = new Map<string, number>();

    // 1. Get data by DOMAIN_NAME (for subdomain-based URLs like senshimanga.capibaratraductor.com)
    console.log('🔍 Fetching subdomain-based revenue (DOMAIN_NAME)...');
    const domainReport = await adsense.accounts.reports.generate({
      account: accountId,
      dateRange: 'CUSTOM',
      'startDate.year': year,
      'startDate.month': month,
      'startDate.day': 1,
      'endDate.year': year,
      'endDate.month': month,
      'endDate.day': endDate.getDate(),
      dimensions: ['DOMAIN_NAME'],
      metrics: ['ESTIMATED_EARNINGS'],
      currencyCode: 'USD'
    } as any);

    const domainData = domainReport.data as any;

    if (domainData.rows && domainData.rows.length > 0) {
      console.log(`   Found ${domainData.rows.length} domain entries`);
      for (const row of domainData.rows) {
        if (row.cells && row.cells.length >= 2) {
          const domain = row.cells[0]?.value || '';
          const earnings = parseFloat(row.cells[1]?.value || '0');

          if (domain && earnings > 0) {
            // Only process capibaratraductor.com domains
            if (domain.includes('capibaratraductor.com')) {
              // Extract slug from subdomain (e.g., senshimanga.capibaratraductor.com -> senshimanga)
              const parts = domain.split('.');
              if (parts.length >= 3 && parts[1] === 'capibaratraductor' && parts[2] === 'com') {
                const slug = parts[0];
                const currentEarnings = revenueBySlug.get(slug) || 0;
                revenueBySlug.set(slug, currentEarnings + earnings);
                console.log(`   - ${domain} → slug: "${slug}" → $${earnings.toFixed(2)}`);
              } else if (domain === 'capibaratraductor.com') {
                // Main domain revenue (platform)
                const currentEarnings = revenueBySlug.get('capibaratraductor.com') || 0;
                revenueBySlug.set('capibaratraductor.com', currentEarnings + earnings);
                console.log(`   - ${domain} (main domain) → $${earnings.toFixed(2)}`);
              }
            } else {
              console.log(`   - ${domain} (skipped - not capibaratraductor.com) → $${earnings.toFixed(2)}`);
            }
          }
        }
      }
    } else {
      console.log('   No subdomain-based revenue found');
    }

    // 2. Get data by PAGE_URL (for path-based URLs like capibaratraductor.com/senshimanga/...)
    console.log('\n🔍 Fetching path-based revenue (PAGE_URL)...');
    const pageReport = await adsense.accounts.reports.generate({
      account: accountId,
      dateRange: 'CUSTOM',
      'startDate.year': year,
      'startDate.month': month,
      'startDate.day': 1,
      'endDate.year': year,
      'endDate.month': month,
      'endDate.day': endDate.getDate(),
      dimensions: ['PAGE_URL'],
      metrics: ['ESTIMATED_EARNINGS'],
      currencyCode: 'USD'
    } as any);

    const pageData = pageReport.data as any;

    if (pageData.rows && pageData.rows.length > 0) {
      console.log(`   Found ${pageData.rows.length} page URL entries`);
      for (const row of pageData.rows) {
        if (row.cells && row.cells.length >= 2) {
          const pageUrl = row.cells[0]?.value || '';
          const earnings = parseFloat(row.cells[1]?.value || '0');

          if (pageUrl && earnings > 0) {
            try {
              const url = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);

              // Only process capibaratraductor.com URLs
              if (url.hostname === 'capibaratraductor.com' || url.hostname.endsWith('.capibaratraductor.com')) {
                const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);

                if (pathSegments.length > 0) {
                  const slug = pathSegments[0];
                  const currentEarnings = revenueBySlug.get(slug) || 0;
                  revenueBySlug.set(slug, currentEarnings + earnings);
                  console.log(`   - ${pageUrl.substring(0, 60)}... → slug: "${slug}" → $${earnings.toFixed(2)}`);
                } else {
                  // Main domain without path (platform revenue)
                  const currentEarnings = revenueBySlug.get('capibaratraductor.com') || 0;
                  revenueBySlug.set('capibaratraductor.com', currentEarnings + earnings);
                  console.log(`   - ${pageUrl} (main domain) → $${earnings.toFixed(2)}`);
                }
              } else {
                console.log(`   - ${pageUrl.substring(0, 60)}... (skipped - not capibaratraductor.com) → $${earnings.toFixed(2)}`);
              }
            } catch (error) {
              console.warn(`   ⚠️  Failed to parse URL: ${pageUrl}`);
            }
          }
        }
      }
    } else {
      console.log('   No path-based revenue found');
    }

    // Convert map to array
    const revenueData: AdSenseRevenueData[] = Array.from(revenueBySlug.entries()).map(([slug, revenue]) => ({
      slug: slug,
      revenue: revenue,
      currency: 'USD',
      date: `${year}-${month.toString().padStart(2, '0')}`
    }));

    console.log(`\n📊 Combined revenue data for ${revenueData.length} slugs/domains`);
    revenueData.forEach(data => {
      console.log(`   - ${data.slug}: $${data.revenue.toFixed(2)}`);
    });

    return revenueData;

  } catch (error) {
    console.error('❌ Error fetching combined AdSense revenue data:', error);
    throw error;
  }
}

/**
 * Get revenue data for the previous month
 * @returns Promise<AdSenseRevenueData[]>
 */
export async function getPreviousMonthAdSenseRevenue(): Promise<AdSenseRevenueData[]> {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return getMonthlyAdSenseRevenue(
    previousMonth.getFullYear(),
    previousMonth.getMonth() + 1
  );
}

/**
 * Test the connection to AdSense API
 * @returns Promise<boolean>
 */
export async function testAdSenseConnection(): Promise<boolean> {
  try {
    await authorizeAdSense();
    const adsense = getAdSenseAPI();

    const accounts = await adsense.accounts.list();
    console.log('✅ AdSense API connection successful');
    console.log(`📋 Found ${accounts.data.accounts?.length || 0} AdSense accounts`);
    return true;
  } catch (error) {
    console.error('❌ AdSense API connection failed:', error);
    return false;
  }
}

export async function getOAuth2AuthUrl(): Promise<string> {
  const oauth2Client = getOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/adsense.readonly'],
    prompt: 'consent',
  });
  return authUrl;
}

export async function getOAuth2Tokens(code: string): Promise<{ refreshToken: string | null; accessToken: string | null }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return { refreshToken: tokens.refresh_token || null, accessToken: tokens.access_token || null };
}