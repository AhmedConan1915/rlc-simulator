const { connectToDatabase } = require('./utils/db');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    // Public endpoint: No auth required to READ config
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { db } = await connectToDatabase();
        const config = await db.collection('system_config').findOne({ _id: 'main_config' });

        return {
            statusCode: 200,
            body: JSON.stringify(config || { message: '' })
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
};
