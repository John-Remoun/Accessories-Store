import { AppDataSource } from '../../config/data-source';
import { InvoiceEntity, InvoiceItemPayload } from './invoice.entity';
import { InvoiceItemEntity } from './invoice-item.entity';
import { PhysicalItemEntity } from '../physical-items/physical-item.entity';
import { ProductBranchDataEntity } from '../products/product-branch-data.entity';
import { UserEntity } from '../users/user.entity';
import { AppError } from '../../common/exceptions/app-error';

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

    return await AppDataSource.transaction(async (transactionalEntityManager) => {
      const id = data.id || `inv_${Date.now()}`;
      const invoiceNumber = data.invoiceNumber || Math.floor(10000000 + Math.random() * 90000000).toString();
      const date = data.date || new Date().toISOString();
      const discount = data.discount || 0;
      let computedSubtotal = 0;
      let computedTotalCost = 0;
      let computedNetProfit = 0;

      const invoiceItemEntities: InvoiceItemEntity[] = [];

      // Process each invoice line item
      for (const itemPayload of data.items) {
        let physicalItemId = itemPayload.physicalItemId && itemPayload.physicalItemId.trim() ? itemPayload.physicalItemId.trim() : '';
        let physicalItem = null;

        if (physicalItemId) {
          physicalItem = await transactionalEntityManager.findOne(PhysicalItemEntity, {
            where: { id: physicalItemId }
          });
        }
        if (!physicalItem && itemPayload.productId) {
          physicalItem = await transactionalEntityManager.findOne(PhysicalItemEntity, {
            where: { productId: itemPayload.productId, branchId: data.branchId || 'b1' }
          });
        }

        if (physicalItem) {
          physicalItemId = physicalItem.id;
        } else if (!physicalItemId) {
          physicalItemId = `PHYS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // Fetch product cost for accurate historical profit tracking
        const branchData = itemPayload.productId ? await transactionalEntityManager.findOne(ProductBranchDataEntity, {
          where: { productId: itemPayload.productId, branchId: data.branchId || 'b1' },
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

        // Create relational InvoiceItem Entity
        const invoiceItem = transactionalEntityManager.create(InvoiceItemEntity, {
          invoiceId: id,
          productId: itemPayload.productId || 'p1',
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

      // Increment Employee Sales Count atomically inside the transaction if user exists
      if (data.employeeId) {
        try {
          await transactionalEntityManager.increment(UserEntity, { id: data.employeeId }, 'salesCount', 1);
        } catch (e) {
          console.warn('Could not increment user salesCount:', e);
        }
      }

      return this.formatInvoiceResponse(invoice);
    });
  }

  public async deleteInvoicesByIds(ids: string[]) {
    if (!ids || ids.length === 0) return { success: true };

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      for (const id of ids) {
        const invoice = await transactionalEntityManager.findOne(InvoiceEntity, {
          where: { id },
          relations: ['invoiceItems'],
        });

        if (invoice) {
          // Revert physical items to available
          if (invoice.invoiceItems && invoice.invoiceItems.length > 0) {
            const itemIds = invoice.invoiceItems.map((i) => i.physicalItemId);
            await transactionalEntityManager
              .createQueryBuilder()
              .update(PhysicalItemEntity)
              .set({ status: 'available' })
              .where('id IN (:...itemIds)', { itemIds })
              .execute();
          }

          // Decrement employee sales count
          if (invoice.employeeId) {
            await transactionalEntityManager.decrement(UserEntity, { id: invoice.employeeId }, 'salesCount', 1);
          }

          await transactionalEntityManager.remove(invoice);
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
