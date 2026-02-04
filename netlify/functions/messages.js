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

        const { circuitId } = event.queryStringParameters || {};
        if (!circuitId) return { statusCode: 400, body: 'Missing circuitId' };

        // 1. Verify Access to the circuit
        const circuit = await circuits.findOne({ _id: new ObjectId(circuitId) });
        if (!circuit) return { statusCode: 404, body: 'Circuit not found' };

        let hasAccess = circuit.ownerId === user.sub || circuit.isPublic;

        if (!hasAccess && circuit.groupId) {
            // Check if user is in the group
            const group = await groups.findOne({
                _id: new ObjectId(circuit.groupId),
                $or: [{ ownerId: user.sub }, { members: user.email }]
            });
            if (group) hasAccess = true;
        }

        if (!hasAccess) return { statusCode: 403, body: 'Unauthorized' };

        // GET: Fetch messages for circuit
        if (method === 'GET') {
            const list = await messages.find({ circuitId }).sort({ timestamp: 1 }).limit(50).toArray();
            return { statusCode: 200, body: JSON.stringify(list) };
        }

        // POST: Send new message
        if (method === 'POST') {
            const data = JSON.parse(event.body);
            const { text } = data;
            if (!text || text.trim() === '') return { statusCode: 400, body: 'Empty message' };

            const newMessage = {
                circuitId,
                senderId: user.sub,
                senderName: user.email.split('@')[0], // Use email prefix as handle
                text: text.trim(),
                timestamp: new Date()
            };

            await messages.insertOne(newMessage);
            return { statusCode: 200, body: JSON.stringify(newMessage) };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};
