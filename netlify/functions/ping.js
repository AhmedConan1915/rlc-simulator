const { connectToDatabase } = require('./utils/db');

exports.handler = async (event, context) => {
    try {
        await connectToDatabase();
        return { statusCode: 200, body: JSON.stringify({ message: "MongoDB Connected Successfully!" }) };
    } catch (error) {
        console.error("DB Ping Error:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
