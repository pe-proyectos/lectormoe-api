import { prisma } from '../models/prisma';
import { testAdSenseConnection, getMonthlyAdSenseRevenueCombined } from '../util/adsense';

// Helper function to create transaction ID and format dates
function createTransactionId(domain: string, year: number, month: number): { transactionId: string; startDateStr: string; endDateStr: string } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startDateStr = startDate.toLocaleDateString('en-GB').replace(/\//g, '/');
  const endDateStr = endDate.toLocaleDateString('en-GB').replace(/\//g, '/');
  const transactionId = `${domain}-${startDateStr}-${endDateStr}`;
  
  return { transactionId, startDateStr, endDateStr };
}

export async function updateCronAdSense(targetMonth?: number, targetYear?: number) {
  console.log('🚀 Starting monthly AdSense revenue fetch...');
  
  // Check if we're in production environment
  if (Bun.env.NODE_ENV !== 'production') {
    console.log('⚠️  Skipping AdSense cron job - not running in production environment');
    console.log(`   Current NODE_ENV: ${Bun.env.NODE_ENV || 'undefined'}`);
    return;
  }
  
  try {
    // Test connection first
    const isConnected = await testAdSenseConnection();
    if (!isConnected) {
      console.error('❌ Cannot connect to AdSense API. Skipping revenue fetch.');
      return;
    }

    // Determine target month and year
    const currentDate = new Date();
    let month: number;
    let year: number;
    
    if (targetMonth !== undefined && targetYear !== undefined) {
      // Both month and year provided
      month = targetMonth;
      year = targetYear;
    } else if (targetMonth !== undefined) {
      // Only month provided, use current year
      month = targetMonth;
      year = currentDate.getFullYear();
    } else {
      // No parameters provided, default to previous month
      const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      month = previousMonthDate.getMonth(); // 0-indexed
      year = previousMonthDate.getFullYear();
    }
    
    console.log(`📅 Processing AdSense revenue for: ${year}-${(month + 1).toString().padStart(2, '0')}`);

    // Get revenue data for the specified month (combines subdomain + path-based URLs)
    const revenueData = await getMonthlyAdSenseRevenueCombined(year, month + 1);
    console.log(revenueData);
    
    if (revenueData.length === 0) {
      console.log(`📊 No revenue data found for ${year}-${(month + 1).toString().padStart(2, '0')}`);
      console.log('📊 Creating $0 transactions for all organizations...');
      
      // Create $0 transactions for all organizations when no AdSense data is available
      const organizations = await prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          domain: true,
          slug: true
        }
      });

      const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;

      for (const org of organizations) {
        try {
          const { transactionId, startDateStr, endDateStr } = createTransactionId(
            org.domain, 
            year, 
            month + 1
          );

          const transactionData = {
            organizationId: org.id,
            origin: 'ADSENSE',
            description: `${startDateStr}-${endDateStr} | adsense 0.00 USD, comision capibara 50% 0.00 USD, ganancias netas 0.00 USD`,
            beforeFeesAmount: 0,
            amount: 0,
            currency: 'USD',
            type: 'EARNING',
            status: 'COMPLETED',
            paymentMethod: 'ADSENSE',
            paymentDetails: JSON.stringify({
              domain: org.domain,
              date: monthStr,
              source: 'Google AdSense API - No data available',
              reason: 'No AdSense accounts found or no revenue data'
            }),
            transactionDate: new Date(),
            transactionId: transactionId,
            capibaraFee: 0,
            paypalFee: 0
          };

          // Check if transaction already exists and update or create
          const existingTransaction = await prisma.organizationTransaction.findFirst({
            where: {
              transactionId: transactionId
            }
          });

          if (existingTransaction) {
            await prisma.organizationTransaction.update({
              where: {
                id: existingTransaction.id
              },
              data: transactionData
            });
            console.log(`✅ Updated AdSense revenue transaction for ${org.name} (${org.domain}): $0 - ID: ${transactionId}`);
          } else {
            await prisma.organizationTransaction.create({
              data: transactionData
            });
            console.log(`✅ Created AdSense revenue transaction for ${org.name} (${org.domain}): $0 - ID: ${transactionId}`);
          }
        } catch (error) {
          console.error(`❌ Error creating $0 transaction for organization ${org.name}:`, error);
        }
      }
      
      console.log(`🎉 Created $0 AdSense transactions for ${organizations.length} organizations`);
      return;
    }

    // Get all organizations
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        slug: true
      }
    });

    console.log(`📋 Processing revenue data for ${organizations.length} organizations`);

    let processedCount = 0;
    let totalRevenue = 0;

    // Process revenue data for each organization
    for (const org of organizations) {
      try {
        // Find revenue data for this organization's slug (now using URL paths instead of subdomains)
        const orgRevenue = revenueData.find(data =>
          data.slug === org.slug
        );

        // Create unique transaction ID for this organization
        const { transactionId, startDateStr, endDateStr } = createTransactionId(
          org.domain, 
          year, 
          month + 1
        );

        if (orgRevenue) {
          // Calculate Capibara commission (50%)
          const capibaraCommission = orgRevenue.revenue * 0.5;
          const netAmount = orgRevenue.revenue - capibaraCommission;

          const transactionData = {
            organizationId: org.id,
            origin: 'ADSENSE',
            description: `${startDateStr}-${endDateStr} | adsense ${orgRevenue.revenue.toFixed(2)} ${orgRevenue.currency}, comision capibara 50% ${capibaraCommission.toFixed(2)} ${orgRevenue.currency}, ganancias netas ${netAmount.toFixed(2)} ${orgRevenue.currency}`,
            beforeFeesAmount: orgRevenue.revenue,
            amount: netAmount,
            currency: orgRevenue.currency,
            type: 'EARNING',
            status: 'COMPLETED',
            paymentMethod: 'ADSENSE',
            paymentDetails: JSON.stringify({
              domain: org.domain,
              slug: org.slug,
              date: orgRevenue.date,
              source: 'Google AdSense API'
            }),
            transactionDate: new Date(),
            transactionId: transactionId,
            capibaraFee: capibaraCommission,
            paypalFee: 0
          };

          // Check if transaction already exists and update or create
          const existingTransaction = await prisma.organizationTransaction.findFirst({
            where: {
              transactionId: transactionId
            }
          });

          if (existingTransaction) {
            await prisma.organizationTransaction.update({
              where: {
                id: existingTransaction.id
              },
              data: transactionData
            });
            console.log(`✅ Updated AdSense revenue transaction for ${org.name} (${org.domain}): $${orgRevenue.revenue} - ID: ${transactionId}`);
          } else {
            await prisma.organizationTransaction.create({
              data: transactionData
            });
            console.log(`✅ Created AdSense revenue transaction for ${org.name} (${org.domain}): $${orgRevenue.revenue} - ID: ${transactionId}`);
          }

          processedCount++;
          totalRevenue += orgRevenue.revenue;
        } else {
          // Create $0 transaction for organizations without revenue data
          const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
          
          const transactionData = {
            organizationId: org.id,
            origin: 'ADSENSE',
            description: `${startDateStr}-${endDateStr} | adsense 0.00 USD, comision capibara 50% 0.00 USD, ganancias netas 0.00 USD`,
            beforeFeesAmount: 0,
            amount: 0,
            currency: 'USD',
            type: 'EARNING',
            status: 'COMPLETED',
            paymentMethod: 'ADSENSE',
            paymentDetails: JSON.stringify({
              domain: org.domain,
              date: monthStr,
              source: 'Google AdSense API - No revenue data'
            }),
            transactionDate: new Date(),
            transactionId: transactionId,
            capibaraFee: 0,
            paypalFee: 0
          };

          // Check if transaction already exists and update or create
          const existingTransaction = await prisma.organizationTransaction.findFirst({
            where: {
              transactionId: transactionId
            }
          });

          if (existingTransaction) {
            await prisma.organizationTransaction.update({
              where: {
                id: existingTransaction.id
              },
              data: transactionData
            });
            console.log(`✅ Updated AdSense revenue transaction for ${org.name} (${org.domain}): $0 - ID: ${transactionId}`);
          } else {
            await prisma.organizationTransaction.create({
              data: transactionData
            });
            console.log(`✅ Created AdSense revenue transaction for ${org.name} (${org.domain}): $0 - ID: ${transactionId}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing revenue for organization ${org.name}:`, error);
      }
    }

    console.log(`🎉 Monthly AdSense revenue fetch completed!`);
    console.log(`📊 Processed ${processedCount} organizations`);
    console.log(`💰 Total revenue processed: $${totalRevenue.toFixed(2)}`);

    // Log platform revenue (slugs without matching organization)
    const platformRevenue = revenueData.filter(data =>
      !organizations.some(org =>
        data.slug === org.slug
      )
    );

    if (platformRevenue.length > 0) {
      const platformTotal = platformRevenue.reduce((sum, item) => sum + item.revenue, 0);
      console.log(`\n💰 Platform Revenue (Capibara)`);
      console.log(`   Found ${platformRevenue.length} slug(s) with revenue for the platform:`);
      platformRevenue.forEach(item => {
        console.log(`   - ${item.slug}: $${item.revenue.toFixed(2)}`);
      });
      console.log(`   📊 Total platform revenue: $${platformTotal.toFixed(2)}`);
      console.log(`   ℹ️  This revenue belongs to Capibara and is not stored in organization transactions`);
    }

  } catch (error) {
    console.error('❌ Error in monthly AdSense revenue fetch:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update only if this file is executed directly
if (import.meta.main) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let targetMonth: number | undefined;
  let targetYear: number | undefined;
  
  // Parse month argument (e.g., --month=5 or -m 5)
  const monthArg = args.find(arg => arg.startsWith('--month=')) || args.find(arg => arg === '-m');
  if (monthArg) {
    if (monthArg.includes('=')) {
      targetMonth = parseInt(monthArg.split('=')[1]) - 1; // Convert to 0-indexed
    } else {
      const monthIndex = args.indexOf(monthArg);
      if (monthIndex + 1 < args.length) {
        targetMonth = parseInt(args[monthIndex + 1]) - 1; // Convert to 0-indexed
      }
    }
  }
  
  // Parse year argument (e.g., --year=2024 or -y 2024)
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
    console.log('Usage: bun run update-cron-adsense.ts [options]');
    console.log('Options:');
    console.log('  --month=5, -m 5     Process month 5 (May)');
    console.log('  --year=2024, -y 2024 Process year 2024');
    console.log('  --help, -h          Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  bun run update-cron-adsense.ts --month=5');
    console.log('  bun run update-cron-adsense.ts -m 5 -y 2024');
    console.log('  bun run update-cron-adsense.ts --month=12 --year=2023');
    process.exit(0);
  }
  
  updateCronAdSense(targetMonth, targetYear);
}
