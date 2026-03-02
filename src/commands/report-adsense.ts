import { prisma } from '../models/prisma';
import { getMonthlyAdSenseRevenueCombined } from '../util/adsense';

/**
 * Generate AdSense revenue report without saving to database
 * This script only displays information
 * Uses combined data (both subdomain and path-based URLs)
 */
async function reportAdSense(month: number, year: number) {
  console.log('📊 AdSense Revenue Report (Read-only)\n');
  console.log('='.repeat(80));
  console.log(`📅 Period: ${year}-${month.toString().padStart(2, '0')}`);
  console.log(`ℹ️  View-based distribution: total domain revenue split by org views`);
  console.log('='.repeat(80));

  try {
    // Get revenue data from AdSense API (both subdomain and path-based)
    console.log('\n🔄 Fetching data from Google AdSense API...\n');
    const revenueData = await getMonthlyAdSenseRevenueCombined(year, month);

    if (revenueData.length === 0) {
      console.log('⚠️  No revenue data found for this period');
      console.log('='.repeat(80));
      return;
    }

    // Get all organizations from database
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        slug: true
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 ORGANIZATIONS REVENUE\n');

    let totalOrgRevenue = 0;
    let totalCapibaraFees = 0;
    let totalNetRevenue = 0;
    let orgsWithRevenue = 0;

    const orgRevenueList: Array<{name: string; slug: string; gross: number; fee: number; net: number}> = [];

    // Process each organization
    for (const org of organizations) {
      const orgRevenue = revenueData.find(data => data.slug === org.slug);

      if (orgRevenue) {
        const capibaraFee = orgRevenue.revenue * 0.5;
        const netAmount = orgRevenue.revenue - capibaraFee;

        orgRevenueList.push({
          name: org.name,
          slug: org.slug,
          gross: orgRevenue.revenue,
          fee: capibaraFee,
          net: netAmount
        });

        totalOrgRevenue += orgRevenue.revenue;
        totalCapibaraFees += capibaraFee;
        totalNetRevenue += netAmount;
        orgsWithRevenue++;
      }
    }

    // Sort by gross revenue descending
    orgRevenueList.sort((a, b) => b.gross - a.gross);

    // Display organization revenue
    orgRevenueList.forEach((item, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${item.name} (${item.slug})`);
      console.log(`    💰 Gross Revenue:      $${item.gross.toFixed(2)}`);
      console.log(`    🏢 Capibara Fee (50%): $${item.fee.toFixed(2)}`);
      console.log(`    💵 Net for Org:        $${item.net.toFixed(2)}`);
      console.log('');
    });

    // Organizations without revenue
    const orgsWithoutRevenue = organizations.filter(org =>
      !revenueData.some(data => data.slug === org.slug)
    );

    if (orgsWithoutRevenue.length > 0) {
      console.log('-'.repeat(80));
      console.log(`\n⚪ Organizations without revenue (${orgsWithoutRevenue.length}):\n`);
      orgsWithoutRevenue.forEach(org => {
        console.log(`   - ${org.name} (${org.slug})`);
      });
      console.log('');
    }

    // Final summary
    console.log('='.repeat(80));
    console.log('\n📊 SUMMARY\n');
    console.log(`   Organizations processed:       ${organizations.length}`);
    console.log(`   Organizations with revenue:    ${orgsWithRevenue}`);
    console.log(`   Organizations without revenue: ${orgsWithoutRevenue.length}`);
    console.log('');
    console.log(`   💰 Total AdSense Revenue:      $${totalOrgRevenue.toFixed(2)}`);
    console.log(`   🏢 Capibara Platform (50%):    $${totalCapibaraFees.toFixed(2)}`);
    console.log(`   💵 Total Net for Orgs (50%):   $${totalNetRevenue.toFixed(2)}`);
    console.log('');
    console.log('   ℹ️  Revenue distributed by page views of ads-enabled orgs');
    console.log('');
    console.log('='.repeat(80));
    console.log('\n✅ Report completed (no database changes were made)\n');

  } catch (error) {
    console.error('❌ Error generating report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the report
if (import.meta.main) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let targetMonth: number = 1; // January by default
  let targetYear: number = 2025; // 2025 by default

  // Parse month argument
  const monthArg = args.find(arg => arg.startsWith('--month=')) || args.find(arg => arg === '-m');
  if (monthArg) {
    if (monthArg.includes('=')) {
      targetMonth = parseInt(monthArg.split('=')[1]);
    } else {
      const monthIndex = args.indexOf(monthArg);
      if (monthIndex + 1 < args.length) {
        targetMonth = parseInt(args[monthIndex + 1]);
      }
    }
  }

  // Parse year argument
  const yearArg = args.find(arg => arg.startsWith('--year=')) || args.find(arg => arg === '-y');
  if (yearArg) {
    if (yearArg.includes('=')) {
      targetYear = parseInt(yearArg.split('=')[1]);
    } else {
      const yearIndex = args.indexOf(yearArg);
      if (yearIndex + 1 < args.length) {
        targetYear = parseInt(args[yearIndex + 1]);
      }
    }
  }

  // Show usage if help is requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: bun run report-adsense.ts [options]');
    console.log('Options:');
    console.log('  --month=1, -m 1     Report for month (1-12) - default: 1 (January)');
    console.log('  --year=2025, -y 2025 Report for year - default: 2025');
    console.log('  --help, -h          Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  bun run report-adsense.ts');
    console.log('  bun run report-adsense.ts --month=1 --year=2025');
    console.log('  bun run report-adsense.ts -m 12 -y 2024');
    process.exit(0);
  }

  reportAdSense(targetMonth, targetYear);
}
