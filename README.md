# Secure Note-Taking & Social Aggregation Backend API

A high-performance, secure RESTful API built with **Node.js**, **Express**, and **MongoDB / Mongoose**. Designed with strict data isolation, JWT authentication, Role-Based Access Control (RBAC), fine-grained MongoDB indexing, and advanced aggregation pipelines.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [System Architecture & Data Models](#system-architecture--data-models)
- [Database Indexing Strategy (ESR Rule)](#database-indexing-strategy-esr-rule)
- [Advanced Aggregation Pipelines](#advanced-aggregation-pipelines)
  - [Scenario 1: Group Users by Interests](#scenario-1-group-users-by-interests)
  - [Scenario 2: User Posts Retrieval with `$lookup`](#scenario-2-user-posts-retrieval-with-lookup)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Database Seeding](#database-seeding)
  - [Running the Server](#running-the-server)
- [Demo Credentials](#demo-credentials)
- [API Reference](#api-reference)
  - [Health Check](#health-check)
  - [Authentication Routes](#authentication-routes)
  - [Note Management Routes](#note-management-routes)
  - [Post Management Routes](#post-management-routes)
  - [User Management Routes (Admin)](#user-management-routes-admin)
  - [Aggregation Routes](#aggregation-routes)
- [Automated Testing & Verification](#automated-testing--verification)
- [Security Features](#security-features)

---

## 🚀 Overview

This backend application powers a multi-user, role-aware system supporting private notes, public posts, and administrative management. The architecture emphasizes:
1. **Strict Data Isolation**: Regular users can only access and modify their own notes; cross-tenant access is explicitly blocked.
2. **Role-Based Access Control (RBAC)**: Distinct permissions for `user` and `admin` roles across routes and resources.
3. **Database Performance**: Explicit, non-redundant compound and multikey B-Tree indexes designed to satisfy the Equality-Sort-Range (ESR) rule, avoiding costly in-memory sorts (`COLLSCAN`).
4. **Optimized Aggregation**: Single-pipeline queries for complex data transformations and cross-collection joins (`$lookup`).

---

## ✨ Key Features

- **JWT Authentication & Passwords**: Secure authentication workflow with JSON Web Tokens (Bearer token) and `bcryptjs` password hashing (salt rounds: 10).
- **Role-Based Permissions**: Granular middleware verifying token signatures and validating role capabilities (`user` vs `admin`).
- **Owner-Scoped Note CRUD**: Full Create, Read, Update, and Delete operations on private notes, strictly scoped to the creator.
- **Admin Privilege Escalation**: Administrators can view, filter, and manage notes across all users, as well as manage user accounts.
- **Cascading Deletion**: Removing a user automatically purges their associated notes and posts to maintain database integrity.
- **Public Feed & Social Posts**: Users can author public posts, and visitors can browse paginated posts sorted chronologically.
- **Standardized API Responses**: Predictable JSON response envelopes with HTTP status codes, status flags, descriptive messages, and pagination metadata.
- **Centralized Error Handling**: Robust error handling middleware capturing MongoDB duplicate keys (code 11000), validation errors, and malformed ObjectIds.

---

## 🛠️ Tech Stack

- **Runtime Environment:** [Node.js](https://nodejs.org/) (v18+)
- **Web Framework:** [Express.js](https://expressjs.com/) (v4.21+)
- **Database & ODM:** [MongoDB](https://www.mongodb.com/) & [Mongoose](https://mongoosejs.com/) (v8.9+)
- **Authentication:** [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **CORS & Environment:** [cors](https://github.com/expressjs/cors), [dotenv](https://github.com/motdotla/dotenv)

---

## 🏗️ System Architecture & Data Models

### 1. `User` Schema
Represents system users with authentication credentials, RBAC role, and array of interest tags.
- `username`: String (required, min 3 chars, trimmed)
- `email`: String (required, unique, lowercased, validated)
- `password`: String (required, min 6 chars, hashed via pre-save hook, omitted from query outputs)
- `role`: String (enum: `['user', 'admin']`, default: `'user'`)
- `interests`: Array of Strings (default: `[]`)
- `timestamps`: `createdAt`, `updatedAt`

### 2. `Note` Schema
Represents private, ownership-protected notes.
- `title`: String (required, max 150 chars, trimmed)
- `content`: String (required, trimmed)
- `owner`: ObjectId referencing `User` (required)
- `timestamps`: `createdAt`, `updatedAt`

### 3. `Post` Schema
Represents public community articles.
- `title`: String (required, max 200 chars, trimmed)
- `content`: String (required, trimmed)
- `author`: ObjectId referencing `User` (required)
- `timestamps`: `createdAt`, `updatedAt`

---

## ⚡ Database Indexing Strategy (ESR Rule)

Every index is intentionally placed to optimize specific query paths while avoiding redundancy. MongoDB's default `_id` index is leveraged for primary key queries.

| Collection | Index Definition | Index Type | Query / Operation Optimized | Justification |
|---|---|---|---|---|
| **Users** | `{ email: 1 }` | Unique B-Tree | `POST /api/auth/login`<br>`POST /api/auth/register` | Guarantees email uniqueness at database level and enables $O(1)$ user lookup during login. |
| **Users** | `{ createdAt: -1 }` | B-Tree (Sort) | `GET /api/users` (Admin) | Allows streaming paginated results in chronological order without in-memory sort buffer. |
| **Users** | `{ interests: 1 }` | Multikey Index | `GET /api/aggregations/group-by-interests` | Optimizes `$unwind` and grouping operations across the interests array. |
| **Notes** | `{ owner: 1, createdAt: -1 }` | Compound B-Tree | `GET /api/notes` (User) | Follows the **ESR Rule** (Equality on `owner`, Sort on `createdAt`). Eliminates sort phase (`SORT_KEY_GENERATOR`). |
| **Notes** | `{ createdAt: -1 }` | B-Tree (Sort) | `GET /api/notes` (Admin all) | Powers admin dashboard view scanning notes across all users sorted chronologically. |
| **Posts** | `{ author: 1, createdAt: -1 }` | Compound B-Tree | `GET /api/aggregations/user-posts/:userId` | Optimizes `$lookup` pipeline join filtering by `author` and sorting results chronologically. |
| **Posts** | `{ createdAt: -1 }` | B-Tree (Sort) | `GET /api/posts` (Public Feed) | Enables fast, index-covered pagination for the public posts feed. |

> **Note on `_id`:** Operations like `Note.findById`, `Note.findOne({ _id, owner })`, and `User.findById` automatically use MongoDB's default primary key index on `_id`. No duplicate indexes are defined.

---

## 🔍 Advanced Aggregation Pipelines

### Scenario 1: Group Users by Interests
- **Endpoint:** `GET /api/aggregations/group-by-interests`
- **Constraint:** Executed using **exactly one** `User.aggregate()` call.
- **Pipeline Implementation:**
  ```javascript
  User.aggregate([
    // Stage 1: Deconstruct interests array
    { $unwind: '$interests' },

    // Stage 2: Group users by distinct interest
    {
      $group: {
        _id: '$interests',
        userCount: { $sum: 1 },
        users: {
          $push: {
            _id: '$_id',
            username: '$username',
            email: '$email',
            role: '$role'
          }
        }
      }
    },

    // Stage 3: Shape output
    {
      $project: {
        _id: 0,
        interest: '$_id',
        userCount: 1,
        users: 1
      }
    },

    // Stage 4: Order alphabetically
    { $sort: { interest: 1 } }
  ]);
  ```

---

### Scenario 2: User Posts Retrieval with `$lookup`
- **Endpoint:** `GET /api/aggregations/user-posts/:userId`
- **Constraint:** Executed using a **single aggregation pipeline** containing a `$lookup` stage joining the `posts` collection.
- **Pipeline Implementation:**
  ```javascript
  User.aggregate([
    // Stage 1: Match target user by ID
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId)
      }
    },

    // Stage 2: Join posts authored by this user
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        pipeline: [
          { $sort: { createdAt: -1 } }
        ],
        as: 'posts'
      }
    },

    // Stage 3: Remove sensitive user data
    {
      $project: {
        password: 0
      }
    }
  ]);
  ```

---

## 📁 Project Structure

```text
backend/
├── .env.example                  # Environment configuration template
├── package.json                  # NPM dependencies and scripts
├── src/
│   ├── config/
│   │   └── db.js                 # MongoDB connection handler
│   ├── controllers/
│   │   ├── authController.js     # User registration, login, and current profile
│   │   ├── noteController.js     # Note CRUD with ownership & role validation
│   │   ├── postController.js     # Public feed and post creation
│   │   └── userController.js     # Admin user management & aggregation handlers
│   ├── middleware/
│   │   ├── auth.js               # JWT bearer verification middleware
│   │   ├── errorHandler.js       # Centralized error formatting middleware
│   │   └── role.js               # RBAC authorization guard middleware
│   ├── models/
│   │   ├── Note.js               # Note model & index definitions
│   │   ├── Post.js               # Post model & index definitions
│   │   └── User.js               # User model, pre-save hooks & index definitions
│   ├── routes/
│   │   ├── aggregationRoutes.js  # Aggregation pipeline endpoints
│   │   ├── authRoutes.js         # Authentication endpoints
│   │   ├── noteRoutes.js         # Note management endpoints
│   │   ├── postRoutes.js         # Post management endpoints
│   │   └── userRoutes.js         # Admin user management endpoints
│   ├── seed.js                   # Database initialization and sample data seeder
│   ├── server.js                 # Express application bootstrap & route mounting
│   ├── testHttp.js               # Automated end-to-end HTTP route tests
│   └── testIntegration.js        # Automated integration tests for database logic
└── README.md                     # Documentation
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```ini
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/secure_notes_db
JWT_SECRET=super_secret_interview_jwt_key_2026_note_app
JWT_EXPIRES_IN=7d
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port number the Express application listens on | `5000` |
| `MONGODB_URI` | MongoDB connection URI string | `mongodb://127.0.0.1:27017/secure_notes_db` |
| `JWT_SECRET` | Secret key used to sign and verify JWT tokens | *(Secret string)* |
| `JWT_EXPIRES_IN` | Token expiration duration | `7d` |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally or a MongoDB Atlas URI

### Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   git clone https://github.com/tahmid-tf/-care_guide_backend_task.git
   cd -care_guide_backend_task
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

### Database Seeding

Populate the database with initial users, notes, public posts, and synchronize all explicit indexes:

```bash
npm run seed
```

### Running the Server

- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```

- **Production mode:**
  ```bash
  npm start
  ```

The server will be available at `http://localhost:5000`.

---

## 👥 Demo Credentials

The database seeder initializes the following accounts:

| Role | Username | Email | Password | Sample Interests |
|---|---|---|---|---|
| **Admin** | `admin_user` | `admin@example.com` | `Password123!` | `cybersecurity`, `architecture`, `chess` |
| **User** | `alice_w` | `alice@example.com` | `Password123!` | `chess`, `reading`, `travel` |
| **User** | `bob_m` | `bob@example.com` | `Password123!` | `reading`, `coding`, `music` |
| **User** | `charlie_k` | `charlie@example.com` | `Password123!` | `chess`, `coding`, `gaming` |

---

## 📡 API Reference

### Health Check

#### `GET /api/health`
Check if the service is up and running.
- **Access:** Public
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Secure Note-Taking API is operational.",
    "timestamp": "2026-11-12T02:00:00.000Z"
  }
  ```

---

### Authentication Routes

#### `POST /api/auth/register`
Register a new user account.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "Password123!",
    "role": "user",
    "interests": ["coding", "ai"]
  }
  ```
- **Response:** `201 Created` with JWT `token` and `user` payload.

#### `POST /api/auth/login`
Authenticate an existing user and obtain a JWT token.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "alice@example.com",
    "password": "Password123!"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Authentication successful.",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "user": {
        "_id": "673270...",
        "username": "alice_w",
        "email": "alice@example.com",
        "role": "user",
        "interests": ["chess", "reading", "travel"]
      }
    }
  }
  ```

#### `GET /api/auth/me`
Retrieve authenticated user's profile details.
- **Access:** Private (`Bearer <token>`)
- **Response:** `200 OK` with user details.

---

### Note Management Routes

All note endpoints require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/notes` | Private | Create a note (authenticated user becomes `owner`). |
| `GET` | `/api/notes?page=1&limit=10` | Private | List notes. Regular users see only their own notes. Admins can see all notes or filter by `?owner=<userId>` or `?scope=mine`. |
| `GET` | `/api/notes/:id` | Private | Get single note by ID. Non-admins receive `403 Forbidden` if not the owner. |
| `PUT` | `/api/notes/:id` | Private | Update note title/content. Non-admins cannot edit notes they do not own. |
| `DELETE` | `/api/notes/:id` | Private | Delete a note. Non-admins cannot delete notes they do not own. |

---

### Post Management Routes

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/posts?page=1&limit=10` | Public | Paginated feed of all public community posts, sorted chronologically. |
| `POST` | `/api/posts` | Private | Create a public post attributed to the authenticated user. |

---

### User Management Routes (Admin)

Requires `Authorization: Bearer <token>` with `role: "admin"`.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/users?page=1&limit=10` | Admin | List all registered users with pagination. |
| `POST` | `/api/users` | Admin | Create a new user account with specific role and interests. |
| `GET` | `/api/users/:id` | Admin | Retrieve a user profile by ID. |
| `PUT` | `/api/users/:id` | Admin | Update user attributes (`username`, `email`, `role`, `interests`, `password`). |
| `DELETE` | `/api/users/:id` | Admin | Delete a user along with cascading deletion of their notes and posts. |

---

### Aggregation Routes

#### `GET /api/aggregations/group-by-interests`
Groups all registered users by each individual interest tag using a single `$unwind` and `$group` aggregation pipeline.
- **Access:** Public / Authenticated
- **Sample Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Users grouped by interests retrieved successfully via single aggregation pipeline.",
    "count": 6,
    "data": [
      {
        "interest": "chess",
        "userCount": 3,
        "users": [
          { "_id": "...", "username": "admin_user", "email": "admin@example.com", "role": "admin" },
          { "_id": "...", "username": "alice_w", "email": "alice@example.com", "role": "user" },
          { "_id": "...", "username": "charlie_k", "email": "charlie@example.com", "role": "user" }
        ]
      },
      {
        "interest": "coding",
        "userCount": 2,
        "users": [
          { "_id": "...", "username": "bob_m", "email": "bob@example.com", "role": "user" },
          { "_id": "...", "username": "charlie_k", "email": "charlie@example.com", "role": "user" }
        ]
      }
    ]
  }
  ```

#### `GET /api/aggregations/user-posts/:userId`
Retrieves a specific user profile together with an array of all posts authored by that user, joined using a single aggregation pipeline with a `$lookup` stage.
- **Access:** Public / Authenticated
- **Sample Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "User posts retrieved successfully via $lookup aggregation pipeline.",
    "data": {
      "_id": "673270...",
      "username": "alice_w",
      "email": "alice@example.com",
      "role": "user",
      "interests": ["chess", "reading", "travel"],
      "createdAt": "2026-11-12T02:00:00.000Z",
      "updatedAt": "2026-11-12T02:00:00.000Z",
      "posts": [
        {
          "_id": "673271...",
          "title": "Mastering the Aggregation Pipeline",
          "content": "Pipelines process documents through multistage transformations...",
          "author": "673270...",
          "createdAt": "2026-11-12T02:05:00.000Z"
        },
        {
          "_id": "673272...",
          "title": "Why MongoDB Indexes Matter",
          "content": "Indexes significantly reduce key scans...",
          "author": "673270...",
          "createdAt": "2026-11-12T02:02:00.000Z"
        }
      ]
    }
  }
  ```

---

## 🧪 Automated Testing & Verification

The project includes built-in test suites to verify database constraints, authorization guards, and aggregation correctness:

### 1. Integration Tests
Verifies database models, password hashing, note ownership constraints, and aggregation results:
```bash
node src/testIntegration.js
```

### 2. HTTP End-to-End Tests
Starts an in-memory HTTP server instance, runs comprehensive requests across all endpoints (registration, login, RBAC restrictions, note isolation, cross-user denial checks, and aggregation endpoints):
```bash
node src/testHttp.js
```

---

## 🔒 Security Features

- **Password Hashing:** Passwords are never stored in plain text. Salt generation and hashing are handled transparently using `bcryptjs`.
- **Query Projection Sanitization:** User schema defines `password: { select: false }` and `toJSON()` method purges password hashes before sending responses.
- **Cross-Tenant Prevention:** Note modification and retrieval controllers strictly verify document ownership against the authenticated JWT subject.
- **Type & Input Validation:** ObjectId validation with Mongoose handles bad ID formats gracefully with HTTP `400 Bad Request` instead of unhandled exceptions.
- **CORS Protection:** Configured via Express middleware to control cross-origin resource requests.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
