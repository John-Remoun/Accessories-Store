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

export function broadcastStockUpdate(payload: Omit<StockUpdatePayload, 'timestamp'>): void {
  if (!io) {
    console.warn('⚠️ [Socket.io] Server not initialized, skipping broadcast.');
    return;
  }

  const fullPayload: StockUpdatePayload = {
    ...payload,
    timestamp: new Date().toISOString(),
  };

  console.log(`📡 [Socket.io] Broadcasting stock deduction:`, JSON.stringify(fullPayload));

  // Broadcast to all connected clients and specifically to branch room
  io.emit('inventory:stock-updated', fullPayload);
  if (fullPayload.branchId) {
    io.to(`branch:${fullPayload.branchId}`).emit('inventory:stock-updated', fullPayload);
  }
}

export function broadcastInvoiceCreated(invoice: any): void {
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting invoice created: #${invoice?.invoiceNumber}`);
  io.emit('invoice:created', invoice);
  if (invoice?.branchId) {
    io.to(`branch:${invoice.branchId}`).emit('invoice:created', invoice);
  }
}

export function broadcastInvoicesDeleted(ids: string[]): void {
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting invoices deleted:`, ids);
  io.emit('invoices:deleted', { ids, timestamp: new Date().toISOString() });
}

export function broadcastInvoiceUpdated(invoice: any): void {
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting invoice updated: #${invoice?.invoiceNumber}`);
  io.emit('invoice:updated', invoice);
  if (invoice?.branchId) {
    io.to(`branch:${invoice.branchId}`).emit('invoice:updated', invoice);
  }
}

export function broadcastExpenseCreated(expense: any): void {
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting expense created: ${expense?.id}`);
  io.emit('expense:created', expense);
  if (expense?.branchId) {
    io.to(`branch:${expense.branchId}`).emit('expense:created', expense);
  }
}

export function broadcastExpenseDeleted(id: string, branchId?: string): void {
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting expense deleted: ${id}`);
  io.emit('expense:deleted', { id, branchId, timestamp: new Date().toISOString() });
  if (branchId) {
    io.to(`branch:${branchId}`).emit('expense:deleted', { id, branchId, timestamp: new Date().toISOString() });
  }
}

export function broadcastProductCreated(product: any, branchData?: any[]): void {
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting product created: ${product?.nameAr || product?.id}`);
  io.emit('product:created', { product, branchData, timestamp: new Date().toISOString() });
}

export function broadcastProductUpdated(product: any): void {
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting product updated: ${product?.nameAr || product?.id}`);
  io.emit('product:updated', product);
}

export function broadcastProductDeleted(id: string): void {
  if (!io) return;
  console.log(`📡 [Socket.io] Broadcasting product deleted: ${id}`);
  io.emit('product:deleted', { id, timestamp: new Date().toISOString() });
}



