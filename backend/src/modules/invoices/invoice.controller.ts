import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from './invoice.service';
import { sendResponse } from '../../common/utils/response.utils';

const invoiceService = new InvoiceService();

export class InvoiceController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const invoices = await invoiceService.getAllInvoices();
      return sendResponse(res, 200, 'Invoices retrieved successfully', invoices);
    } catch (error) {
      next(error);
    }
  }

  public async getByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId as string;
      const invoices = await invoiceService.getInvoicesByBranch(branchId);
      return sendResponse(res, 200, 'Branch invoices retrieved successfully', invoices);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const invoice = await invoiceService.getInvoiceById(id);
      return sendResponse(res, 200, 'Invoice retrieved successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.createInvoice(req.body);
      return sendResponse(res, 201, 'Invoice created successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async deleteMany(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      const result = await invoiceService.deleteInvoicesByIds(ids);
      return sendResponse(res, 200, 'Invoices deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async toggleFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const invoice = await invoiceService.toggleFavorite(id);
      return sendResponse(res, 200, 'Invoice favorite status updated', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async paySingleInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { amount } = req.body;
      const invoice = await invoiceService.payInvoice(id, Number(amount));
      return sendResponse(res, 200, 'Payment applied to invoice successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async payCustomerDebt(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerPhone, amount } = req.body;
      const result = await invoiceService.payCustomerDebt(customerPhone, Number(amount));
      return sendResponse(res, 200, 'Customer debt payment applied successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
