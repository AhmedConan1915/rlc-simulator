const { connectToDatabase } = require('./db');

async function logSystemEvent(level, message, userId = null, metadata = {}) {
    try {
        const { db } = await connectToDatabase();
        const logs = db.collection('system_logs');

        await logs.insertOne({
            level, // 'INFO', 'WARN', 'ERROR', 'ADMIN'
            message,
            userId,
            metadata,
            timestamp: new Date()
        });
    } catch (e) {
        console.error("Failed to write system log:", e);
    }
}

module.exports = { logSystemEvent };
