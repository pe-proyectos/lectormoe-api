// Test script to verify AdSense URL parsing and organization matching
// This script simulates AdSense data without touching the database

interface AdSenseRevenueData {
  slug: string;
  revenue: number;
  currency: string;
  date: string;
}

interface Organization {
  id: number;
  name: string;
  domain: string;
  slug: string;
}

// Simulate AdSense API response with PAGE_URL data
const mockAdSenseRows = [
  { cells: [{ value: 'https://capibaratraductor.com/senshimanga/manga/one-piece/capitulo-1' }, { value: '15.50' }] },
  { cells: [{ value: 'https://capibaratraductor.com/senshimanga/manga/naruto/capitulo-2' }, { value: '8.75' }] },
  { cells: [{ value: 'capibaratraductor.com/senshimanga/home' }, { value: '3.25' }] },
  { cells: [{ value: 'https://capibaratraductor.com/otraorg/manga/bleach' }, { value: '12.00' }] },
  { cells: [{ value: 'https://capibaratraductor.com/otraorg/generos' }, { value: '5.50' }] },
  { cells: [{ value: 'https://capibaratraductor.com/mangalatino/manga/dragon-ball' }, { value: '20.00' }] },
  { cells: [{ value: 'https://capibaratraductor.com/unknownorg/test' }, { value: '2.00' }] },
];

// Simulate organizations from database
const mockOrganizations: Organization[] = [
  {
    id: 1,
    name: 'Senshi Manga',
    domain: 'senshimanga.capibaratraductor.com', // Old subdomain format
    slug: 'senshimanga'
  },
  {
    id: 2,
    name: 'Otra Organizacion',
    domain: 'otraorg.capibaratraductor.com',
    slug: 'otraorg'
  },
  {
    id: 3,
    name: 'Manga Latino',
    domain: 'mangalatino.capibaratraductor.com',
    slug: 'mangalatino'
  }
];

console.log('🧪 Starting AdSense URL Parsing Test\n');
console.log('='.repeat(80));
console.log('\n📊 Step 1: Simulating AdSense API Response\n');

// Process AdSense data (same logic as in adsense.ts)
const revenueBySlug = new Map<string, number>();

console.log('Processing AdSense rows:');
for (const row of mockAdSenseRows) {
  if (row.cells && row.cells.length >= 2) {
    const pageUrl = row.cells[0]?.value || '';
    const earnings = parseFloat(row.cells[1]?.value || '0');

    console.log(`  📄 URL: ${pageUrl}`);
    console.log(`     💰 Earnings: $${earnings}`);

    if (pageUrl && earnings > 0) {
      try {
        // Parse URL to extract organization slug
        const url = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);
        const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);

        if (pathSegments.length > 0) {
          const slug = pathSegments[0];
          console.log(`     🏷️  Extracted slug: "${slug}"`);

          // Aggregate earnings for this slug
          const currentEarnings = revenueBySlug.get(slug) || 0;
          revenueBySlug.set(slug, currentEarnings + earnings);
          console.log(`     ✅ Added to slug "${slug}" (total now: $${(currentEarnings + earnings).toFixed(2)})`);
        } else {
          console.log(`     ⚠️  No path segments found`);
        }
      } catch (error) {
        console.log(`     ❌ Failed to parse URL:`, error);
      }
    }
    console.log('');
  }
}

// Convert map to array of revenue data
const revenueData: AdSenseRevenueData[] = Array.from(revenueBySlug.entries()).map(([slug, revenue]) => ({
  slug: slug,
  revenue: revenue,
  currency: 'USD',
  date: '2024-01'
}));

console.log('='.repeat(80));
console.log('\n📊 Step 2: Aggregated Revenue by Slug\n');
revenueData.forEach(data => {
  console.log(`  🏷️  ${data.slug.padEnd(20)} → $${data.revenue.toFixed(2)} ${data.currency}`);
});

console.log('\n' + '='.repeat(80));
console.log('\n📊 Step 3: Matching with Organizations\n');

console.log('Organizations in database:');
mockOrganizations.forEach(org => {
  console.log(`  - ${org.name} (slug: "${org.slug}", old domain: ${org.domain})`);
});

console.log('\n' + '-'.repeat(80) + '\n');

let processedCount = 0;
let totalRevenue = 0;

for (const org of mockOrganizations) {
  console.log(`\n🔍 Processing: ${org.name} (slug: "${org.slug}")`);

  // Find revenue data for this organization's slug
  const orgRevenue = revenueData.find(data => data.slug === org.slug);

  if (orgRevenue) {
    // Calculate Capibara commission (50%)
    const capibaraCommission = orgRevenue.revenue * 0.5;
    const netAmount = orgRevenue.revenue - capibaraCommission;

    console.log(`   ✅ MATCH FOUND!`);
    console.log(`   📊 Gross Revenue: $${orgRevenue.revenue.toFixed(2)}`);
    console.log(`   🏢 Capibara Fee (50%): $${capibaraCommission.toFixed(2)}`);
    console.log(`   💵 Net Amount: $${netAmount.toFixed(2)}`);
    console.log(`   📝 Transaction would be created with:`);
    console.log(`      - Organization ID: ${org.id}`);
    console.log(`      - Before Fees: $${orgRevenue.revenue.toFixed(2)}`);
    console.log(`      - After Fees: $${netAmount.toFixed(2)}`);
    console.log(`      - Payment Details: {`);
    console.log(`          domain: "${org.domain}",`);
    console.log(`          slug: "${org.slug}",`);
    console.log(`          date: "${orgRevenue.date}",`);
    console.log(`          source: "Google AdSense API"`);
    console.log(`        }`);

    processedCount++;
    totalRevenue += orgRevenue.revenue;
  } else {
    console.log(`   ⚠️  NO MATCH - Would create $0 transaction`);
    console.log(`   📝 Transaction would be created with:`);
    console.log(`      - Organization ID: ${org.id}`);
    console.log(`      - Before Fees: $0.00`);
    console.log(`      - After Fees: $0.00`);
    console.log(`      - Reason: No AdSense revenue data for this slug`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('\n📊 Step 4: Platform Revenue (Capibara)\n');

const platformRevenue = revenueData.filter(data =>
  !mockOrganizations.some(org => data.slug === org.slug)
);

if (platformRevenue.length > 0) {
  const platformTotal = platformRevenue.reduce((sum, item) => sum + item.revenue, 0);
  console.log(`💰 Found ${platformRevenue.length} slug(s) with revenue for the platform:`);
  platformRevenue.forEach(item => {
    console.log(`   - "${item.slug}": $${item.revenue.toFixed(2)}`);
  });
  console.log(`\n📊 Total platform revenue: $${platformTotal.toFixed(2)}`);
  console.log(`ℹ️  This revenue belongs to Capibara and will NOT be stored in organization transactions.`);
} else {
  console.log('ℹ️  No platform revenue - all revenue matched to organizations.');
}

console.log('\n' + '='.repeat(80));
console.log('\n📊 Final Summary\n');
console.log(`✅ Organizations processed: ${mockOrganizations.length}`);
console.log(`💰 Organizations with revenue: ${processedCount}`);
console.log(`💵 Total organization revenue: $${totalRevenue.toFixed(2)}`);
const platformTotal = platformRevenue.reduce((sum, item) => sum + item.revenue, 0);
console.log(`🏢 Platform revenue (Capibara): $${platformTotal.toFixed(2)}`);
console.log(`📊 Grand total: $${(totalRevenue + platformTotal).toFixed(2)}`);
console.log('\n' + '='.repeat(80));
console.log('\n✨ Test completed! No database changes were made.\n');
