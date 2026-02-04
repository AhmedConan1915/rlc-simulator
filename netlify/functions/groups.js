const { connectToDatabase } = require('./utils/db');
const { ObjectId } = require('mongodb');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const { user } = context.clientContext;
    if (!user) return { statusCode: 401, body: 'You must be logged in.' };

    // Check Admin
    // Check Admin
    const adminEmail = process.env.ADMIN_EMAIL;
    const isAdmin = adminEmail && user.email && user.email.toLowerCase() === adminEmail.toLowerCase();

    try {
        const { db } = await connectToDatabase();
        const groups = db.collection('groups');
        const method = event.httpMethod;

        // GET: List My Groups or Search Public Groups
        if (method === 'GET') {
            const { id, search, myGroups } = event.queryStringParameters || {};

            // Get Single Group
            if (id) {
                const group = await groups.findOne({ _id: new ObjectId(id) });
                if (!group) return { statusCode: 404, body: 'Not found' };

                const isMember = group.members.includes(user.email) || group.ownerId === user.sub;
                if (group.isPrivate && !isMember && !isAdmin) {
                    return { statusCode: 403, body: 'Unauthorized' };
                }
                return { statusCode: 200, body: JSON.stringify(group) };
            }

            if (myGroups === 'true') {
                // Groups I own OR am a member of OR Admin (sees all if requested? No, stick to own/member unless search mode)
                // Actually, Admin might want to see ALL groups. Let's add a listAll=true param for admin
                const { listAll } = event.queryStringParameters || {};

                if (listAll === 'true' && isAdmin) {
                    const list = await groups.find({}).toArray();
                    return { statusCode: 200, body: JSON.stringify(list) };
                }

                const list = await groups.find({
                    $or: [{ ownerId: user.sub }, { members: user.email }]
                }).toArray();
                return { statusCode: 200, body: JSON.stringify(list) };
            }

            // Search Public Groups
            const query = { isPrivate: false };
            if (search) query.name = { $regex: search, $options: 'i' };
            const list = await groups.find(query).limit(20).toArray();
            return { statusCode: 200, body: JSON.stringify(list) };
        }

        // POST: Create Group or Update (Add/Remove Member)
        if (method === 'POST') {
            const data = JSON.parse(event.body);
            const { action, groupId, memberEmail, groupName, isPrivate } = data;

            // Create Group
            if (action === 'create') {
                const newGroup = {
                    ownerId: user.sub,
                    ownerName: user.email,
                    name: groupName,
                    isPrivate: !!isPrivate,
                    members: [], // Owner is implied
                    createdAt: new Date()
                };
                const res = await groups.insertOne(newGroup);
                return { statusCode: 200, body: JSON.stringify({ ...newGroup, _id: res.insertedId }) };
            }

            // ACTIONS REQUIRING PERMISSIONS
            // 1. Check permission
            const group = await groups.findOne({ _id: new ObjectId(groupId) });
            if (!group) return { statusCode: 404, body: 'Group not found' };

            const isOwner = group.ownerId === user.sub;
            if (!isOwner && !isAdmin) {
                return { statusCode: 403, body: 'Unauthorized' };
            }

            // Add Member
            if (action === 'addMember') {
                const res = await groups.updateOne(
                    { _id: new ObjectId(groupId) },
                    { $addToSet: { members: memberEmail } }
                );
                return { statusCode: 200, body: JSON.stringify(res) };
            }

            // Remove Member
            if (action === 'removeMember') {
                const res = await groups.updateOne(
                    { _id: new ObjectId(groupId) },
                    { $pull: { members: memberEmail } }
                );
                return { statusCode: 200, body: JSON.stringify(res) };
            }

            // Delete Group (Admin or Owner)
            if (action === 'delete') {
                const res = await groups.deleteOne({ _id: new ObjectId(groupId) });
                return { statusCode: 200, body: JSON.stringify(res) };
            }
        }

        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};
