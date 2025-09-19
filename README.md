
# Tribe Full-Stack Real-Time Application - Developer Guide

Welcome to the upgraded Tribe application! This guide provides everything you need to set up, run, and develop this feature-rich, real-time social media platform.

---
### **1. Project Overview & Architecture**
---

This project is a complete MERN-stack (MongoDB, Express, React, Node.js) application with an integrated real-time layer using **Socket.IO**.

*   **Frontend:** A dynamic, single-page application built with React and TailwindCSS, located in the root directory. It connects to the backend via a REST API for initial data and a WebSocket connection for all subsequent real-time updates.
*   **Backend:** A robust API built with Node.js and Express, located in the `/backend` directory. It handles business logic, database interactions, authentication, and manages all real-time communication through Socket.IO.
*   **Database:** A NoSQL database powered by MongoDB, with schemas managed by Mongoose.
*   **Real-Time Layer:** Socket.IO is used for instantaneous, bi-directional communication, powering live chats, notifications, and dynamic feed updates without page reloads.

---
### **2. Backend Setup**
---

Your backend code is in the `/backend` directory. Follow these steps precisely.

**Step 1: Install Dependencies**
Navigate to the backend directory and install its dependencies.

```bash
# Navigate to the backend directory
cd backend

# Install backend dependencies
npm install
```

**Step 2: Configure Environment Variables**
This is the most important step for connecting your services.

1.  In the `/backend` directory, create a new file named `.env`.
2.  Copy the following content into your new `.env` file and fill in your details:

```env
# Server Configuration
PORT=5001

# MongoDB Database Connection String (from MongoDB Atlas)
MONGO_URI=your_mongodb_connection_string_goes_here

# JSON Web Token (JWT) Secret for Authentication
JWT_SECRET=replace_this_with_a_very_long_and_secure_random_string

# Google Gemini API Key (for the Ember AI feature)
API_KEY=your_google_gemini_api_key_goes_here
```

*   **`MONGO_URI`**: The connection string for your database. See the next section for instructions.
*   **`JWT_SECRET`**: A secret key for signing auth tokens. Make this a long, random, and unguessable string.
*   **`API_KEY`**: Your API key from Google AI Studio to power the "Ember AI" chat feature. The frontend expects this to be available as an environment variable in its execution context.

**Step 3: Start the Backend Server**
From the `/backend` directory, run:

```bash
npm run server
```

If successful, you'll see messages like `Server running on port 5001` and `MongoDB Connected`. Your API and WebSocket server are now live.

---
### **3. Setting Up a FREE Cloud Database (MongoDB Atlas)**
---

Your backend needs a database. MongoDB Atlas offers a generous free tier perfect for this project.

1.  **Create Account:** Go to `https://www.mongodb.com/cloud/atlas` and sign up.
2.  **Create a Free Cluster:** Follow the on-screen instructions to create a new "M0 Sandbox" cluster.
3.  **Create a Database User:**
    *   Go to "Database Access" -> "Add New Database User".
    *   Create a username and a **secure password**. **SAVE THIS PASSWORD!**
    *   Grant the user "Read and write to any database" privileges.
4.  **Whitelist Your IP Address:**
    *   Go to "Network Access" -> "Add IP Address".
    *   For development, click "Allow Access from Anywhere" (`0.0.0.0/0`).
5.  **Get Your Connection String:**
    *   Go to "Database", click "Connect" for your cluster, and choose "Connect your application".
    *   Copy the connection string.
6.  **Update Your `.env` File:**
    *   Paste the connection string into your `/backend/.env` file for the `MONGO_URI` variable.
    *   **Crucially, replace `<password>` with the actual database user password you created.**

**Restart your backend server (`npm run server`) after updating the `.env` file.**

---
### **4. Backend API & Socket Events**
---

The backend exposes a RESTful API for data operations and a set of Socket.IO events for real-time communication.

#### **Models:**
*   `User`: Stores user information, credentials, and social graph (followers, etc.).
*   `Post`: Stores post content, images, likes, and comments.
*   `Tribe`: Stores group information, owner, and members.
*   `TribeMessage`: Stores messages sent within a tribe's chat.
*   `Message`: Stores direct messages between two users.
*   `Notification`: Stores records of user interactions like follows, likes, and comments.

#### **API Routes:**
All routes are prefixed with `/api`. Protected routes require a valid JWT.

*   **Authentication (`/auth`)**
    *   `POST /register`: Creates a new user.
    *   `POST /login`: Authenticates a user and returns a JWT and user profile.

*   **Users (`/users`)**
    *   `GET /`: Get all users.
    *   `GET /:id`: Get a specific user's profile.
    *   `PUT /profile`: Update the logged-in user's profile.
    *   `DELETE /profile`: Delete the logged-in user's account.
    *   `PUT /:id/follow`: Follow or unfollow another user.
    *   `PUT /:id/block`: Block or unblock another user.

*   **Posts (`/posts`)**
    *   `GET /`: Get all posts for the discover feed.
    *   `GET /feed`: Get posts for the user's home feed (people they follow).
    *   `POST /`: Create a new post.
    *   `DELETE /:id`: Delete a post.
    *   `PUT /:id/like`: Like or unlike a post.
    *   `POST /:id/comments`: Add a comment to a post.
    *   `DELETE /:id/comments/:comment_id`: Delete a comment.

*   **Tribes (`/tribes`)**
    *   `GET /`: Get a list of all tribes.
    *   `POST /`: Create a new tribe.
    *   `PUT /:id`: Update a tribe's details.
    *   `DELETE /:id`: Delete a tribe (owner only).
    *   `PUT /:id/join`: Join or leave a tribe.
    *   `GET /:id/messages`: Get all messages for a tribe chat.
    *   `POST /:id/messages`: Send a message in a tribe chat.
    *   `DELETE /:id/messages/:messageId`: Delete a message in a tribe (sender only).

*   **Direct Messages (`/messages`)**
    *   `GET /conversations`: Get the list of active conversations.
    *   `GET /:userToChatId`: Get the message history with another user.
    *   `POST /send/:receiverId`: Send a direct message.

*   **Notifications (`/notifications`)**
    *   `GET /`: Get all notifications for the logged-in user.
    *   `PUT /read`: Mark all notifications as read.

#### **Socket.IO Events:**
*   **Client Emits:**
    *   `joinRoom(roomName)`: To subscribe to updates (e.g., `tribe-tribeId`, `dm-userId1-userId2`).
    *   `leaveRoom(roomName)`: To unsubscribe from updates.
    *   `typing({ roomId, ... })`: Sent when a user starts typing.
    *   `stopTyping({ roomId, ... })`: Sent when a user stops typing.

*   **Server Emits:**
    *   `getOnlineUsers(userIds)`: Broadcasts the list of online user IDs.
    *   `newMessage(messageObject)`: Sends a new direct message to the relevant room.
    *   `newTribeMessage(messageObject)`: Sends a new tribe message to the relevant tribe room.
    *   `tribeMessageDeleted({ tribeId, messageId })`: Informs clients to remove a deleted tribe message.
    *   `newPost(postObject)`: Broadcasts a newly created post.
    *   `postUpdated(postObject)`: Broadcasts an updated post (e.g., new like or comment).
    *   `postDeleted(postId)`: Informs clients to remove a deleted post.
    *   `userUpdated(userObject)`: Broadcasts updated user profiles (e.g., new follower, block status change).
    *   `tribeDeleted(tribeId)`: Informs clients to remove a deleted tribe.
    *   `newNotification(notificationObject)`: Sends a new notification directly to a user.
    *   `userTyping({ ... })` / `userStoppedTyping({ ... })`: Relays typing status to users in a room.

---
### **5. Running the Full Application Locally**
---

1.  Open two terminal windows.
2.  **Terminal 1 (Backend):**
    ```bash
    cd backend
    npm run server
    ```
3.  **Terminal 2 (Frontend):**
    *   The frontend is configured to run without a local build step. Open the `index.html` file in your browser, preferably through a local server extension like VS Code's "Live Server".

The frontend is configured to send API requests and establish a WebSocket connection to the backend server.

---
### **6. Deployment**
---

Deploying a MERN app with WebSockets involves two main parts.

**1. Backend Deployment (e.g., on Render):**
*   Platforms like Render are excellent for Node.js apps.
*   Push your code to a Git repository (GitHub).
*   Create a new "Web Service" on Render and connect it to your repository.
*   **Crucially, you must add your environment variables (`MONGO_URI`, `JWT_SECRET`, `API_KEY`) in the Render dashboard's "Environment" section.**
*   Your API will be live at a URL like `https://your-app-name.onrender.com`.

**2. Frontend Deployment (e.g., on Vercel, Netlify):**
*   Push your code to a Git repository.
*   Connect your Git repository to Vercel.
*   **Important:** In `src/api/config.ts`, you must update the `API_URL` from your local host to your live backend URL (e.g., `https://your-app-name.onrender.com`).
*   Deploy. Your application is now live!
