const cron = require('node-cron');

function startCronJobs() {
    cron.schedule('0 0 * * *', () => {
        console.log('Running cron job');
    });
}

module.exports = startCronJobs;
