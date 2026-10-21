import { io, Socket } from 'socket.io-client';
import { store } from './store';

let socket: Socket | null = null;

export interface RealtimeStockItem {
  productId: string;
  productName: string;
  newQuantity: number;
  isOutOfStock: boolean;
}

export interface RealtimeStockPayload {
  branchId: string;
  invoiceNumber?: string;
  items: RealtimeStockItem[];
  timestamp: string;
}

export function initSocketClient(): Socket {
  if (socket) return socket;

  // Determine socket server URL
  const serverUrl = import.meta.env.VITE_API_URL 
    ? (import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, ''))
    : window.location.origin;

  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1500,
  });

  socket.on('connect', () => {
    console.log('⚡ [Socket.io Client] Connected to real-time server. ID:', socket?.id);
    store.setSocketConnected(true);
    const lastActiveBranch = localStorage.getItem('last_active_branch') || 'b1';
    socket?.emit('join:branch', lastActiveBranch);
  });

  socket.on('inventory:stock-updated', (payload: RealtimeStockPayload) => {
    console.log('⚡ [Socket.io Client] Real-time inventory event received:', payload);

    if (payload.items && payload.items.length > 0) {
      // 1. Immediately apply the deducted quantities to the local central store
      store.applyRealtimeStockUpdate(payload.branchId, payload.items);

      // 2. Dispatch a custom DOM event so UI screens (like POS.tsx) can show immediate feedback or drop out-of-stock cart items
      window.dispatchEvent(
        new CustomEvent('inventory:stock-updated', {
          detail: payload,
        })
      );
    }
  });

  socket.on('invoice:created', (invoice: any) => {
    console.log('⚡ [Socket.io Client] Real-time invoice:created received:', invoice?.invoiceNumber);
    if (invoice) {
      store.addInvoiceFromSocket(invoice);
    }
  });

  socket.on('invoice:updated', (invoice: any) => {
    console.log('⚡ [Socket.io Client] Real-time invoice:updated received:', invoice?.invoiceNumber);
    if (invoice) {
      store.updateInvoiceFromSocket(invoice);
    }
  });

  socket.on('invoices:deleted', (data: { ids: string[] }) => {
    console.log('⚡ [Socket.io Client] Real-time invoices:deleted received:', data?.ids);
    if (data && Array.isArray(data.ids)) {
      store.deleteInvoicesFromSocket(data.ids);
    }
  });

  socket.on('expense:created', (expense: any) => {
    console.log('⚡ [Socket.io Client] Real-time expense:created received:', expense?.id);
    if (expense) {
      store.addExpenseFromSocket(expense);
    }
  });

  socket.on('expense:deleted', (data: { id: string }) => {
    console.log('⚡ [Socket.io Client] Real-time expense:deleted received:', data?.id);
    if (data && data.id) {
      store.removeExpenseFromSocket(data.id);
    }
  });

  socket.on('product:created', (data: { product: any; branchData?: any[] }) => {
    console.log('⚡ [Socket.io Client] Real-time product:created received:', data?.product?.nameAr);
    if (data && data.product) {
      store.addProductFromSocket(data.product, data.branchData);
    }
  });

  socket.on('product:updated', (product: any) => {
    console.log('⚡ [Socket.io Client] Real-time product:updated received:', product?.nameAr);
    if (product) {
      store.updateProductFromSocket(product);
    }
  });

  socket.on('product:deleted', (data: { id: string }) => {
    console.log('⚡ [Socket.io Client] Real-time product:deleted received:', data?.id);
    if (data && data.id) {
      store.deleteProductFromSocket(data.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('⚠️ [Socket.io Client] Disconnected from server.');
    store.setSocketConnected(false);
  });

  return socket;
}

export function getSocketClient(): Socket | null {
  return socket;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
export function debouncedRefetch(fn: () => void, delayMs = 2000): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    fn();
  }, delayMs);
}
