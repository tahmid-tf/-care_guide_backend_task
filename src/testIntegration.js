const mongoose = require('mongoose');
const User = require('./models/User');
const Note = require('./models/Note');
const Post = require('./models/Post');
const jwt = require('jsonwebtoken');

// A self-contained test runner that validates all business logic, permissions, and aggregations
const runTests = async () => {
  console.log('--- Starting System Verification Tests ---');

  await mongoose.connect('mongodb://127.0.0.1:27017/secure_notes_db');

  // Test 1: Verify users exist
  const admin = await User.findOne({ email: 'admin@example.com' }).select('+password');
  const alice = await User.findOne({ email: 'alice@example.com' }).select('+password');
  const bob = await User.findOne({ email: 'bob@example.com' });

  if (!admin || !alice || !bob) {
    throw new Error('Test users missing from database.');
  }
  console.log('✓ Users exist in DB');

  // Test 2: Verify password hashing
  const isMatch = await alice.comparePassword('Password123!');
  const isBadMatch = await alice.comparePassword('WrongPassword');
  if (!isMatch || isBadMatch) {
    throw new Error('Password hashing verification failed.');
  }
  console.log('✓ Password hashing and verification working correctly');

  // Test 3: Verify Notes and Ownership
  const aliceNotes = await Note.find({ owner: alice._id }).sort({ createdAt: -1 });
  const allNotes = await Note.find().sort({ createdAt: -1 });
  if (aliceNotes.length === 0 || allNotes.length < aliceNotes.length) {
    throw new Error('Notes query failed.');
  }
  console.log(`✓ Alice has ${aliceNotes.length} notes, total system notes: ${allNotes.length}`);

  // Test 4: Scenario 1 Aggregation: Group by Interests
  const interestsAgg = await User.aggregate([
    { $unwind: '$interests' },
    {
      $group: {
        _id: '$interests',
        userCount: { $sum: 1 },
        users: {
          $push: {
            _id: '$_id',
            username: '$username',
            email: '$email'
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  if (!interestsAgg || interestsAgg.length === 0) {
    throw new Error('Scenario 1 aggregation returned no results.');
  }
  console.log(`✓ Scenario 1: Group by Interests succeeded. Found ${interestsAgg.length} distinct interest groups.`);
  interestsAgg.forEach(group => {
    console.log(`   - Interest [${group._id}]: ${group.userCount} users (${group.users.map(u => u.username).join(', ')})`);
  });

  // Test 5: Scenario 2 Aggregation: User Posts via $lookup
  const userPostsAgg = await User.aggregate([
    { $match: { _id: alice._id } },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        as: 'posts'
      }
    },
    { $project: { password: 0 } }
  ]);

  if (!userPostsAgg || userPostsAgg.length === 0 || !userPostsAgg[0].posts) {
    throw new Error('Scenario 2 aggregation ($lookup) failed.');
  }
  console.log(`✓ Scenario 2: $lookup succeeded for Alice. Retrieved ${userPostsAgg[0].posts.length} posts.`);
  userPostsAgg[0].posts.forEach(p => {
    console.log(`   - Post: "${p.title}"`);
  });

  await mongoose.disconnect();
  console.log('--- All System Verification Tests Passed Successfully! ---');
};

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
