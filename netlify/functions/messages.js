const { connectToDatabase } = require('./utils/db');
const { ObjectId } = require('mongodb');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const { user } = context.clientContext;
    if (!user) return { statusCode: 401, body: 'You must be logged in.' };

    try {
        const { db } = await connectToDatabase();
        const messages = db.collection('messages');
        const circuits = db.collection('circuits');
        const groups = db.collection('groups');
        const method = event.httpMethod;

        const { circuitId, groupId } = event.queryStringParameters || {};
        if (method !== 'DELETE' && !circuitId && !groupId) return { statusCode: 400, body: 'Missing context' };

        // 1. Verify Access
        let targetCircuit = null;
        if (circuitId) {
            targetCircuit = await circuits.findOne({ _id: new ObjectId(circuitId) });
            if (!targetCircuit) return { statusCode: 404, body: 'Circuit not found' };
            let hasAccess = targetCircuit.ownerId === user.sub || targetCircuit.isPublic;
            if (!hasAccess && targetCircuit.groupId) {
                const group = await groups.findOne({
                    _id: new ObjectId(targetCircuit.groupId),
                    $or: [{ ownerId: user.sub }, { members: user.email }]
                });
                if (group) hasAccess = true;
            }
            if (!hasAccess) return { statusCode: 403, body: 'Unauthorized' };
        } else if (groupId) {
            const group = await groups.findOne({
                _id: new ObjectId(groupId),
                $or: [{ ownerId: user.sub }, { members: user.email }]
            });
            if (!group) return { statusCode: 403, body: 'Unauthorized' };
        }

        // GET: Fetch messages
        if (method === 'GET') {
            const query = circuitId ? { circuitId } : { groupId };
            // For groups, exclude messages older than 90 days
            if (groupId) {
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                query.timestamp = { $gte: ninetyDaysAgo };
            }

            const list = await messages.find(query).sort({ timestamp: 1 }).limit(100).toArray();
            return { statusCode: 200, body: JSON.stringify(list) };
        }

        // POST: Send new message
        if (method === 'POST') {
            const data = JSON.parse(event.body);
            const { text, replyTo } = data;
            if (!text || text.trim() === '') return { statusCode: 400, body: 'Empty message' };

            const newMessage = {
                circuitId: circuitId || null,
                groupId: groupId || null,
                senderId: user.sub,
                senderName: user.email.split('@')[0],
                text: text.trim(),
                timestamp: new Date(),
                replyTo: replyTo || null,
                reactions: {} // { emoji: [userIds] }
            };

            await messages.insertOne(newMessage);

            // Periodic Cleanup: remove old group messages (roughly 1 in 20 posts)
            if (groupId && Math.random() < 0.05) {
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                await messages.deleteMany({ groupId: { $ne: null }, timestamp: { $lt: ninetyDaysAgo } });
            }

            return { statusCode: 200, body: JSON.stringify(newMessage) };
        }

        // PATCH: React to message
        if (method === 'PATCH') {
            const { id, emoji, action } = JSON.parse(event.body);
            if (!id || !emoji) return { statusCode: 400, body: 'Missing ID or emoji' };

            const msg = await messages.findOne({ _id: new ObjectId(id) });
            if (!msg) return { statusCode: 404, body: 'Message not found' };

            const update = action === 'react'
                ? { $addToSet: { [`reactions.${emoji}`]: user.sub } }
                : { $pull: { [`reactions.${emoji}`]: user.sub } };

            await messages.updateOne({ _id: new ObjectId(id) }, update);
            return { statusCode: 200, body: JSON.stringify({ status: 'ok' }) };
        }

        // DELETE: Remove own message
        if (method === 'DELETE') {
            const { id } = event.queryStringParameters || {};
            if (!id) return { statusCode: 400, body: 'Missing ID' };

            const msg = await messages.findOne({ _id: new ObjectId(id) });
            if (!msg) return { statusCode: 404, body: 'Message not found' };
            if (msg.senderId !== user.sub) return { statusCode: 403, body: 'Cannot delete others messages' };

            await messages.deleteOne({ _id: new ObjectId(id) });
            return { statusCode: 204, body: '' };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};
