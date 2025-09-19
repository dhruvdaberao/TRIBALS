
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import postRoutes from './routes/postRoutes.js';
import userRoutes from './routes/userRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import tribeRoutes from './routes/tribeRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import aiRoutes from './routes/aiRoutes.js'; // Import the new AI routes
import { initializeSocket } from './socketManager.js';

dotenv.config();

const startServer = async () => {
  try {
    await connectDB();

    const app = express();
    const httpServer = createServer(app);

    const allowedOrigins = [
      'https://tribals.vercel.app', // Production Frontend
      'http://localhost:5173',      // Local Vite Frontend
      'http://localhost:3000'       // Local CRA Frontend
    ];

    const corsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    };

    const io = new Server(httpServer, {
      pingTimeout: 60000,
      cors: corsOptions,
    });

    app.set('io', io);
    const onlineUsers = initializeSocket(io);

    app.use(cors(corsOptions));
    app.use(express.json({ limit: '50mb' }));

    app.use((req, res, next) => {
      req.io = io;
      req.onlineUsers = onlineUsers;
      next();
    });

    app.use('/api/auth', authRoutes);
    app.use('/api/posts', postRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/tribes', tribeRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/ai', aiRoutes); // Register the new AI routes

    app.get('/', (req, res) => {
      res.send('Tribe API is running...');
    });

    const PORT = process.env.PORT || 5001;
    httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();