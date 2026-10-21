import { AppDataSource } from '../../config/data-source';
import { InvoiceEntity, InvoiceItemPayload } from './invoice.entity';
import { InvoiceItemEntity } from './invoice-item.entity';
import { PhysicalItemEntity } from '../physical-items/physical-item.entity';
import { ProductEntity } from '../products/product.entity';
import { ProductBranchDataEntity } from '../products/product-branch-data.entity';
import { CustomerEntity } from '../customers/customer.entity';
import { UserEntity } from '../users/user.entity';
import { AppError } from '../../common/exceptions/app-error';
import { broadcastStockUpdate, broadcastInvoiceCreated, broadcastInvoicesDeleted, broadcastInvoiceUpdated, StockUpdateItem } from '../../common/socket/socket.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { memoryCache } from '../../common/cache/cache.service';

export class InvoiceService {
  private invoiceRepo = AppDataSource.getRepository(InvoiceEntity);

  public async getAllInvoices() {
    const cached = memoryCache.get<any[]>('invoices:all');
    if (cached) return cached;

    const invoices = await this.invoiceRepo.find({
      order: { createdAt: 'DESC' },
    });
    const formatted = invoices.map(this.formatInvoiceResponse);
    memoryCache.set('invoices:all', formatted, 15);
    return formatted;
  }

  public async getInvoicesByBranch(branchId: string) {
    const cacheKey = `invoices:branch:${branchId}`;
    const cached = memoryCache.get<any[]>(cacheKey);
    if (cached) return cached;

    const invoices = await this.invoiceRepo.find({
      where: { branchId },
      order: { createdAt: 'DESC' },
    });
    const formatted = invoices.map(this.formatInvoiceResponse);
    memoryCache.set(cacheKey, formatted, 15);
    return formatted;
  }

  public async getInvoiceById(id: string) {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    return this.formatInvoiceResponse(invoice);
  }

  public async createInvoice(data: {
    id?: string;
    invoiceNumber?: string;
    branchId: string;
    employeeId: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    date?: string;
    items: InvoiceItemPayload[];
    subtotal: number;
    discount?: number;
    total: number;
    paymentMethod?: 'cash' | 'card' | 'transfer' | 'vodafone_cash' | 'instapay' | 'multi';
    paymentStatus?: 'paid' | 'partial' | 'deferred';
    paymentSubMethod?: 'cash' | 'vodafone_cash' | 'instapay' | 'multi';
    splitPayments?: {
      cash?: number;
      vodafone_cash?: number;
      instapay?: number;
    };
    paidAmount?: number;
    remainingAmount?: number;
  }) {
    memoryCache.invalidate('invoices');
    memoryCache.invalidate('products');
    if (!data.items || data.items.length === 0) {
      throw new AppError('Invoice must contain at least one item', 400);
    }

    const updatedStockItems: StockUpdateItem[] = [];
    const targetBranchId = data.branchId || 'b1';

    const formattedInvoice = await AppDataSource.transaction(async (transactionalEntityManager) => {
      const id = data.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const invoiceNumber = data.invoiceNumber || `${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
      const date = data.date || new Date().toISOString();
      const discount = data.discount || 0;
      let computedSubtotal = 0;
      let computedTotalCost = 0;
      let computedNetProfit = 0;

      const invoiceItemEntities: InvoiceItemEntity[] = [];

      // Process each invoice line item with strict race-condition-safe locking & conditional update
      for (const itemPayload of data.items) {
        let physicalItemId: string | undefined = undefined;

        // 1. If physicalItemId is provided, atomically claim it with conditional update to prevent double-sale
        if (itemPayload.physicalItemId && itemPayload.physicalItemId.trim()) {
          const pId = itemPayload.physicalItemId.trim();
          const updatePhysResult: any = await transactionalEntityManager.query(
            `UPDATE physical_items 
             SET status = 'sold', "updatedAt" = NOW() 
             WHERE id = $1 AND status != 'sold' 
             RETURNING id`,
            [pId]
          );

          const affectedPhys = Array.isArray(updatePhysResult) && typeof updatePhysResult[1] === 'number'
            ? updatePhysResult[1]
            : (Array.isArray(updatePhysResult) ? updatePhysResult.length : 0);

          const physRows = Array.isArray(updatePhysResult) && Array.isArray(updatePhysResult[0])
            ? updatePhysResult[0]
            : (Array.isArray(updatePhysResult) ? updatePhysResult : []);

          if (affectedPhys === 0 || physRows.length === 0) {
            // Check if item exists in physical_items (item might already be sold or not exist)
            const checkPhys: any = await transactionalEntityManager.query(
              `SELECT id, status FROM physical_items WHERE id = $1`,
              [pId]
            );
            const pRows = Array.isArray(checkPhys) && Array.isArray(checkPhys[0])
              ? checkPhys[0]
              : (Array.isArray(checkPhys) ? checkPhys : []);

            if (pRows.length > 0) {
              throw new AppError(
                `القطعة (${pId}) تم بيعها للتو بواسطة مستخدم آخر! تم إلغاء الفاتورة لمنع البيع المزدوج.`,
                400
              );
            }
          } else {
            physicalItemId = pId;
          }
        }

        // Safely check if productId exists in database to prevent FK constraint failure
        let validProductId: string | undefined = undefined;
        if (itemPayload.productId && itemPayload.productId.trim()) {
          const targetProdId = itemPayload.productId.trim();
          const prodExists = await transactionalEntityManager.findOne(ProductEntity, {
            where: { id: targetProdId }
          });
          if (prodExists) {
            validProductId = targetProdId;
          }
        }

        // Fetch product cost for accurate historical profit tracking
        const branchData = validProductId ? await transactionalEntityManager.findOne(ProductBranchDataEntity, {
          where: { productId: validProductId, branchId: targetBranchId },
        }) : null;

        const unitCost = itemPayload.unitCost !== undefined && itemPayload.unitCost !== null ? Number(itemPayload.unitCost) : Number(branchData?.cost || 0);
        const unitPrice = Number(itemPayload.unitPrice || 0);
        const quantity = Number(itemPayload.quantity || 1);
        const lineCost = unitCost * quantity;
        const lineTotal = unitPrice * quantity;
        const lineProfit = lineTotal - lineCost;

        computedSubtotal += lineTotal;
        computedTotalCost += lineCost;
        computedNetProfit += lineProfit;

        // 2. ATOMIC CONDITIONAL STOCK DEDUCTION (Race-condition protection)
        // Decrement stock ONLY if current quantity >= requested quantity.
        // If two cashiers sell simultaneously, one gets affected rows === 0 and transaction aborts!
        if (validProductId) {
          const updateResult: any = await transactionalEntityManager.query(
            `UPDATE product_branch_data 
             SET quantity = quantity - $1, "updatedAt" = NOW() 
             WHERE "productId" = $2 AND "branchId" = $3 AND quantity >= $1 
             RETURNING quantity`,
            [quantity, validProductId, targetBranchId]
          );

          // In TypeORM with Postgres driver, query() returns [ rows, affectedCount ]
          const affectedRows = Array.isArray(updateResult) && typeof updateResult[1] === 'number'
            ? updateResult[1]
            : (Array.isArray(updateResult) ? updateResult.length : 0);

          const rows = Array.isArray(updateResult) && Array.isArray(updateResult[0])
            ? updateResult[0]
            : (Array.isArray(updateResult) ? updateResult : []);

          if (affectedRows === 0 || rows.length === 0) {
            // Find current stock for crystal-clear error message
            const currentStockRow: any = await transactionalEntityManager.query(
              `SELECT quantity FROM product_branch_data WHERE "productId" = $1 AND "branchId" = $2`,
              [validProductId, targetBranchId]
            );
            const stockRows = Array.isArray(currentStockRow) && Array.isArray(currentStockRow[0])
              ? currentStockRow[0]
              : (Array.isArray(currentStockRow) ? currentStockRow : []);

            const available = stockRows.length > 0 ? Number(stockRows[0].quantity) : 0;
            const prodName = itemPayload.productName || validProductId;

            throw new AppError(
              `نفدت الكمية! المنتج "${prodName}" المتبقي في المخزن منه (${available}) فقط، والمطلوب بيعه (${quantity}). تم إلغاء الفاتورة لمنع البيع المزدوج.`,
              400
            );
          }

          const newQty = Number(rows[0].quantity);
          updatedStockItems.push({
            productId: validProductId,
            productName: itemPayload.productName || 'منتج',
            newQuantity: newQty,
            isOutOfStock: newQty <= 0,
          });
        }

        // Create relational InvoiceItem Entity
        const invoiceItem = transactionalEntityManager.create(InvoiceItemEntity, {
          invoiceId: id,
          productId: validProductId,
          productName: itemPayload.productName || 'منتج',
          physicalItemId: physicalItemId,
          unitPrice,
          unitCost,
          quantity,
          profit: lineProfit,
        });

        invoiceItemEntities.push(invoiceItem);
      }

      const total = Number(data.total || computedSubtotal - discount);

      // Create & Save Invoice Entity
      const invoice = transactionalEntityManager.create(InvoiceEntity, {
        id,
        invoiceNumber,
        branchId: data.branchId,
        employeeId: data.employeeId,
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        date,
        subtotal: data.subtotal || computedSubtotal,
        discount,
        total,
        totalCost: computedTotalCost,
        netProfit: computedNetProfit - discount,
        paymentMethod: data.paymentMethod || 'cash',
        paymentStatus: data.paymentStatus || 'paid',
        paymentSubMethod: data.paymentSubMethod,
        splitPayments: data.splitPayments,
        paidAmount: data.paidAmount !== undefined ? data.paidAmount : total,
        remainingAmount: data.remainingAmount !== undefined ? data.remainingAmount : 0,
        invoiceItems: invoiceItemEntities,
      });

      // --- WHATSAPP-FIRST INVOICE CREATION RULE ---
      // The backend MUST NOT save the invoice or commit the transaction UNTIL the WhatsApp receipt
      // is successfully verified and sent to customer. If WhatsApp dispatch fails, throwing here
      // immediately triggers AppDataSource.transaction ROLLBACK, reverting stock deduction completely!
      if (data.customerPhone && data.customerPhone.trim()) {
        const receiptItems = data.items.map(it => ({
          productName: it.productName || 'منتج إكسسوارات',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          totalPrice: Number(it.unitPrice || 0) * Number(it.quantity || 1),
        }));

        await whatsappService.sendInvoiceReceipt({
          invoiceNumber,
          customerName: data.customerName || 'عميل',
          customerPhone: data.customerPhone.trim(),
          cashierName: (data as any).cashierName,
          total,
          paidAmount: data.paidAmount,
          remainingAmount: data.remainingAmount,
          paymentMethod: data.paymentMethod,
          items: receiptItems,
          confirmationToken: (data as any).whatsappConfirmationToken,
        });
      } else {
        throw new AppError('رقم هاتف العميل إجباري لإرسال إيصال الواتساب أولاً قبل تأكيد الفاتورة وحفظها في قاعدة البيانات!', 400);
      }

      await transactionalEntityManager.save(invoice);

      // Automatically save/update customer in CustomerEntity database
      if (data.customerPhone && data.customerPhone.trim()) {
        try {
          const custPhone = data.customerPhone.trim();
          const custName = data.customerName?.trim() || 'عميل';
          let cust = await transactionalEntityManager.findOne(CustomerEntity, {
            where: [{ phone: custPhone }]
          });
          if (cust) {
            if (custName && custName !== 'عميل') cust.name = custName;
            await transactionalEntityManager.save(cust);
          } else {
            cust = transactionalEntityManager.create(CustomerEntity, {
              id: data.customerId || `cust_${Date.now()}`,
              name: custName,
              phone: custPhone,
              branchId: data.branchId || 'b1'
            });
            await transactionalEntityManager.save(cust);
          }
        } catch (e) {
          console.warn('Could not auto-save customer during invoice creation:', e);
        }
      }

      // Safely update Employee Sales Count if employee exists
      if (data.employeeId) {
        try {
          const empUser = await transactionalEntityManager.findOne(UserEntity, { where: { id: data.employeeId } });
          if (empUser) {
            empUser.salesCount = Number(empUser.salesCount || 0) + 1;
            await transactionalEntityManager.save(empUser);
          }
        } catch (e) {
          console.warn('Could not update user salesCount:', e);
        }
      }

      return this.formatInvoiceResponse(invoice);
    });

    // Transaction committed successfully! Broadcast real-time events to all connected clients
    try {
      broadcastInvoiceCreated(formattedInvoice);
      if (updatedStockItems.length > 0) {
        broadcastStockUpdate({
          branchId: targetBranchId,
          invoiceNumber: formattedInvoice.invoiceNumber,
          items: updatedStockItems,
        });
      }
    } catch (broadcastErr) {
      console.warn('⚠️ [Socket.io] Broadcast error after invoice commit:', broadcastErr);
    }

    return {
      ...formattedInvoice,
      updatedStock: updatedStockItems,
    };
  }

  public async deleteInvoicesByIds(ids: string[]) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return { success: true };
    memoryCache.invalidate('invoices');
    memoryCache.invalidate('products');

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      // Find invoices to adjust salesCount for employees
      const invoices = await transactionalEntityManager
        .createQueryBuilder(InvoiceEntity, 'inv')
        .where('inv.id IN (:...ids) OR inv.invoiceNumber IN (:...ids)', { ids })
        .getMany();

      for (const inv of invoices) {
        if (inv.employeeId) {
          try {
            await transactionalEntityManager.decrement(UserEntity, { id: inv.employeeId }, 'salesCount', 1);
          } catch (e) {
            console.warn('Could not decrement employee salesCount:', e);
          }
        }
      }

      const allIdsToDelete = invoices.map(i => i.id);
      const combinedIds = Array.from(new Set([...ids, ...allIdsToDelete])).filter(Boolean);

      if (combinedIds.length > 0) {
        await transactionalEntityManager.query(
          `DELETE FROM invoice_items WHERE "invoiceId" = ANY($1)`,
          [combinedIds]
        );
        await transactionalEntityManager.query(
          `DELETE FROM invoices WHERE id = ANY($1) OR "invoiceNumber" = ANY($1)`,
          [combinedIds]
        );

        try {
          broadcastInvoicesDeleted(combinedIds);
        } catch (bErr) {
          console.warn('⚠️ [Socket.io] Broadcast error after invoice delete:', bErr);
        }
      }
    });

    return { success: true };
  }

  public async toggleFavorite(id: string) {
    memoryCache.invalidate('invoices');
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    invoice.isFavorite = !invoice.isFavorite;
    await this.invoiceRepo.save(invoice);
    return this.formatInvoiceResponse(invoice);
  }

  public async payInvoice(id: string, amount: number) {
    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }
    memoryCache.invalidate('invoices');

    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    const currentRemaining = Number(invoice.remainingAmount || 0);
    const payAmt = Math.min(amount, currentRemaining);
    const newPaid = Number(invoice.paidAmount || 0) + payAmt;
    const newRemaining = Math.max(0, currentRemaining - payAmt);
    const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

    invoice.paidAmount = newPaid;
    invoice.remainingAmount = newRemaining;
    invoice.paymentStatus = newStatus;

    await this.invoiceRepo.save(invoice);
    return this.formatInvoiceResponse(invoice);
  }

  public async payCustomerDebt(customerPhone: string, amount: number) {
    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }
    memoryCache.invalidate('invoices');

    const invoices = await this.invoiceRepo.find({
      where: [
        { customerPhone: customerPhone.trim() },
        { customerId: customerPhone.trim() },
      ],
      order: { date: 'ASC' },
    });

    const unpaidInvoices = invoices.filter(
      (inv) => inv.paymentStatus !== 'paid' && Number(inv.remainingAmount) > 0
    );

    let remainingToPay = amount;

    for (const inv of unpaidInvoices) {
      if (remainingToPay <= 0) break;
      const rem = Number(inv.remainingAmount || 0);
      const pay = Math.min(remainingToPay, rem);
      inv.paidAmount = Number(inv.paidAmount || 0) + pay;
      inv.remainingAmount = Math.max(0, rem - pay);
      inv.paymentStatus = inv.remainingAmount <= 0 ? 'paid' : 'partial';
      remainingToPay -= pay;
      await this.invoiceRepo.save(inv);
    }

    return { success: true, remainingToPay };
  }

  public async updateInvoice(id: string, data: any) {
    memoryCache.invalidate('invoices');
    memoryCache.invalidate('products');
    const result = await AppDataSource.transaction(async (transactionalEntityManager) => {
      const invoice = await transactionalEntityManager.findOne(InvoiceEntity, {
        where: [{ id }, { invoiceNumber: id }],
        relations: ['invoiceItems'],
      });

      if (!invoice) {
        throw new AppError('الفاتورة غير موجودة', 404);
      }

      const originalItems = invoice.invoiceItems || [];
      const branchId = invoice.branchId;
      const newItems = Array.isArray(data.items) ? data.items : [];

      // Calculate stock differences
      const originalQtyMap = new Map<string, number>();
      for (const item of originalItems) {
        if (item.productId) {
          originalQtyMap.set(item.productId, (originalQtyMap.get(item.productId) || 0) + Number(item.quantity || 1));
        }
      }

      const newQtyMap = new Map<string, number>();
      for (const item of newItems) {
        if (item.productId) {
          newQtyMap.set(item.productId, (newQtyMap.get(item.productId) || 0) + Number(item.quantity || 1));
        }
      }

      const allProductIds = new Set([...originalQtyMap.keys(), ...newQtyMap.keys()]);
      const updatedStockItems: StockUpdateItem[] = [];

      for (const pId of allProductIds) {
        const origQty = originalQtyMap.get(pId) || 0;
        const newQty = newQtyMap.get(pId) || 0;
        const diff = newQty - origQty; // if negative, quantity returned to inventory!

        if (diff < 0) {
          const returnQty = Math.abs(diff);
          await transactionalEntityManager.query(
            `UPDATE product_branch_data
             SET quantity = quantity + $1, "updatedAt" = NOW()
             WHERE "productId" = $2 AND "branchId" = $3`,
            [returnQty, pId, branchId]
          );

          const bData: any = await transactionalEntityManager.query(
            `SELECT p.name AS "productName", p."nameAr" AS "nameAr", pbd.quantity
             FROM product_branch_data pbd
             LEFT JOIN products p ON p.id = pbd."productId"
             WHERE pbd."productId" = $1 AND pbd."branchId" = $2`,
            [pId, branchId]
          );
          if (bData && bData.length > 0) {
            const q = Number(bData[0].quantity);
            updatedStockItems.push({
              productId: pId,
              productName: bData[0].nameAr || bData[0].productName || '',
              newQuantity: q,
              isOutOfStock: q <= 0,
            });
          }
        } else if (diff > 0) {
          await transactionalEntityManager.query(
            `UPDATE product_branch_data
             SET quantity = quantity - $1, "updatedAt" = NOW()
             WHERE "productId" = $2 AND "branchId" = $3`,
            [diff, pId, branchId]
          );

          const bData: any = await transactionalEntityManager.query(
            `SELECT p.name AS "productName", p."nameAr" AS "nameAr", pbd.quantity
             FROM product_branch_data pbd
             LEFT JOIN products p ON p.id = pbd."productId"
             WHERE pbd."productId" = $1 AND pbd."branchId" = $2`,
            [pId, branchId]
          );
          if (bData && bData.length > 0) {
            const q = Number(bData[0].quantity);
            updatedStockItems.push({
              productId: pId,
              productName: bData[0].nameAr || bData[0].productName || '',
              newQuantity: q,
              isOutOfStock: q <= 0,
            });
          }
        }
      }

      // If any physical item was removed, mark it available
      const newPhysicalIds = new Set(newItems.map((it: any) => it.physicalItemId).filter(Boolean));
      for (const item of originalItems) {
        if (item.physicalItemId && !newPhysicalIds.has(item.physicalItemId)) {
          await transactionalEntityManager.query(
            `UPDATE physical_items SET status = 'available', "updatedAt" = NOW() WHERE id = $1`,
            [item.physicalItemId]
          );
        }
      }

      // Delete old invoice items
      await transactionalEntityManager.delete(InvoiceItemEntity, { invoice: { id: invoice.id } });

      // Re-create items and calculate totals
      let computedSubtotal = 0;
      let computedTotalCost = 0;
      const createdItems: InvoiceItemEntity[] = [];

      for (const itemPayload of newItems) {
        const unitPrice = Number(itemPayload.unitPrice || 0);
        const quantity = Number(itemPayload.quantity || 1);
        
        let unitCost = itemPayload.unitCost !== undefined && itemPayload.unitCost !== null
          ? Number(itemPayload.unitCost)
          : 0;

        if (unitCost === 0 && itemPayload.productId) {
          const bd = await transactionalEntityManager.findOne(ProductBranchDataEntity, {
            where: { productId: itemPayload.productId, branchId }
          });
          unitCost = Number(bd?.cost || 0);
        }

        const lineTotal = unitPrice * quantity;
        const lineCost = unitCost * quantity;
        const lineProfit = lineTotal - lineCost;

        computedSubtotal += lineTotal;
        computedTotalCost += lineCost;

        const invItem = transactionalEntityManager.create(InvoiceItemEntity, {
          invoiceId: invoice.id,
          physicalItemId: itemPayload.physicalItemId,
          productId: itemPayload.productId,
          productName: itemPayload.productName || '',
          unitPrice,
          unitCost,
          quantity,
          profit: lineProfit,
        });

        createdItems.push(invItem);
      }

      if (createdItems.length > 0) {
        await transactionalEntityManager.save(createdItems);
      }

      const discount = Number(data.discount !== undefined ? data.discount : invoice.discount || 0);
      const computedTotal = Math.max(0, computedSubtotal - discount);
      const computedNetProfit = computedTotal - computedTotalCost;

      if (data.customerName !== undefined) invoice.customerName = data.customerName;
      if (data.customerPhone !== undefined) invoice.customerPhone = data.customerPhone;
      if (data.paymentMethod !== undefined) invoice.paymentMethod = data.paymentMethod;
      if (data.paymentSubMethod !== undefined) invoice.paymentSubMethod = data.paymentSubMethod;
      if (data.paymentStatus !== undefined) invoice.paymentStatus = data.paymentStatus;
      if (data.splitPayments !== undefined) invoice.splitPayments = data.splitPayments;

      invoice.subtotal = computedSubtotal;
      invoice.discount = discount;
      invoice.total = computedTotal;
      invoice.totalCost = computedTotalCost;
      invoice.netProfit = computedNetProfit;

      // Adjust paidAmount and remainingAmount
      if (invoice.paymentStatus === 'paid') {
        invoice.paidAmount = computedTotal;
        invoice.remainingAmount = 0;
      } else {
        const paid = Number(data.paidAmount !== undefined ? data.paidAmount : invoice.paidAmount || 0);
        invoice.paidAmount = isNaN(paid) ? computedTotal : Math.min(paid, computedTotal);
        invoice.remainingAmount = Math.max(0, computedTotal - invoice.paidAmount);
        if (invoice.remainingAmount <= 0) {
          invoice.paymentStatus = 'paid';
        }
      }

      invoice.invoiceItems = createdItems;
      await transactionalEntityManager.save(invoice);

      return {
        formattedInvoice: this.formatInvoiceResponse(invoice),
        updatedStockItems,
        targetBranchId: branchId,
      };
    });

    // Broadcast after transaction commits
    try {
      broadcastInvoiceUpdated(result.formattedInvoice);
      if (result.updatedStockItems.length > 0) {
        broadcastStockUpdate({
          branchId: result.targetBranchId,
          invoiceNumber: result.formattedInvoice.invoiceNumber,
          items: result.updatedStockItems,
        });
      }
    } catch (bErr) {
      console.warn('⚠️ [Socket.io] Broadcast error after invoice update:', bErr);
    }

    return {
      ...result.formattedInvoice,
      updatedStock: result.updatedStockItems,
    };
  }

  private formatInvoiceResponse(invoice: InvoiceEntity) {
    const items = (invoice.invoiceItems || []).map((item) => ({
      physicalItemId: item.physicalItemId,
      productId: item.productId,
      productName: item.productName,
      unitPrice: Number(item.unitPrice),
      unitCost: Number(item.unitCost),
      quantity: Number(item.quantity),
      profit: Number(item.profit),
    }));

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      branchId: invoice.branchId,
      employeeId: invoice.employeeId,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      date: invoice.date,
      items,
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      total: Number(invoice.total),
      totalCost: Number(invoice.totalCost),
      netProfit: Number(invoice.netProfit || 0),
      paymentMethod: invoice.paymentMethod,
      paymentStatus: invoice.paymentStatus,
      paymentSubMethod: invoice.paymentSubMethod,
      splitPayments: invoice.splitPayments,
      paidAmount: Number(invoice.paidAmount),
      remainingAmount: Number(invoice.remainingAmount),
      isFavorite: !!invoice.isFavorite,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}
