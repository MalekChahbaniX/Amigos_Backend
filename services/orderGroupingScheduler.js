/**
 * Order Grouping Scheduler
 * Runs every minute to detect and group eligible orders (A2, A3)
 * Implements 5-10 minute delay before orders become available for grouping
 */

const orderGroupingService = require('./orderGroupingService');
const Order = require('../models/Order');

let schedulerInterval = null;

/**
 * Initialize the grouping scheduler (call from server.js)
 */
function startGroupingScheduler() {
  if (schedulerInterval) {
    console.warn('⚠️ Grouping scheduler already running');
    return;
  }

  console.log('🚀 Starting order grouping scheduler (runs every 60 seconds)');

  // Run every 60 seconds
  schedulerInterval = setInterval(async () => {
    try {
      await runGroupingCycle();
    } catch (error) {
      console.error('❌ Error in grouping scheduler cycle:', error);
    }
  }, 60 * 1000); // 60 seconds

  // Also run immediately on startup
  runGroupingCycle();
}

/**
 * Stop the scheduler (call on server shutdown)
 */
function stopGroupingScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏹️ Grouping scheduler stopped');
  }
}

/**
 * Single grouping cycle: enforce delay windows and detect/group orders
 */
async function runGroupingCycle() {
  try {
    // Step 1: Update orders past their processing delay to make them available
    await releaseOrdersFromDelay();

    // Step 2: Detect and group orders
      const result = await orderGroupingService.detectAndGroupOrders();

      if (result.grouped > 0) {
        console.log(`✅ Grouping cycle: formed ${result.grouped} groups from ${result.attempted} candidates`);

        // Notify for each formed group (do not let notification failures stop the scheduler)
        if (Array.isArray(result.groups) && result.groups.length > 0) {
          const notifyPromises = result.groups.map(async (g) => {
            try {
              // g: { groupedOrders, solde, groupType }
              await orderGroupingService.notifyGroupFormed(g.groupedOrders, g.groupType, g.solde);
            } catch (err) {
              console.error('Error notifying for group', g, err);
            }
          });

          // Run notifications in parallel but don't await to block scheduler for too long
          Promise.allSettled(notifyPromises).then((outcomes) => {
            const successes = outcomes.filter(o => o.status === 'fulfilled').length;
            const failures = outcomes.length - successes;
            console.log(`🔔 Notifications completed: ${successes} sent, ${failures} failed`);
          }).catch(err => {
            console.error('Unexpected error while sending group notifications:', err);
          });
        }
    }
  } catch (error) {
    console.error('Error in runGroupingCycle:', error);
  }
}

/**
 * Release orders whose processing delay has expired
 * Orders are initially scheduled with processingDelay (5-10 min) and scheduledFor
 * Once scheduledFor <= now, they become available for grouping
 */
async function releaseOrdersFromDelay() {
  try {
    const now = new Date();

    // Find orders that are scheduled and ready to be released
    const readyOrders = await Order.updateMany(
      {
        status: 'pending',
        isGrouped: false,
        scheduledFor: { $exists: true, $lte: now }
      },
      {
        $set: { processingDelay: 0, scheduledFor: null }
      }
    );

    if (readyOrders.modifiedCount > 0) {
      console.log(`⏱️ Released ${readyOrders.modifiedCount} orders from processing delay`);
    }
  } catch (error) {
    console.error('Error releasing orders from delay:', error);
  }
}

/**
 * Get current scheduler status
 */
function getSchedulerStatus() {
  return {
    running: schedulerInterval !== null,
    intervalMs: 60 * 1000
  };
}

module.exports = {
  startGroupingScheduler,
  stopGroupingScheduler,
  runGroupingCycle,
  releaseOrdersFromDelay,
  getSchedulerStatus
};
