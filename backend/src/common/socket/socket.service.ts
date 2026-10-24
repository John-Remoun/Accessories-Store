import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

export interface StockUpdateItem {
  productId: string;
  productName: string;
  newQuantity: number;
  isOutOfStock: boolean;
}

export interface StockUpdatePayload {
  branchId: string;
  invoiceNumber?: string;
  items: StockUpdateItem[];
  timestamp: string;
}

import { verifyAccessToken } from '../utils/jwt.utils';

export function initSocketServer(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket: Socket, next) => {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    const token = typeof rawToken === 'string' && rawToken.startsWith('Bearer ')
      ? rawToken.slice(7).trim()
      : (typeof rawToken === 'string' ? rawToken.trim() : undefined);

    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        socket.data.user = decoded;
      } catch (e) {
        // Continue connection; unauthenticated or expired token will be handled gracefully
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

    const user = socket.data.user;
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      socket.join('admin');
      console.log(`📍 [Socket.io] Admin ${socket.id} auto-joined 'admin' room`);
    } else if (user && user.branchId) {
      socket.join(`branch:${user.branchId}`);
      console.log(`📍 [Socket.io] Staff ${socket.id} auto-joined assigned branch room: branch:${user.branchId}`);
    }

    socket.on('join:branch', (data: { branchId?: string; token?: string } | string) => {
      const requestedBranch = typeof data === 'string' ? data : data?.branchId;
      const explicitToken = typeof data === 'object' ? data?.token : undefined;

      let authUser = socket.data.user;
      if (!authUser && explicitToken) {
        try {
          authUser = verifyAccessToken(explicitToken);
          socket.data.user = authUser;
        } catch (e) {}
      }

      if (authUser) {
        if (authUser.role === 'admin' || authUser.role === 'super_admin') {
          socket.join('admin');
          if (requestedBranch) {
            socket.join(`branch:${requestedBranch}`);
            console.log(`📍 [Socket.io] Admin ${socket.id} joined branch room: branch:${requestedBranch}`);
          }
          return;
        }

        // Employee is strictly restricted to their own assigned branch room
        if (authUser.branchId) {
          socket.join(`branch:${authUser.branchId}`);
          console.log(`📍 [Socket.io] Employee ${socket.id} strictly restricted to branch:${authUser.branchId}`);
          return;
        }
      }

      // Strictly reject unauthenticated clients from joining branch rooms
      console.warn(`⚠️ [Socket.io] Unauthenticated client ${socket.id} attempted to join branch room: ${requestedBranch}. Ignored.`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

import { bumpSyncVersion } from '../sync/sync-version';

export function broadcastStockUpdate(payload: Omit<StockUpdatePayload, 'timestamp'>): void {
  bumpSyncVersion();
  if (!io) {
    console.warn('⚠️ [Socket.io] Server not initialized, skipping broadcast.');
    return;
  }

  const fullPayload: StockUpdatePayload = {
    ...payload,
    timestamp: new Date().toISOString(),
  };

  console.log(`📡 [Socket.io] Broadcasting stock deduction:`, JSON.stringify(fullPayload));

  if (fullPayload.branchId) {
    io.to(`branch:${fullPayload.branchId}`).to('admin').emit('inventory:stock-updated', fullPayload);
  } else {
    io.emit('inventory:stock-updated', fullPayload);
  }
}

function extractLightweightInvoice(invoice: any): any {
  if (!invoice) return invoice;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    branchId: invoice.branchId,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    total: Number(invoice.total || 0),
    paidAmount: Number(invoice.paidAmount || 0),
    remainingAmount: Number(invoice.remainingAmount || 0),
    paymentStatus: invoice.paymentStatus,
    paymentMethod: invoice.paymentMethod,
    date: invoice.date || invoice.createdAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    isFavorite: invoice.isFavorite,
    notes: invoice.notes,
  };
}

export function broadcastInvoiceCreated(invoice: any): void {
  bumpSyncVersion();
  if (!io) return;
  const mini = extractLightweightInvoice(invoice);
  console.log(`📡 [Socket.io] Broadcasting invoice created: #${mini?.invoiceNumber}`);
  if (mini?.branchId) {
    io.to(`branch:${mini.branchId}`).to('admin').emit('invoice:created', mini);
  } else {
    io.emit('invoice:created', mini);
  }
}

export function broadcastInvoicesDeleted(ids: string[], branchId?: string): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting invoices deleted for branch ${branchId || 'all'}:`, ids);
  if (branchId) {
    io.to(`branch:${branchId}`).to('admin').emit('invoices:deleted', { ids, branchId, timestamp: new Date().toISOString() });
  } else {
    io.to('admin').emit('invoices:deleted', { ids, timestamp: new Date().toISOString() });
  }
}

export function broadcastInvoiceUpdated(invoice: any): void {
  bumpSyncVersion();
  if (!io) return;
  const mini = extractLightweightInvoice(invoice);
  console.log(`📡 [Socket.io] Broadcasting invoice updated: #${mini?.invoiceNumber}`);
  if (mini?.branchId) {
    io.to(`branch:${mini.branchId}`).to('admin').emit('invoice:updated', mini);
  } else {
    io.to('admin').emit('invoice:updated', mini);
  }
}

export function broadcastExpenseCreated(expense: any): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting expense created: ${expense?.id}`);
  if (expense?.branchId) {
    io.to(`branch:${expense.branchId}`).to('admin').emit('expense:created', expense);
  } else {
    io.to('admin').emit('expense:created', expense);
  }
}

export function broadcastExpenseDeleted(id: string, branchId?: string): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting expense deleted: ${id}`);
  if (branchId) {
    io.to(`branch:${branchId}`).to('admin').emit('expense:deleted', { id, branchId, timestamp: new Date().toISOString() });
  } else {
    io.to('admin').emit('expense:deleted', { id, timestamp: new Date().toISOString() });
  }
}

export function broadcastProductCreated(product: any, branchData?: any[]): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting product created: ${product?.nameAr || product?.id}`);
  // Strip cost from branch data in broadcast
  const safeBranchData = Array.isArray(branchData)
    ? branchData.map((b: any) => {
        const { cost, ...rest } = b;
        return rest;
      })
    : branchData;
  const targetBranch = product?.branchId || safeBranchData?.[0]?.branchId;
  if (targetBranch) {
    io.to(`branch:${targetBranch}`).to('admin').emit('product:created', { product, branchData: safeBranchData, timestamp: new Date().toISOString() });
  } else {
    io.to('admin').emit('product:created', { product, branchData: safeBranchData, timestamp: new Date().toISOString() });
  }
}

export function broadcastProductUpdated(product: any): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting product updated: ${product?.nameAr || product?.id}`);
  if (product?.branchId) {
    io.to(`branch:${product.branchId}`).to('admin').emit('product:updated', product);
  } else {
    io.to('admin').emit('product:updated', product);
  }
}

export function broadcastProductDeleted(id: string, branchId?: string): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting product deleted: ${id}`);
  if (branchId) {
    io.to(`branch:${branchId}`).to('admin').emit('product:deleted', { id, branchId, timestamp: new Date().toISOString() });
  } else {
    io.to('admin').emit('product:deleted', { id, timestamp: new Date().toISOString() });
  }
}



