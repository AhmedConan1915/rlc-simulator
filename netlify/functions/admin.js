const { connectToDatabase } = require('./utils/db');
const { logSystemEvent } = require('./utils/logger');
const { ObjectId } = require('mongodb');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const { user } = context.clientContext;
    if (!user) return { statusCode: 401, body: 'Logged in user required' };

    // STRICT CHECK: Admin Email (Case Insensitive)
    const adminEmail = process.env.ADMIN_EMAIL;
    const isAuthorized = adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();

    if (!isAuthorized) {
        await logSystemEvent('WARN', 'Unauthorized Admin Attempt', user.sub, { email: user.email });
        return { statusCode: 403, body: 'Forbidden: You are not authorized.' };
    }

    try {
        const { db } = await connectToDatabase();
        const method = event.httpMethod;
        const data = event.body ? JSON.parse(event.body) : {};

        // POST /admin/logs
        if (event.path.endsWith('/logs')) {
            const logs = await db.collection('system_logs')
                .find({})
                .sort({ timestamp: -1 })
                .limit(100)
                .toArray();
            return { statusCode: 200, body: JSON.stringify(logs) };
        }

        // POST /admin/stats
        if (event.path.endsWith('/stats')) {
            const circuitCount = await db.collection('circuits').countDocuments();
            const groupCount = await db.collection('groups').countDocuments();
            const users = await db.collection('circuits').distinct('ownerId');

            return {
                statusCode: 200, body: JSON.stringify({
                    circuits: circuitCount,
                    groups: groupCount,
                    users: users.length
                })
            };
        }

        // POST /admin/config (Manage Config/Announcements)
        if (event.path.endsWith('/config')) {
            const config = db.collection('system_config');
            if (method === 'GET') {
                const doc = await config.findOne({ _id: 'main_config' });
                return { statusCode: 200, body: JSON.stringify(doc || { message: '' }) };
            }
            if (method === 'POST') {
                const { message } = data;
                await config.updateOne(
                    { _id: 'main_config' },
                    { $set: { message, updatedAt: new Date(), updatedBy: user.email } },
                    { upsert: true }
                );
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
        }

        // POST /admin/users
        if (event.path.endsWith('/users')) {
            const pipeline = [
                { $group: { _id: "$ownerId", email: { $first: "$ownerName" }, count: { $sum: 1 } } }
            ];
            const activeUsers = await db.collection('circuits').aggregate(pipeline).toArray();
            const groupUsers = await db.collection('groups').aggregate(pipeline).toArray();

            const userMap = new Map();
            activeUsers.forEach(u => userMap.set(u._id, { id: u._id, email: u.email, circuits: u.count, groups: 0 }));
            groupUsers.forEach(u => {
                if (userMap.has(u._id)) {
                    userMap.get(u._id).groups = u.count;
                } else {
                    userMap.set(u._id, { id: u._id, email: u.email, circuits: 0, groups: u.count });
                }
            });

            return { statusCode: 200, body: JSON.stringify(Array.from(userMap.values())) };
        }

        // POST /admin/nuke-user
        if (event.path.endsWith('/nuke-user')) {
            const { userId } = data;
            if (!userId) return { statusCode: 400, body: "Missing userId" };

            const cRes = await db.collection('circuits').deleteMany({ ownerId: userId });
            const gRes = await db.collection('groups').deleteMany({ ownerId: userId });

            await logSystemEvent('ADMIN', 'Nuked User Data', user.sub, { targetUserId: userId, deletedCircuits: cRes.deletedCount, deletedGroups: gRes.deletedCount });

            return { statusCode: 200, body: JSON.stringify({ circuits: cRes.deletedCount, groups: gRes.deletedCount }) };
        }

        return { statusCode: 404, body: 'Admin endpoint not found' };

    } catch (e) {
        return { statusCode: 500, body: e.toString() };
    }
}
