const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Note = require('./models/Note');
const Post = require('./models/Post');

dotenv.config();

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('Synchronizing explicit schema indexes with MongoDB...');
    await Promise.all([
      User.syncIndexes(),
      Note.syncIndexes(),
      Post.syncIndexes()
    ]);
    console.log('Indexes synchronized successfully.');

    // Clear existing data for fresh seed
    await Promise.all([
      User.deleteMany({}),
      Note.deleteMany({}),
      Post.deleteMany({})
    ]);
    console.log('Existing collections cleared.');

    // Create Users with distinct interests
    const admin = await User.create({
      username: 'admin_user',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin',
      interests: ['cybersecurity', 'architecture', 'chess']
    });

    const alice = await User.create({
      username: 'alice_w',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'user',
      interests: ['chess', 'reading', 'travel']
    });

    const bob = await User.create({
      username: 'bob_m',
      email: 'bob@example.com',
      password: 'Password123!',
      role: 'user',
      interests: ['reading', 'coding', 'music']
    });

    const charlie = await User.create({
      username: 'charlie_k',
      email: 'charlie@example.com',
      password: 'Password123!',
      role: 'user',
      interests: ['chess', 'coding', 'gaming']
    });

    console.log('Users created:');
    console.log(' - Admin: admin@example.com / Password123!');
    console.log(' - Alice: alice@example.com / Password123!');
    console.log(' - Bob: bob@example.com / Password123!');
    console.log(' - Charlie: charlie@example.com / Password123!');

    // Create Sample Notes
    await Note.create([
      {
        title: 'Alice Private Note 1',
        content: 'This is Alice\'s confidential note about ongoing projects.',
        owner: alice._id
      },
      {
        title: 'Alice Book Recommendations',
        content: 'Clean Code, Designing Data-Intensive Applications, The Pragmatic Programmer.',
        owner: alice._id
      },
      {
        title: 'Bob Secret Note',
        content: 'Bob\'s private research notes on MongoDB indexing strategies.',
        owner: bob._id
      },
      {
        title: 'Bob Weekly Tasks',
        content: 'Review pull requests, optimize aggregation pipelines, run benchmarks.',
        owner: bob._id
      },
      {
        title: 'Admin Master Checklist',
        content: 'Audit user roles, review server performance logs, monitor rate limits.',
        owner: admin._id
      }
    ]);
    console.log('Sample notes created.');

    // Create Sample Posts (Visible to everyone in separate collection)
    await Post.create([
      {
        title: 'Why MongoDB Indexes Matter',
        content: 'Indexes significantly reduce key scans and allow B-Tree lookups without in-memory sorting.',
        author: alice._id
      },
      {
        title: 'Mastering the Aggregation Pipeline',
        content: 'Pipelines process documents through multistage transformations like $match, $lookup, and $group.',
        author: alice._id
      },
      {
        title: 'Understanding $lookup in MongoDB',
        content: 'The $lookup stage performs a left outer join to an unsharded collection in the same database.',
        author: bob._id
      },
      {
        title: 'Security Best Practices for REST APIs',
        content: 'Always salt & hash passwords using bcrypt and enforce role-based access control at the route level.',
        author: admin._id
      }
    ]);
    console.log('Sample posts created.');

    console.log('====================================================');
    console.log('Database successfully seeded!');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
