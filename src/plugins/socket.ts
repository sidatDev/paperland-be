import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

export default fp(async (fastify: FastifyInstance) => {
  // Server will attach to fastify.server once it is started.
  // WaitMsBeforeAsync is done after start.
  const io = new Server(fastify.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true
    }
  });

  fastify.decorate('io', io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: Token is required'));
    }

    const jwtSecret = process.env.JWT_SECRET || 'njdksandksacmvjgjdn38fdja2gs8cjn';

    try {
      const decoded = jwt.verify(token, jwtSecret) as any;

      if (decoded.role || (decoded.permissions && decoded.id)) {
        // Admin payload
        socket.data.user = decoded;
        socket.data.isAdmin = true;
        return next();
      } else if (decoded.visitorId && decoded.sessionId) {
        // Visitor socket token
        socket.data.visitorId = decoded.visitorId;
        socket.data.sessionId = decoded.sessionId;
        socket.data.isAdmin = false;
        return next();
      } else {
        return next(new Error('Authentication error: Invalid token payload structure'));
      }
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    fastify.log.info(`[Socket.IO] Connected socket ${socket.id} (isAdmin=${socket.data.isAdmin})`);

    if (socket.data.isAdmin) {
      socket.join('support-agents');
      fastify.log.info(`[Socket.IO] Socket ${socket.id} joined support-agents`);
    } else {
      const room = `session:${socket.data.sessionId}`;
      socket.join(room);
      fastify.log.info(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
    }

    socket.on('disconnect', () => {
      fastify.log.info(`[Socket.IO] Disconnected socket ${socket.id}`);
    });
  });

  fastify.addHook('onClose', async (instance) => {
    if (instance.io) {
      instance.io.close();
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}
