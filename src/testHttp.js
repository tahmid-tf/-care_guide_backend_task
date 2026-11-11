const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/aggregations', require('./routes/aggregationRoutes'));
app.use(errorHandler);

const request = (server, method, path, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              body: data ? JSON.parse(data) : null
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              body: data
            });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runHttpTests = async () => {
  console.log('--- Starting HTTP API Integration Tests ---');
  await mongoose.connect('mongodb://127.0.0.1:27017/secure_notes_db');

  const server = app.listen(0);

  try {
    // 1. User login (Alice)
    const userLogin = await request(server, 'POST', '/api/auth/login', {}, {
      email: 'alice@example.com',
      password: 'Password123!'
    });
    if (userLogin.status !== 200 || !userLogin.body.data.token) {
      throw new Error(`Alice login failed: ${JSON.stringify(userLogin.body)}`);
    }
    const userToken = userLogin.body.data.token;
    const aliceId = userLogin.body.data.user._id;
    console.log('✓ Alice login succeeded with JWT token');

    // 2. Admin login
    const adminLogin = await request(server, 'POST', '/api/auth/login', {}, {
      email: 'admin@example.com',
      password: 'Password123!'
    });
    if (adminLogin.status !== 200 || !adminLogin.body.data.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
    }
    const adminToken = adminLogin.body.data.token;
    console.log('✓ Admin login succeeded with JWT token');

    // 3. User listings notes with pagination
    const userNotesRes = await request(server, 'GET', '/api/notes?page=1&limit=2', {
      Authorization: `Bearer ${userToken}`
    });
    if (userNotesRes.status !== 200 || !userNotesRes.body.pagination) {
      throw new Error(`Listing notes failed: ${JSON.stringify(userNotesRes.body)}`);
    }
    console.log(`✓ Alice listing her notes (Paginated: page ${userNotesRes.body.pagination.page}, limit ${userNotesRes.body.pagination.limit}, total: ${userNotesRes.body.pagination.total})`);

    // 4. Admin listing notes (Admin can see everyone's notes)
    const adminNotesRes = await request(server, 'GET', '/api/notes', {
      Authorization: `Bearer ${adminToken}`
    });
    if (adminNotesRes.status !== 200 || adminNotesRes.body.data.length < 5) {
      throw new Error(`Admin listing all notes failed: ${JSON.stringify(adminNotesRes.body)}`);
    }
    console.log(`✓ Admin can view everyone's notes (Found ${adminNotesRes.body.data.length} notes across users)`);

    // 5. RBAC check: Alice cannot access /api/users (403 Forbidden)
    const forbiddenUsersRes = await request(server, 'GET', '/api/users', {
      Authorization: `Bearer ${userToken}`
    });
    if (forbiddenUsersRes.status !== 403) {
      throw new Error(`RBAC failed: regular user accessed /api/users with status ${forbiddenUsersRes.status}`);
    }
    console.log('✓ RBAC verified: Regular user is correctly forbidden (403) from accessing admin user management');

    // 6. Admin can access /api/users with pagination
    const adminUsersRes = await request(server, 'GET', '/api/users?page=1&limit=2', {
      Authorization: `Bearer ${adminToken}`
    });
    if (adminUsersRes.status !== 200 || !adminUsersRes.body.pagination) {
      throw new Error(`Admin listing users failed: ${JSON.stringify(adminUsersRes.body)}`);
    }
    console.log(`✓ Admin user management verified: paginated user list (total ${adminUsersRes.body.pagination.total} users)`);

    // 7. Aggregation Scenario 1: Group by Interests
    const agg1Res = await request(server, 'GET', '/api/aggregations/group-by-interests');
    if (agg1Res.status !== 200 || !Array.isArray(agg1Res.body.data)) {
      throw new Error(`Aggregation Scenario 1 failed: ${JSON.stringify(agg1Res.body)}`);
    }
    console.log(`✓ Aggregation Scenario 1 (Group by Interests) verified: returned ${agg1Res.body.count} interest categories`);

    // 8. Aggregation Scenario 2: User Posts via $lookup
    const agg2Res = await request(server, 'GET', `/api/aggregations/user-posts/${aliceId}`);
    if (agg2Res.status !== 200 || !agg2Res.body.data.posts) {
      throw new Error(`Aggregation Scenario 2 ($lookup) failed: ${JSON.stringify(agg2Res.body)}`);
    }
    console.log(`✓ Aggregation Scenario 2 (User Posts via $lookup) verified: Alice has ${agg2Res.body.data.posts.length} posts retrieved via single pipeline`);

    console.log('--- All HTTP API Integration Tests Passed Flawlessly! ---');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
};

runHttpTests().catch(err => {
  console.error('HTTP test failed:', err);
  process.exit(1);
});
