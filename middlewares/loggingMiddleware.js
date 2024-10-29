const fs = require('fs');
const path = require('path');

const logStream = fs.createWriteStream(path.join(__dirname, 'requests.log'), { flags: 'a' });

module.exports = (req, res, next) => {
    const log = `${new Date().toISOString()} ${req.method} ${req.url}\n`;
    logStream.write(log);
    next();
};
