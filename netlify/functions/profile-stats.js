const { connectToDatabase } = require('./utils/db');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const { user } = context.clientContext;

    if (!user) {
        return { statusCode: 401, body: 'You must be logged in.' };
    }

    try {
        const { db } = await connectToDatabase();
        const circuits = db.collection('circuits');

        // Parallel execution for efficiency
        const [totalCircuits, topCircuitList] = await Promise.all([
            circuits.countDocuments({ ownerId: user.sub }),
            circuits.find({ ownerId: user.sub }).sort({ likes: -1 }).limit(1).toArray()
        ]);

        const topCircuit = topCircuitList.length > 0 ? topCircuitList[0] : null;

        return {
            statusCode: 200,
            body: JSON.stringify({
                totalCircuits,
                topCircuit: topCircuit ? {
                    id: topCircuit._id,
                    name: topCircuit.name,
                    likes: topCircuit.likes || 0
                } : null
            })
        };

    } catch (error) {
        console.error('Profile Stats Error:', error);
        return { statusCode: 500, body: error.toString() };
    }
};
