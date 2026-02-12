/**
 * OFFLINE MOCK MODE
 * Un-comment the script tag in index.html to enable.
 * This mocks Netlify Identity and the API backend.
 */

(function () {
    console.log("%c🔌 OFFLINE MOCK MODE ENABLED", "background: #22c55e; color: #fff; padding: 4px; border-radius: 4px; font-weight: bold;");

    // --- 1. MOCK DATA ---
    const MOCK_USER = {
        id: "mock-user-id",
        email: "mock@local.dev",
        user_metadata: { full_name: "Mock Developer" },
        app_metadata: { roles: ["admin"] }, // Grant admin access for testing
        token: { access_token: "mock-jwt-token" },
        sub: "mock-user-id",
        jwt: function () { return Promise.resolve(this.token.access_token); },
        update: function (data) {
            console.log("[MockIdentity] User Updated:", data);
            return Promise.resolve(this);
        }
    };

    let currentUser = null;
    const callbacks = { init: [], login: [], logout: [], close: [] };

    let mockCircuits = [
        { _id: "c1", name: "RC Filter (Mock)", ownerName: "Mock Dev", ownerId: "mock-user-id", isPublic: true, likes: 5, updatedAt: new Date().toISOString(), circuitData: JSON.stringify([]) },
        { _id: "c2", name: "Radian Oscillator", ownerName: "Alice", ownerId: "user-2", isPublic: true, likes: 12, updatedAt: new Date().toISOString(), circuitData: JSON.stringify([]) }
    ];

    let mockGroups = [
        { _id: "g1", name: "Local Dev Team", ownerId: "mock-user-id", ownerName: "Mock Dev", members: ["alice@example.com"], isPrivate: true }
    ];

    let mockMessages = [
        { senderId: "user-2", senderName: "Alice", text: "Hey, nice circuit!", timestamp: Date.now() - 10000 }
    ];

    // --- 2. MOCK NETLIFY IDENTITY ---
    window.netlifyIdentity = {
        init: (opts) => {
            console.log("[MockIdentity] Init", opts);
            // Auto-trigger init callback
            setTimeout(() => {
                callbacks.init.forEach(cb => cb(currentUser));
            }, 100);
        },
        open: () => {
            console.log("[MockIdentity] Open Login Modal");
            // Auto-login for convenience
            if (confirm("🔌 OFFLINE MODE: Sign in as Mock User?")) {
                currentUser = MOCK_USER;
                callbacks.login.forEach(cb => cb(currentUser));
                // Also trigger close because real widget closes on login
                callbacks.close.forEach(cb => cb());
            }
        },
        close: () => {
            console.log("[MockIdentity] Close");
            callbacks.close.forEach(cb => cb());
        },
        logout: () => {
            console.log("[MockIdentity] Logout");
            currentUser = null;
            callbacks.logout.forEach(cb => cb());
        },
        on: (event, cb) => {
            if (callbacks[event]) callbacks[event].push(cb);
        },
        currentUser: () => currentUser,
        // Helper to refresh token (no-op)
        refresh: () => Promise.resolve("mock-jwt-token")
    };


    // --- 3. MOCK FETCH (API INTERCEPTOR) ---
    const originalFetch = window.fetch;

    window.fetch = async function (url, options = {}) {
        // Only intercept calls to our functions
        if (typeof url === 'string' && url.includes('/.netlify/functions/')) {
            console.log(`[MockAPI] ${options.method || 'GET'} ${url}`, options.body ? JSON.parse(options.body) : '');

            // Artificial interactions delay
            await new Promise(r => setTimeout(r, 300));

            const endpoint = url.split('/.netlify/functions/')[1].split('?')[0];
            const params = new URLSearchParams(url.split('?')[1]);
            const method = options.method || 'GET';
            const body = options.body ? JSON.parse(options.body) : {};

            // Helper to return JSON response
            const jsonResponse = (data) => new Response(JSON.stringify(data), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

            const textResponse = (text) => new Response(text, { status: 200 });

            // --- ENDPOINT HANDLERS ---

            if (endpoint === 'config') {
                return jsonResponse({ message: "Note: Running in Offline Mock Mode" });
            }

            if (endpoint === 'circuits') {
                if (method === 'GET') {
                    if (params.get('id')) {
                        const c = mockCircuits.find(x => x._id === params.get('id'));
                        return c ? jsonResponse(c) : new Response("Not Found", { status: 404 });
                    }
                    if (params.get('public')) {
                        const q = (params.get('search') || '').toLowerCase();
                        return jsonResponse(mockCircuits.filter(c => c.isPublic && c.name.toLowerCase().includes(q)));
                    }
                    // My circuits
                    return jsonResponse(mockCircuits.filter(c => c.ownerId === (currentUser?.id || '')));
                }
                if (method === 'POST') {
                    // Save
                    const newCircuit = {
                        ...body,
                        _id: body._id || Math.random().toString(36).substr(2, 9),
                        ownerId: currentUser.id,
                        ownerName: currentUser.user_metadata.full_name,
                        updatedAt: new Date().toISOString(),
                        likes: body._id ? (mockCircuits.find(c => c._id === body._id)?.likes || 0) : 0
                    };
                    // Update or Push
                    const idx = mockCircuits.findIndex(c => c._id === newCircuit._id);
                    if (idx >= 0) mockCircuits[idx] = newCircuit;
                    else mockCircuits.push(newCircuit);
                    return jsonResponse(newCircuit);
                }
                if (method === 'DELETE') {
                    const id = params.get('id');
                    mockCircuits = mockCircuits.filter(c => c._id !== id);
                    return textResponse("Deleted");
                }
                if (method === 'PATCH') {
                    // Toggle Like
                    const id = params.get('id');
                    const c = mockCircuits.find(x => x._id === id);
                    if (c) {
                        const action = params.get('action');
                        if (action === 'like') c.likes = (c.likes || 0) + 1;
                        else c.likes = Math.max(0, (c.likes || 0) - 1);
                        return jsonResponse(c);
                    }
                }
            }

            if (endpoint === 'groups') {
                if (method === 'GET') {
                    if (params.get('id')) {
                        return jsonResponse(mockGroups.find(g => g._id === params.get('id')));
                    }
                    if (params.get('myGroups')) {
                        return jsonResponse(mockGroups.filter(g => g.ownerId === currentUser?.id || g.members.includes(currentUser?.email)));
                    }
                    return jsonResponse(mockGroups.filter(g => !g.isPrivate));
                }
                if (method === 'POST') {
                    if (body.action === 'create') {
                        const g = {
                            _id: Math.random().toString(36).substr(2, 9),
                            name: body.groupName,
                            isPrivate: body.isPrivate,
                            ownerId: currentUser.id,
                            ownerName: currentUser.user_metadata.full_name,
                            members: []
                        };
                        mockGroups.push(g);
                        return jsonResponse(g);
                    }
                    if (body.action === 'delete') {
                        mockGroups = mockGroups.filter(g => g._id !== body.groupId);
                        return jsonResponse({ success: true });
                    }
                }
            }

            if (endpoint === 'messages') {
                if (method === 'GET') {
                    return jsonResponse(mockMessages); // Return all for demo
                }
                if (method === 'POST') {
                    const msg = {
                        senderId: currentUser.id,
                        senderName: currentUser.user_metadata.full_name,
                        text: body.text,
                        timestamp: Date.now()
                    };
                    mockMessages.push(msg);
                    return jsonResponse(msg);
                }
            }

            if (endpoint === 'profile-stats') {
                // Calculate stats from mock data
                const myC = mockCircuits.filter(c => c.ownerId === currentUser?.id);
                const top = myC.sort((a, b) => b.likes - a.likes)[0];
                return jsonResponse({
                    totalCircuits: myC.length,
                    topCircuit: top || null
                });
            }

            if (endpoint.startsWith('admin/')) {
                if (endpoint === 'admin/stats') {
                    return jsonResponse({ users: 15, circuits: mockCircuits.length, groups: mockGroups.length });
                }
                if (endpoint === 'admin/logs') {
                    return jsonResponse([{ level: 'INFO', message: 'System startup', timestamp: Date.now() }]);
                }
                if (endpoint === 'admin/users') {
                    return jsonResponse([
                        { id: currentUser.id, email: currentUser.email, circuits: 5, groups: 1 },
                        { id: 'user-2', email: 'alice@example.com', circuits: 12, groups: 0 }
                    ]);
                }
            }

            return new Response("Mock Endpoint Not Implemented: " + endpoint, { status: 501 });
        }

        // Pass through other requests
        return originalFetch.apply(this, arguments);
    };

})();
