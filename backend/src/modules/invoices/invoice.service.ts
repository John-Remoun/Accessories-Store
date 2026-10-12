import { AppDataSource } from '../../config/data-source';
import { InvoiceEntity, InvoiceItemPayload } from './invoice.entity';
import { InvoiceItemEntity } from './invoice-item.entity';
import { PhysicalItemEntity } from '../physical-items/physical-item.entity';
import { ProductEntity } from '../products/product.entity';
import { ProductBranchDataEntity } from '../products/product-branch-data.entity';
import { CustomerEntity } from '../customers/customer.entity';
import { UserEntity } from '../users/user.entity';
import { AppError } from '../../common/exceptions/app-error';
import { broadcastStockUpdate, broadcastInvoiceCreated, broadcastInvoicesDeleted, StockUpdateItem } from '../../common/socket/socket.service';

export class InvoiceService {
  private invoiceRepo = AppDataSource.getRepository(InvoiceEntity);

  public async getAllInvoices() {
    const invoices = await this.invoiceRepo.find({
      order: { createdAt: 'DESC' },
    });
    return invoices.map(this.formatInvoiceResponse);
  }

  public async getInvoicesByBranch(branchId: string) {
    const invoices = await this.invoiceRepo.find({
      where: { branchId },
      order: { createdAt: 'DESC' },
    });
    return invoices.map(this.formatInvoiceResponse);
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
    paymentMethod?: 'cash' | 'card' | 'transfer' | 'vodafone_cash' | 'instapay';
    paymentStatus?: 'paid' | 'partial' | 'deferred';
    paymentSubMethod?: 'cash' | 'vodafone_cash' | 'instapay';
    paidAmount?: number;
    remainingAmount?: number;
  }) {
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

        // 1. If physicalItemId is provided, check if it exists in physical_items before updating
        if (itemPayload.physicalItemId && itemPayload.physicalItemId.trim()) {
          const pId = itemPayload.physicalItemId.trim();
          const existingPhys: any = await transactionalEntityManager.query(
            `SELECT id, status FROM physical_items WHERE id = $1`,
            [pId]
          );

          const physList = Array.isArray(existingPhys) && Array.isArray(existingPhys[0])
            ? existingPhys[0]
            : (Array.isArray(existingPhys) ? existingPhys : []);

          if (physList.length > 0) {
            if (physList[0].status === 'sold') {
              throw new AppError(
                `القطعة (${pId}) تم بيعها للتو بواسطة مستخدم آخر! تم إلغاء الفاتورة لمنع البيع المزدوج.`,
                400
              );
            }

            await transactionalEntityManager.query(
              `UPDATE physical_items 
               SET status = 'sold', "updatedAt" = NOW() 
               WHERE id = $1`,
              [pId]
            );
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
        paidAmount: data.paidAmount !== undefined ? data.paidAmount : total,
        remainingAmount: data.remainingAmount !== undefined ? data.remainingAmount : 0,
        invoiceItems: invoiceItemEntities,
      });

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
      paidAmount: Number(invoice.paidAmount),
      remainingAmount: Number(invoice.remainingAmount),
      isFavorite: !!invoice.isFavorite,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}
