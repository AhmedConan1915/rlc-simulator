/**
 * Auth Bridge Function
 * Bypasses ALL local proxy/CORS issues by acting as a server-side tunnel.
 */

exports.handler = async (event, context) => {
    // The widget appends /settings, /token, etc.
    // We extract that part from the end of the URL
    const parts = event.path.split('/');
    const lastPart = parts[parts.length - 1];

    // Default to settings if path is just the function name
    const subPath = (lastPart === 'auth-bridge') ? 'settings' : lastPart;
    const targetUrl = `https://rlc-simulator.netlify.app/.netlify/identity/${subPath}`;

    console.log(`[AUTH-BRIDGE] Tunneling request to: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: event.httpMethod,
            headers: {
                ...event.headers,
                'host': 'rlc-simulator.netlify.app'
            },
            body: event.body
        });

        const data = await response.text();
        console.log(`[AUTH-BRIDGE] Success: ${response.status}`);

        return {
            statusCode: response.status,
            body: data,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
    } catch (error) {
        console.error('[AUTH-BRIDGE] Tunnel Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Auth Bridge Failed', details: error.message })
        };
    }
};
