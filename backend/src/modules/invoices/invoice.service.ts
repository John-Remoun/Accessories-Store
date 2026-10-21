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

/**
 * Normalizes customer phone or identifier into exact candidate representations
 * to ensure deterministic, exact identity matching across Egyptian mobile formats
 * without resorting to dangerous fuzzy/substring ILIKE matches.
 */
export function getCustomerIdentityConditions(input: string): string[] {
  if (!input) return [];
  const trimmed = input.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const candidates = new Set<string>();
  candidates.add(trimmed);

  // Only apply phone normalization if the input resembles a phone number
  const isPhoneLike = digitsOnly.length >= 10 || trimmed.startsWith('+') || digitsOnly.startsWith('01');
  if (isPhoneLike && digitsOnly) {
    candidates.add(digitsOnly);
    // Egyptian mobile formats (010/011/012/015)
    if (digitsOnly.startsWith('002')) {
      const without002 = digitsOnly.slice(3);
      candidates.add(without002);
      if (without002.startsWith('0')) {
        candidates.add(without002);
      } else {
        candidates.add('0' + without002);
      }
    }
    if (digitsOnly.startsWith('20') && digitsOnly.length === 12) {
      candidates.add(digitsOnly);
      candidates.add('0' + digitsOnly.slice(2)); // e.g. 010xxxxxxxx
      candidates.add('+' + digitsOnly);
    } else if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
      candidates.add(digitsOnly);
      candidates.add('2' + digitsOnly); // 2010xxxxxxxx
      candidates.add('+2' + digitsOnly);
    } else if (digitsOnly.length === 10 && digitsOnly.startsWith('1')) {
      candidates.add('0' + digitsOnly);
      candidates.add('20' + digitsOnly);
      candidates.add('+20' + digitsOnly);
    }
  }
  return Array.from(candidates);
}

export function getCairoDateParts(dateVal: string | Date | undefined): { year: number; month: number; day: number } | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(d);
    let year = d.getFullYear();
    let month = d.getMonth();
    let day = d.getDate();
    for (const p of parts) {
      if (p.type === 'year') year = parseInt(p.value, 10);
      if (p.type === 'month') month = parseInt(p.value, 10) - 1; // 0-indexed: 0 = Jan, 11 = Dec
      if (p.type === 'day') day = parseInt(p.value, 10);
    }
    return { year, month, day };
  } catch {
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
}

export class InvoiceService {
  private invoiceRepo = AppDataSource.getRepository(InvoiceEntity);

  public async getAllInvoices() {
    const cached = memoryCache.get<any[]>('invoices:all');
    if (cached) return cached;

    const invoices = await this.invoiceRepo.find({
      take: 100,
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
      take: 100,
      order: { createdAt: 'DESC' },
    });
    const formatted = invoices.map(this.formatInvoiceResponse);
    memoryCache.set(cacheKey, formatted, 15);
    return formatted;
  }

  public async getInvoiceById(id: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: [{ id }, { invoiceNumber: id }],
      relations: ['invoiceItems'],
    });
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    return this.formatInvoiceResponse(invoice);
  }

  public async getPaginatedInvoices(options: {
    page?: number;
    limit?: number;
    branchId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentStatus?: string;
    isFavorite?: boolean;
    employeeId?: string;
    customerPhone?: string;
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.invoiceItems', 'invoiceItems');

    if (options.branchId) {
      qb.andWhere('invoice.branchId = :branchId', { branchId: options.branchId });
    }

    if (options.employeeId) {
      qb.andWhere('invoice.employeeId = :employeeId', { employeeId: options.employeeId });
    }

    if (options.startDate) {
      const normalizedStartDate = options.startDate.length === 10 ? `${options.startDate}T00:00:00.000Z` : options.startDate;
      qb.andWhere('invoice.date >= :startDate', { startDate: normalizedStartDate });
    }

    if (options.endDate) {
      const normalizedEndDate = options.endDate.length === 10 ? `${options.endDate}T23:59:59.999Z` : options.endDate;
      qb.andWhere('invoice.date <= :endDate', { endDate: normalizedEndDate });
    }

    if (options.paymentStatus) {
      if (options.paymentStatus === 'paid') {
        qb.andWhere('(invoice.paymentStatus = :ps OR invoice.remainingAmount = 0)', { ps: 'paid' });
      } else if (options.paymentStatus === 'unpaid') {
        qb.andWhere('(invoice.paymentStatus = :ps OR invoice.remainingAmount > 0)', { ps: 'deferred' });
      } else if (options.paymentStatus === 'partial') {
        qb.andWhere('invoice.paymentStatus = :ps', { ps: 'partial' });
      }
    }

    if (options.isFavorite !== undefined && options.isFavorite !== null) {
      qb.andWhere('invoice.isFavorite = :isFav', { isFav: options.isFavorite });
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      qb.andWhere(
        '(invoice.invoiceNumber ILIKE :term OR invoice.customerName ILIKE :term OR invoice.customerPhone ILIKE :term)',
        { term }
      );
    }

    if (options.customerPhone && options.customerPhone.trim()) {
      const cPhone = `%${options.customerPhone.trim()}%`;
      qb.andWhere('(invoice.customerPhone ILIKE :cPhone OR invoice.customerId = :exactPhone)', {
        cPhone,
        exactPhone: options.customerPhone.trim(),
      });
    }

    qb.orderBy('invoice.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [invoices, total] = await qb.getManyAndCount();
    const formatted = invoices.map(this.formatInvoiceResponse);

    return {
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
    vodafoneNumber?: string;
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

        // 1. If physicalItemId is provided and is a genuine physical item ID (not synthetic cart prefix), atomically claim it with branch matching & conditional update to prevent double-sale
        const rawPId = itemPayload.physicalItemId ? itemPayload.physicalItemId.trim() : '';
        const isSyntheticPhysical = !rawPId ||
          rawPId.startsWith('COMP-ITEM-') ||
          rawPId.startsWith('COMP-') ||
          rawPId.startsWith('ITEM-');

        if (rawPId && !isSyntheticPhysical) {
          const pId = rawPId;
          const updatePhysResult: any = await transactionalEntityManager.query(
            `UPDATE physical_items
             SET status = 'sold', "updatedAt" = NOW()
             WHERE id = $1 AND "branchId" = $2 AND status != 'sold'
             RETURNING id`,
            [pId, targetBranchId]
          );

          const affectedPhys = Array.isArray(updatePhysResult) && typeof updatePhysResult[1] === 'number'
            ? updatePhysResult[1]
            : (Array.isArray(updatePhysResult) ? updatePhysResult.length : 0);

          const physRows = Array.isArray(updatePhysResult) && Array.isArray(updatePhysResult[0])
            ? updatePhysResult[0]
            : (Array.isArray(updatePhysResult) ? updatePhysResult : []);

          if (affectedPhys === 0 || physRows.length === 0) {
            // Check why reservation failed (item does not exist, belongs to another branch, or is already sold)
            const checkPhys: any = await transactionalEntityManager.query(
              `SELECT id, status, "branchId" FROM physical_items WHERE id = $1`,
              [pId]
            );
            const pRows = Array.isArray(checkPhys) && Array.isArray(checkPhys[0])
              ? checkPhys[0]
              : (Array.isArray(checkPhys) ? checkPhys : []);

            if (pRows.length === 0) {
              throw new AppError(
                `القطعة (${pId}) غير موجودة بالنظام!`,
                400
              );
            } else if (pRows[0].branchId !== targetBranchId) {
              throw new AppError(
                `القطعة (${pId}) تنتمي إلى فرع آخر (${pRows[0].branchId}) وغير متاحة للبيع في فرع الفاتورة (${targetBranchId})!`,
                400
              );
            } else {
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
        vodafoneNumber: data.vodafoneNumber,
        splitPayments: data.splitPayments,
        paidAmount: data.paidAmount !== undefined ? data.paidAmount : total,
        remainingAmount: data.remainingAmount !== undefined ? data.remainingAmount : 0,
        invoiceItems: invoiceItemEntities,
      });

      if (!data.customerPhone || !data.customerPhone.trim()) {
        throw new AppError('رقم هاتف العميل إجباري لإرسال إيصال الواتساب أولاً قبل تأكيد الفاتورة وحفظها في قاعدة البيانات!', 400);
      }
      // Strictly validate phone number format before saving invoice
      whatsappService.formatPhoneNumber(data.customerPhone);

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

    // Safely dispatch WhatsApp receipt asynchronously after transaction has committed
    if (data.customerPhone && data.customerPhone.trim()) {
      const receiptItems = data.items.map(it => ({
        productName: it.productName || 'منتج إكسسوارات',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        totalPrice: Number(it.unitPrice || 0) * Number(it.quantity || 1),
      }));

      whatsappService.sendInvoiceReceipt({
        invoiceNumber: formattedInvoice.invoiceNumber,
        customerName: data.customerName || 'عميل',
        customerPhone: data.customerPhone.trim(),
        cashierName: (data as any).cashierName,
        total: formattedInvoice.total,
        paidAmount: formattedInvoice.paidAmount,
        remainingAmount: formattedInvoice.remainingAmount,
        paymentMethod: formattedInvoice.paymentMethod,
        items: receiptItems,
        confirmationToken: (data as any).whatsappConfirmationToken,
      }).catch((waErr: any) => {
        console.warn('⚠️ [WhatsApp] Post-commit receipt dispatch notice:', waErr.message || waErr);
      });
    }

    return {
      ...formattedInvoice,
      updatedStock: updatedStockItems,
    };
  }

  public async deleteInvoicesByIds(ids: string[]) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return { success: true };
    const deduplicatedIds = Array.from(new Set(ids)).filter(Boolean);
    if (deduplicatedIds.length === 0) return { success: true };

    memoryCache.invalidate('invoices');
    memoryCache.invalidate('products');

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      // Find invoices with their line items to adjust inventory and employee stats
      const invoices = await transactionalEntityManager
        .createQueryBuilder(InvoiceEntity, 'inv')
        .leftJoinAndSelect('inv.invoiceItems', 'item')
        .where('inv.id IN (:...ids) OR inv.invoiceNumber IN (:...ids)', { ids: deduplicatedIds })
        .getMany();

      if (!invoices || invoices.length === 0) {
        // Invoices already deleted or non-existent.
        // Prevents double-restoring inventory on duplicate or retry requests.
        return;
      }

      for (const inv of invoices) {
        const branchId = inv.branchId;

        // 1. Decrement employee salesCount
        if (inv.employeeId) {
          try {
            await transactionalEntityManager.decrement(UserEntity, { id: inv.employeeId }, 'salesCount', 1);
          } catch (e) {
            console.warn('Could not decrement employee salesCount:', e);
          }
        }

        // 2. Restore stock for each invoice line item
        if (inv.invoiceItems && Array.isArray(inv.invoiceItems)) {
          for (const item of inv.invoiceItems) {
            // Restore regular product aggregate inventory
            if (item.productId) {
              const qtyToRestore = Number(item.quantity || 1);
              await transactionalEntityManager.query(
                `UPDATE product_branch_data
                 SET quantity = quantity + $1, "updatedAt" = NOW()
                 WHERE "productId" = $2 AND "branchId" = $3`,
                [qtyToRestore, item.productId, branchId]
              );
            }

            // Restore physical QR piece to 'available' if linked and currently marked 'sold'
            if (item.physicalItemId && item.physicalItemId.trim()) {
              const pId = item.physicalItemId.trim();
              if (!pId.startsWith('COMP-ITEM-') && !pId.startsWith('COMP-') && !pId.startsWith('ITEM-')) {
                await transactionalEntityManager.query(
                  `UPDATE physical_items
                   SET status = 'available', "updatedAt" = NOW()
                   WHERE id = $1 AND "branchId" = $2 AND status = 'sold'`,
                  [pId, branchId]
                );
              }
            }
          }
        }
      }

      const allIdsToDelete = invoices.map(i => i.id);
      const combinedIds = Array.from(new Set([...deduplicatedIds, ...allIdsToDelete])).filter(Boolean);

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
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }
    const roundedAmount = Math.round(amount * 100) / 100;
    if (roundedAmount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    const updated = await AppDataSource.transaction(async (transactionalEntityManager) => {
      const invoice = await transactionalEntityManager
        .createQueryBuilder(InvoiceEntity, 'invoice')
        .setLock('pessimistic_write')
        .where('invoice.id = :id OR invoice.invoiceNumber = :id', { id })
        .getOne();

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      const currentRemaining = Math.max(
        0,
        Math.round(Number(invoice.remainingAmount ?? (invoice.total - (invoice.paidAmount || 0))) * 100) / 100
      );
      const payAmt = Math.min(roundedAmount, currentRemaining);
      const newPaid = Math.round((Number(invoice.paidAmount || 0) + payAmt) * 100) / 100;
      const newRemaining = Math.max(0, Math.round((currentRemaining - payAmt) * 100) / 100);
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      invoice.paidAmount = newPaid;
      invoice.remainingAmount = newRemaining;
      invoice.paymentStatus = newStatus;

      await transactionalEntityManager.save(invoice);
      return invoice;
    });

    memoryCache.invalidate('invoices');
    return this.formatInvoiceResponse(updated);
  }

  public async payCustomerDebt(customerPhone: string, amount: number, branchId?: string) {
    if (!customerPhone || !customerPhone.trim()) {
      throw new AppError('Customer phone or ID is required', 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }
    const roundedPayment = Math.round(amount * 100) / 100;
    if (roundedPayment <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    const candidateIdentities = getCustomerIdentityConditions(customerPhone);

    const result = await AppDataSource.transaction(async (transactionalEntityManager) => {
      let qb = transactionalEntityManager
        .createQueryBuilder(InvoiceEntity, 'invoice')
        .setLock('pessimistic_write')
        .where(
          '(invoice.customerPhone IN (:...candidateIdentities) OR invoice.customerId IN (:...candidateIdentities))',
          { candidateIdentities }
        )
        .andWhere('invoice.paymentStatus != :paidStatus', { paidStatus: 'paid' })
        .andWhere('COALESCE(invoice.remainingAmount, 0) > 0');

      if (branchId) {
        qb = qb.andWhere('invoice.branchId = :branchId', { branchId });
      }

      qb = qb
        .orderBy('invoice.date', 'ASC')
        .addOrderBy('invoice.id', 'ASC');

      const eligibleInvoices = await qb.getMany();

      let unallocatedAmount = roundedPayment;
      let allocatedTotal = 0;
      const updatedInvoices: InvoiceEntity[] = [];

      for (const inv of eligibleInvoices) {
        if (unallocatedAmount <= 0) break;

        const currentRemaining = Math.max(
          0,
          Math.round(Number(inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0))) * 100) / 100
        );
        if (currentRemaining <= 0) continue;

        const allocation = Math.min(unallocatedAmount, currentRemaining);
        if (allocation <= 0) break;

        const newPaid = Math.round((Number(inv.paidAmount || 0) + allocation) * 100) / 100;
        const newRemaining = Math.round((currentRemaining - allocation) * 100) / 100;

        inv.paidAmount = newPaid;
        inv.remainingAmount = newRemaining;
        inv.paymentStatus = newRemaining <= 0 ? 'paid' : 'partial';

        unallocatedAmount = Math.round((unallocatedAmount - allocation) * 100) / 100;
        allocatedTotal = Math.round((allocatedTotal + allocation) * 100) / 100;

        await transactionalEntityManager.save(inv);
        updatedInvoices.push(inv);
      }

      return {
        success: true,
        amountApplied: allocatedTotal,
        remainingToPay: unallocatedAmount,
        unallocatedAmount,
        allocatedTotal,
        settledCount: updatedInvoices.length,
        updatedInvoices: updatedInvoices.map((inv) => this.formatInvoiceResponse(inv)),
      };
    });

    memoryCache.invalidate('invoices');
    return result;
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
        const diff = newQty - origQty; // if negative, quantity returned to inventory; if positive, deducted!

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
          // Atomic conditional stock deduction: deduct ONLY if quantity >= diff
          const updateRes: any = await transactionalEntityManager.query(
            `UPDATE product_branch_data
             SET quantity = quantity - $1, "updatedAt" = NOW()
             WHERE "productId" = $2 AND "branchId" = $3 AND quantity >= $1
             RETURNING quantity`,
            [diff, pId, branchId]
          );

          const affectedRows = Array.isArray(updateRes) && typeof updateRes[1] === 'number'
            ? updateRes[1]
            : (Array.isArray(updateRes) ? updateRes.length : 0);

          const retRows = Array.isArray(updateRes) && Array.isArray(updateRes[0])
            ? updateRes[0]
            : (Array.isArray(updateRes) ? updateRes : []);

          if (affectedRows === 0 || retRows.length === 0) {
            const currentStockRow: any = await transactionalEntityManager.query(
              `SELECT quantity FROM product_branch_data WHERE "productId" = $1 AND "branchId" = $2`,
              [pId, branchId]
            );
            const stockRows = Array.isArray(currentStockRow) && Array.isArray(currentStockRow[0])
              ? currentStockRow[0]
              : (Array.isArray(currentStockRow) ? currentStockRow : []);
            const available = stockRows.length > 0 ? Number(stockRows[0].quantity) : 0;

            throw new AppError(
              `الرصيد غير كافٍ للمنتج (${pId}) في الفرع لإتمام التعديل! المتاح (${available}) والمطلوب إضافته (${diff}).`,
              400
            );
          }

          const q = Number(retRows[0].quantity);
          const bData: any = await transactionalEntityManager.query(
            `SELECT p.name AS "productName", p."nameAr" AS "nameAr"
             FROM products p
             WHERE p.id = $1`,
            [pId]
          );
          const pRows = Array.isArray(bData) && Array.isArray(bData[0]) ? bData[0] : (Array.isArray(bData) ? bData : []);
          const prodName = pRows.length > 0 ? (pRows[0].nameAr || pRows[0].name || '') : '';

          updatedStockItems.push({
            productId: pId,
            productName: prodName,
            newQuantity: q,
            isOutOfStock: q <= 0,
          });
        }
      }

      // Handle physical item changes:
      const origPhysicalMap = new Map<string, InvoiceItemEntity>();
      for (const item of originalItems) {
        if (item.physicalItemId && item.physicalItemId.trim()) {
          const pId = item.physicalItemId.trim();
          if (!pId.startsWith('COMP-ITEM-') && !pId.startsWith('COMP-') && !pId.startsWith('ITEM-')) {
            origPhysicalMap.set(pId, item);
          }
        }
      }

      const newPhysicalSet = new Set<string>();
      for (const item of newItems) {
        if (item.physicalItemId && item.physicalItemId.trim()) {
          const pId = item.physicalItemId.trim();
          if (!pId.startsWith('COMP-ITEM-') && !pId.startsWith('COMP-') && !pId.startsWith('ITEM-')) {
            newPhysicalSet.add(pId);
          }
        }
      }

      // A. Safely release physical items that were removed from this invoice
      for (const [pId] of origPhysicalMap.entries()) {
        if (!newPhysicalSet.has(pId)) {
          await transactionalEntityManager.query(
            `UPDATE physical_items
             SET status = 'available', "updatedAt" = NOW()
             WHERE id = $1 AND "branchId" = $2 AND status = 'sold'`,
            [pId, branchId]
          );
        }
      }

      // B. Atomically claim newly added physical items
      for (const itemPayload of newItems) {
        const rawPId = itemPayload.physicalItemId ? itemPayload.physicalItemId.trim() : '';
        const isSynthetic = !rawPId ||
          rawPId.startsWith('COMP-ITEM-') ||
          rawPId.startsWith('COMP-') ||
          rawPId.startsWith('ITEM-');

        if (rawPId && !isSynthetic) {
          const pId = rawPId;
          if (!origPhysicalMap.has(pId)) {
            const updatePhysResult: any = await transactionalEntityManager.query(
              `UPDATE physical_items
               SET status = 'sold', "updatedAt" = NOW()
               WHERE id = $1 AND "branchId" = $2 AND status != 'sold'
               RETURNING id`,
              [pId, branchId]
            );

            const affectedPhys = Array.isArray(updatePhysResult) && typeof updatePhysResult[1] === 'number'
              ? updatePhysResult[1]
              : (Array.isArray(updatePhysResult) ? updatePhysResult.length : 0);

            const physRows = Array.isArray(updatePhysResult) && Array.isArray(updatePhysResult[0])
              ? updatePhysResult[0]
              : (Array.isArray(updatePhysResult) ? updatePhysResult : []);

            if (affectedPhys === 0 || physRows.length === 0) {
              const checkPhys: any = await transactionalEntityManager.query(
                `SELECT id, status, "branchId" FROM physical_items WHERE id = $1`,
                [pId]
              );
              const pRows = Array.isArray(checkPhys) && Array.isArray(checkPhys[0])
                ? checkPhys[0]
                : (Array.isArray(checkPhys) ? checkPhys : []);

              if (pRows.length === 0) {
                throw new AppError(`القطعة (${pId}) غير موجودة بالنظام!`, 400);
              } else if (pRows[0].branchId !== branchId) {
                throw new AppError(
                  `القطعة (${pId}) تنتمي إلى فرع آخر (${pRows[0].branchId}) وغير متاحة للبيع في هذا الفرع (${branchId})!`,
                  400
                );
              } else {
                throw new AppError(
                  `القطعة (${pId}) غير متاحة أو تم بيعها بالفعل في معاملة أخرى!`,
                  400
                );
              }
            }
          }
        }
      }

      // Delete old invoice items
      await transactionalEntityManager.delete(InvoiceItemEntity, { invoiceId: invoice.id });

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

        const rawPhys = itemPayload.physicalItemId ? itemPayload.physicalItemId.trim() : '';
        const isSynthetic = !rawPhys ||
          rawPhys.startsWith('COMP-ITEM-') ||
          rawPhys.startsWith('COMP-') ||
          rawPhys.startsWith('ITEM-');

        const invItem = transactionalEntityManager.create(InvoiceItemEntity, {
          invoiceId: invoice.id,
          physicalItemId: isSynthetic ? undefined : rawPhys || undefined,
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
      if (data.vodafoneNumber !== undefined) invoice.vodafoneNumber = data.vodafoneNumber;
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
      vodafoneNumber: invoice.vodafoneNumber,
      splitPayments: invoice.splitPayments,
      paidAmount: Number(invoice.paidAmount),
      remainingAmount: Number(invoice.remainingAmount),
      isFavorite: !!invoice.isFavorite,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  public async getReportsSummary(options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    year?: number;
    month?: number;
  }) {
    if (!AppDataSource.isInitialized) {
      return {
        branchSummaries: [],
        overall: { revenue: 0, cost: 0, netProfit: 0, remainingDebt: 0, invoicesCount: 0 },
        employeeRankings: [],
        dailyMetrics: [],
      };
    }

    // Normalize targetYear and targetMonth (0-indexed internally: 0 = Jan, 11 = Dec)
    const targetYear = options.year !== undefined ? Number(options.year) : new Date().getFullYear();
    let targetMonth: number | undefined = undefined;
    if (options.month !== undefined) {
      const m = Number(options.month);
      if (m >= 1 && m <= 12) {
        targetMonth = m - 1; // Convert 1-indexed to 0-indexed
      } else if (m >= 0 && m <= 11) {
        targetMonth = m;
      }
    }

    const cacheKey = `invoices:reports_summary:${options.branchId || 'all'}:${options.year ?? 'all'}:${options.month ?? 'all'}:${options.startDate || ''}:${options.endDate || ''}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;

    let qb = this.invoiceRepo.createQueryBuilder('invoice');

    if (options.branchId) {
      qb = qb.andWhere('invoice.branchId = :branchId', { branchId: options.branchId });
    }

    if (options.startDate) {
      const normalizedStartDate = options.startDate.length === 10 ? `${options.startDate}T00:00:00.000Z` : options.startDate;
      qb = qb.andWhere('invoice.date >= :startDate', { startDate: normalizedStartDate });
    }

    if (options.endDate) {
      const normalizedEndDate = options.endDate.length === 10 ? `${options.endDate}T23:59:59.999Z` : options.endDate;
      qb = qb.andWhere('invoice.date <= :endDate', { endDate: normalizedEndDate });
    }

    // If year and month are specified without custom dates, bound SQL query to that target month +- 1 day safety margin
    if (!options.startDate && !options.endDate && targetMonth !== undefined) {
      const qStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0));
      qStart.setUTCDate(qStart.getUTCDate() - 1);
      const qEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));
      qEnd.setUTCDate(qEnd.getUTCDate() + 1);

      qb = qb.andWhere('invoice.date >= :qStart AND invoice.date <= :qEnd', {
        qStart: qStart.toISOString(),
        qEnd: qEnd.toISOString(),
      });
    }

    const invoices = await qb
      .select([
        'invoice.id',
        'invoice.branchId',
        'invoice.employeeId',
        'invoice.date',
        'invoice.total',
        'invoice.totalCost',
        'invoice.netProfit',
        'invoice.paidAmount',
        'invoice.remainingAmount',
        'invoice.paymentStatus',
        'invoice.paymentSubMethod',
        'invoice.paymentMethod',
        'invoice.splitPayments',
      ])
      .getMany();

    const getPaid = (inv: InvoiceEntity): number => {
      if (inv.paidAmount !== undefined && inv.paidAmount !== null) {
        const val = Number(inv.paidAmount);
        if (!isNaN(val)) return Math.max(0, val);
      }
      if (inv.paymentStatus === 'paid') {
        const val = Number(inv.total);
        if (!isNaN(val)) return Math.max(0, val);
      }
      return 0;
    };

    const getCost = (inv: InvoiceEntity): number => {
      const paid = getPaid(inv);
      const total = Number(inv.total || 0);
      const totalCost = Number(inv.totalCost || 0);
      if (isNaN(paid) || isNaN(total) || isNaN(totalCost)) return 0;
      if (paid <= 0 || total <= 0 || totalCost <= 0) return 0;
      if (paid >= total) return totalCost;
      return totalCost * (paid / total);
    };

    const getRemaining = (inv: InvoiceEntity): number => {
      if (inv.remainingAmount !== undefined && inv.remainingAmount !== null) {
        return Number(inv.remainingAmount);
      }
      if (inv.paymentStatus === 'paid') return 0;
      return Math.max(0, Number(inv.total || 0) - getPaid(inv));
    };

    const branchMap = new Map<string, {
      branchId: string;
      revenue: number;
      cost: number;
      netProfit: number;
      remainingDebt: number;
      invoicesCount: number;
    }>();

    const employeeMap = new Map<string, {
      employeeId: string;
      totalSalesAmount: number;
      totalInvoicesCount: number;
    }>();

    const daysMap = new Map<number, {
      dayNum: number;
      revenue: number;
      cost: number;
      netProfit: number;
      remainingDebt: number;
      invoicesCount: number;
      cash: number;
      vodafone: number;
      instapay: number;
    }>();

    let totalRevenue = 0;
    let totalCost = 0;
    let totalRemainingDebt = 0;
    let relevantInvoiceCount = 0;

    for (const inv of invoices) {
      const cDate = getCairoDateParts(inv.date);
      if (!cDate) continue;

      // If filtering for a specific targetMonth, strictly ensure the Cairo date matches targetMonth and targetYear
      const isTargetMonth = targetMonth !== undefined
        ? (cDate.year === targetYear && cDate.month === targetMonth)
        : true;

      // Invoices that fall outside the target month (e.g. from the SQL padding margin) are excluded
      if (targetMonth !== undefined && !isTargetMonth) {
        continue;
      }

      relevantInvoiceCount++;
      const paid = getPaid(inv);
      const cost = getCost(inv);
      const rem = getRemaining(inv);
      const netProfit = paid - cost;

      totalRevenue += paid;
      totalCost += cost;
      totalRemainingDebt += rem;

      const bEntry = branchMap.get(inv.branchId) || {
        branchId: inv.branchId,
        revenue: 0,
        cost: 0,
        netProfit: 0,
        remainingDebt: 0,
        invoicesCount: 0,
      };
      bEntry.revenue += paid;
      bEntry.cost += cost;
      bEntry.netProfit += netProfit;
      bEntry.remainingDebt += rem;
      bEntry.invoicesCount += 1;
      branchMap.set(inv.branchId, bEntry);

      if (inv.employeeId) {
        const empEntry = employeeMap.get(inv.employeeId) || {
          employeeId: inv.employeeId,
          totalSalesAmount: 0,
          totalInvoicesCount: 0,
        };
        empEntry.totalSalesAmount += Number(inv.total || 0);
        empEntry.totalInvoicesCount += 1;
        employeeMap.set(inv.employeeId, empEntry);
      }

      if (isTargetMonth) {
        const dayNum = cDate.day;
        const dEntry = daysMap.get(dayNum) || {
          dayNum,
          revenue: 0,
          cost: 0,
          netProfit: 0,
          remainingDebt: 0,
          invoicesCount: 0,
          cash: 0,
          vodafone: 0,
          instapay: 0,
        };
        dEntry.revenue += paid;
        dEntry.cost += cost;
        dEntry.netProfit += netProfit;
        dEntry.remainingDebt += rem;
        dEntry.invoicesCount += 1;

        if (paid > 0) {
          const split = inv.splitPayments;
          if (split && (Number(split.cash || 0) > 0 || Number(split.vodafone_cash || 0) > 0 || Number(split.instapay || 0) > 0)) {
            dEntry.cash += Number(split.cash || 0);
            dEntry.vodafone += Number(split.vodafone_cash || 0);
            dEntry.instapay += Number(split.instapay || 0);
          } else {
            const method = inv.paymentSubMethod || inv.paymentMethod || 'cash';
            if (method === 'cash') dEntry.cash += paid;
            else if (method === 'vodafone_cash') dEntry.vodafone += paid;
            else if (method === 'instapay') dEntry.instapay += paid;
            else dEntry.cash += paid;
          }
        }
        daysMap.set(dayNum, dEntry);
      }
    }

    const result = {
      branchSummaries: Array.from(branchMap.values()),
      overall: {
        revenue: totalRevenue,
        cost: totalCost,
        netProfit: totalRevenue - totalCost,
        remainingDebt: totalRemainingDebt,
        invoicesCount: relevantInvoiceCount,
      },
      employeeRankings: Array.from(employeeMap.values()).sort((a, b) => b.totalSalesAmount - a.totalSalesAmount),
      dailyMetrics: Array.from(daysMap.values()).sort((a, b) => a.dayNum - b.dayNum),
    };

    memoryCache.set(cacheKey, result, 60);
    return result;
  }

  public async getCustomerStatement(options: {
    phone?: string;
    name?: string;
    branchId?: string;
  }) {
    if (!AppDataSource.isInitialized) {
      return {
        customerPhone: options.phone || '',
        customerName: options.name || '',
        totalPurchases: 0,
        totalPaid: 0,
        totalDebt: 0,
        invoices: [],
        unpaidInvoices: [],
        paidInvoices: [],
      };
    }

    const cleanPhone = (options.phone || '').trim();
    const cleanName = (options.name || '').trim();

    if (!cleanPhone && !cleanName) {
      throw new AppError('Customer phone or name is required for statement', 400);
    }

    let qb = this.invoiceRepo.createQueryBuilder('invoice');

    if (cleanPhone) {
      // Exact identity matching via normalized candidate variants or exact customerId
      const phoneList = getCustomerIdentityConditions(cleanPhone);
      qb = qb.where('(invoice.customerPhone IN (:...phoneList) OR invoice.customerId IN (:...phoneList))', {
        phoneList,
      });
      // CRITICAL: Never combine phone with an OR on customerName to prevent accidental cross-account merging!
    } else {
      // Fallback: Name-only lookup ONLY when phone is absent. Use exact trimmed case-insensitive comparison.
      qb = qb.where('LOWER(TRIM(invoice.customerName)) = LOWER(:cleanName)', {
        cleanName,
      });
    }

    if (options.branchId) {
      qb = qb.andWhere('invoice.branchId = :branchId', { branchId: options.branchId });
    }

    // Deterministic FIFO ordering with stable unique tie-breaker
    qb = qb.orderBy('invoice.date', 'ASC').addOrderBy('invoice.id', 'ASC');

    const invoices = await qb.getMany();
    const formatted = invoices.map(this.formatInvoiceResponse);

    let totalPurchases = 0;
    let totalPaid = 0;
    let totalDebt = 0;

    const unpaidInvoices: any[] = [];
    const paidInvoices: any[] = [];

    for (const inv of formatted) {
      const tot = Number(inv.total || 0);
      const rem = inv.remainingAmount !== undefined ? Number(inv.remainingAmount) : (inv.paymentStatus === 'paid' ? 0 : Math.max(0, tot - Number(inv.paidAmount || 0)));
      const paid = inv.paidAmount !== undefined ? Number(inv.paidAmount) : (inv.paymentStatus === 'paid' ? tot : 0);

      totalPurchases += tot;
      totalPaid += paid;
      totalDebt += rem;

      if (rem > 0 || inv.paymentStatus === 'deferred' || inv.paymentStatus === 'partial') {
        unpaidInvoices.push(inv);
      } else {
        paidInvoices.push(inv);
      }
    }

    return {
      customerPhone: cleanPhone,
      customerName: (cleanPhone ? (formatted[0]?.customerName || cleanName) : cleanName) || 'عميل',
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalDebt: Math.round(totalDebt * 100) / 100,
      invoices: formatted,
      unpaidInvoices,
      paidInvoices,
    };
  }

  public async getCustomerSummaries(options: { branchId?: string }) {
    if (!AppDataSource.isInitialized) return [];

    let qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .select('COALESCE(NULLIF(TRIM(invoice.customerPhone), \'\'), NULLIF(TRIM(invoice.customerId), \'\'))', 'phone')
      .addSelect('MAX(invoice.customerName)', 'name')
      .addSelect('COUNT(invoice.id)', 'invoiceCount')
      .addSelect('COALESCE(SUM(invoice.total), 0)', 'totalSpent')
      .addSelect('COALESCE(SUM(CASE WHEN invoice.paymentStatus = \'paid\' THEN 0 ELSE COALESCE(invoice.remainingAmount, 0) END), 0)', 'totalDebt')
      .addSelect('MAX(invoice.date)', 'lastVisit')
      .where('(invoice.customerPhone IS NOT NULL AND TRIM(invoice.customerPhone) != \'\') OR (invoice.customerId IS NOT NULL AND TRIM(invoice.customerId) != \'\')')
      .groupBy('COALESCE(NULLIF(TRIM(invoice.customerPhone), \'\'), NULLIF(TRIM(invoice.customerId), \'\'))');

    if (options.branchId) {
      qb = qb.andWhere('invoice.branchId = :branchId', { branchId: options.branchId });
    }

    const raw = await qb.getRawMany();
    return raw.map(r => ({
      phone: r.phone,
      name: r.name || 'عميل',
      invoiceCount: Number(r.invoiceCount || 0),
      totalSpent: Math.round(Number(r.totalSpent || 0) * 100) / 100,
      totalDebt: Math.round(Number(r.totalDebt || 0) * 100) / 100,
      lastVisit: r.lastVisit || new Date().toISOString(),
    }));
  }
}

export const invoiceService = new InvoiceService();
