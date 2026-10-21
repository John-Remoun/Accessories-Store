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

export function initSocketServer(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

    socket.on('join:branch', (branchId: string) => {
      if (branchId) {
        socket.join(`branch:${branchId}`);
        console.log(`📍 [Socket.io] Client ${socket.id} joined branch room: branch:${branchId}`);
      }
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
    io.to(`branch:${fullPayload.branchId}`).emit('inventory:stock-updated', fullPayload);
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
    io.to(`branch:${mini.branchId}`).emit('invoice:created', mini);
  } else {
    io.emit('invoice:created', mini);
  }
}

export function broadcastInvoicesDeleted(ids: string[]): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting invoices deleted:`, ids);
  io.emit('invoices:deleted', { ids, timestamp: new Date().toISOString() });
}

export function broadcastInvoiceUpdated(invoice: any): void {
  bumpSyncVersion();
  if (!io) return;
  const mini = extractLightweightInvoice(invoice);
  console.log(`📡 [Socket.io] Broadcasting invoice updated: #${mini?.invoiceNumber}`);
  if (mini?.branchId) {
    io.to(`branch:${mini.branchId}`).emit('invoice:updated', mini);
  } else {
    io.emit('invoice:updated', mini);
  }
}

export function broadcastExpenseCreated(expense: any): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting expense created: ${expense?.id}`);
  if (expense?.branchId) {
    io.to(`branch:${expense.branchId}`).emit('expense:created', expense);
  } else {
    io.emit('expense:created', expense);
  }
}

export function broadcastExpenseDeleted(id: string, branchId?: string): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting expense deleted: ${id}`);
  if (branchId) {
    io.to(`branch:${branchId}`).emit('expense:deleted', { id, branchId, timestamp: new Date().toISOString() });
  } else {
    io.emit('expense:deleted', { id, timestamp: new Date().toISOString() });
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
  io.emit('product:created', { product, branchData: safeBranchData, timestamp: new Date().toISOString() });
}

export function broadcastProductUpdated(product: any): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting product updated: ${product?.nameAr || product?.id}`);
  io.emit('product:updated', product);
}

export function broadcastProductDeleted(id: string): void {
  bumpSyncVersion();
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting product deleted: ${id}`);
  io.emit('product:deleted', { id, timestamp: new Date().toISOString() });
}



