const { connectToDatabase } = require('./utils/db');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    // Public endpoint: No auth required to READ config
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let config = null;
    let dbError = null;

    try {
        if (process.env.MONGODB_URI) {
            const { db } = await connectToDatabase();
            config = await db.collection('system_config').findOne({ _id: 'main_config' });
        }
    } catch (error) {
        console.error("DB Connection Error:", error);
        dbError = error.message;
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ...(config || { message: '' }),
            isDev: process.env.NETLIFY_DEV === 'true',
            hasMongo: !!process.env.MONGODB_URI,
            dbError: dbError
        })
    };
};
