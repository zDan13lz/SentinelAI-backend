const cron = require('node-cron');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';

/**
 * Reset flow data daily at 3:00 AM ET (before pre-market)
 * Cron: "0 3 * * *" = Every day at 3:00 AM server time
 */
function scheduleDailyReset() {
  // Run at 3:00 AM ET every day
  cron.schedule('0 3 * * *', async () => {
    console.log('🔄 Running daily flow data reset at 3:00 AM ET...');
    
    try {
      const response = await axios.post(`${API_URL}/api/flow/reset`);
      
      if (response.data.success) {
        console.log(`✅ Daily reset complete: ${response.data.deletedCount} old trades removed`);
      } else {
        console.error('❌ Daily reset failed:', response.data.error);
      }
    } catch (error) {
      console.error('❌ Error during daily reset:', error.message);
    }
  }, {
    timezone: 'America/New_York' // ET timezone
  });
  
  console.log('⏰ Daily reset cron job scheduled for 3:00 AM ET');
}

module.exports = { scheduleDailyReset };