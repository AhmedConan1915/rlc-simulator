const { connectToDatabase } = require('./utils/db');
const { ObjectId } = require('mongodb');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    // 1. Check Auth
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: 'You must be logged in.' };
    }

    // 2. Check Admin
    const adminEmail = process.env.ADMIN_EMAIL;
    const isAdmin = adminEmail && user.email && user.email.toLowerCase() === adminEmail.toLowerCase();

    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('circuits');
        const method = event.httpMethod;

        // GET: List circuits (My Circuits or Public Search)
        if (method === 'GET') {
            const { id, public: isPublic, search, groupId } = event.queryStringParameters || {};

            // Get single circuit
            if (id) {
                const circuit = await collection.findOne({ _id: new ObjectId(id) });
                if (!circuit) return { statusCode: 404, body: 'Not found' };

                // Access check: Owner, Public, OR Admin
                if (circuit.ownerId !== user.sub && !circuit.isPublic && !isAdmin) {
                    return { statusCode: 403, body: 'Unauthorized' };
                }
                return { statusCode: 200, body: JSON.stringify(circuit) };
            }

            // List Circuits by Group
            if (groupId) {
                const group = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
                if (!group) return { statusCode: 404, body: 'Group not found' };

                const isMember = group.members.includes(user.email) || group.ownerId === user.sub;

                // If group is private, must be member or admin
                if (group.isPrivate && !isMember && !isAdmin) {
                    return { statusCode: 403, body: 'Unauthorized' };
                }

                const circuits = await collection.find({ groupId: groupId }).toArray();
                return { statusCode: 200, body: JSON.stringify(circuits) };
            }

            // List Public Circuits (Search) - Sorted by likes
            if (isPublic === 'true') {
                const query = { isPublic: true };
                if (search) query.name = { $regex: search, $options: 'i' };
                const circuits = await collection.find(query).sort({ likes: -1 }).limit(20).toArray();
                return { statusCode: 200, body: JSON.stringify(circuits) };
            }

            // List My Circuits
            const circuits = await collection.find({ ownerId: user.sub }).toArray();
            return { statusCode: 200, body: JSON.stringify(circuits) };
        }

        // POST: Save/Update Circuit
        if (method === 'POST') {
            const data = JSON.parse(event.body);
            const { _id, name, circuitData, isPublic, isEditable, groupId } = data;

            if (!_id) {
                // Create New
                const newCircuit = {
                    ownerId: user.sub,
                    ownerName: user.email,
                    name: name || 'Untitled Circuit',
                    circuitData,
                    isPublic: !!isPublic,
                    isEditable: !!isEditable,
                    likes: 0,
                    likedBy: [],
                    groupId: groupId || null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastEditedBy: user.sub,
                    lastEditedByName: user.email
                };
                const res = await collection.insertOne(newCircuit);
                return { statusCode: 200, body: JSON.stringify({ ...newCircuit, _id: res.insertedId }) };
            } else {
                // Update Existing
                const existing = await collection.findOne({ _id: new ObjectId(_id) });
                if (!existing) return { statusCode: 404, body: 'Not found' };

                // Permission check: Owner, (Public AND isEditable), OR Admin
                const isOwner = existing.ownerId === user.sub;
                const canEdit = isOwner || (existing.isPublic && existing.isEditable) || isAdmin;

                if (!canEdit) {
                    return { statusCode: 403, body: 'You do not have permission to edit this circuit.' };
                }

                const update = {
                    $set: {
                        circuitData,
                        isPublic: !!isPublic,
                        isEditable: !!isEditable,
                        updatedAt: new Date(),
                        lastEditedBy: user.sub,
                        lastEditedByName: user.email
                    }
                };

                // Owner or Admin can change name
                if ((isOwner || isAdmin) && name) {
                    update.$set.name = name;
                }

                const res = await collection.findOneAndUpdate(
                    { _id: new ObjectId(_id) },
                    update,
                    { returnDocument: 'after' }
                );

                return { statusCode: 200, body: JSON.stringify(res.value || res) };
            }
        }

        // PATCH: Like/Unlike Circuit
        if (method === 'PATCH') {
            const { id, action } = event.queryStringParameters || {};
            if (!id) return { statusCode: 400, body: 'Missing ID' };

            const circuit = await collection.findOne({ _id: new ObjectId(id) });
            if (!circuit) return { statusCode: 404, body: 'Not found' };

            const hasLiked = circuit.likedBy && circuit.likedBy.includes(user.sub);
            let update;

            if (action === 'like' && !hasLiked) {
                update = {
                    $inc: { likes: 1 },
                    $push: { likedBy: user.sub }
                };
            } else if (action === 'unlike' && hasLiked) {
                update = {
                    $inc: { likes: -1 },
                    $pull: { likedBy: user.sub }
                };
            } else {
                return { statusCode: 200, body: JSON.stringify(circuit) };
            }

            const res = await collection.findOneAndUpdate(
                { _id: new ObjectId(id) },
                update,
                { returnDocument: 'after' }
            );
            return { statusCode: 200, body: JSON.stringify(res.value || res) };
        }

        // DELETE
        if (method === 'DELETE') {
            const { id } = event.queryStringParameters;
            if (!id) return { statusCode: 400, body: 'Missing ID' };

            // Allow delete if Owner OR Admin
            const query = { _id: new ObjectId(id) };
            if (!isAdmin) {
                query.ownerId = user.sub;
            }

            const res = await collection.deleteOne(query);
            if (res.deletedCount === 0) return { statusCode: 404, body: 'Not found or Unauthorized' };
            return { statusCode: 200, body: 'Deleted' };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};
