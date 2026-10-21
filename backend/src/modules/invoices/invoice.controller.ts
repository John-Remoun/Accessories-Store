import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from './invoice.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';
import { AppError } from '../../common/exceptions/app-error';

const invoiceService = new InvoiceService();

export class InvoiceController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
      const scope = await resolveBranchScope(req, req.query.branchId as string);
      const effectiveBranchId = scope.isGlobalAdmin ? (req.query.branchId as string) : scope.branchId;

      if (req.query.page || req.query.limit || req.query.search || req.query.startDate || req.query.endDate || req.query.paymentStatus || req.query.isFavorite) {
        const paginated = await invoiceService.getPaginatedInvoices({
          page: req.query.page ? Number(req.query.page) : 1,
          limit: req.query.limit ? Number(req.query.limit) : 20,
          branchId: effectiveBranchId,
          search: req.query.search as string,
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
          paymentStatus: req.query.paymentStatus as string,
          isFavorite: req.query.isFavorite !== undefined ? req.query.isFavorite === 'true' : undefined,
          employeeId: !scope.isGlobalAdmin && scope.user.role === 'employee' ? scope.user.userId : undefined,
        });
        return sendResponse(res, 200, 'Invoices retrieved successfully', paginated);
      }

      // Legacy unpaginated endpoint: strictly bound to user's assigned branch for non-admins
      const invoices = effectiveBranchId
        ? await invoiceService.getInvoicesByBranch(effectiveBranchId)
        : await invoiceService.getAllInvoices();
      return sendResponse(res, 200, 'Invoices retrieved successfully', invoices);
    } catch (error) {
      next(error);
    }
  }

  public async getByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
      const branchId = req.params.branchId as string;
      await resolveBranchScope(req, branchId);
      const invoices = await invoiceService.getInvoicesByBranch(branchId);
      return sendResponse(res, 200, 'Branch invoices retrieved successfully', invoices);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
      const id = req.params.id as string;
      const invoice = await invoiceService.getInvoiceById(id);
      // Strictly verify that the invoice belongs to the user's permitted branch
      await resolveBranchScope(req, invoice.branchId);
      return sendResponse(res, 200, 'Invoice retrieved successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req, req.body.branchId);
      if (!scope.isGlobalAdmin) {
        req.body.branchId = scope.branchId;
      }
      const invoice = await invoiceService.createInvoice(req.body);
      return sendResponse(res, 201, 'Invoice created successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async deleteMany(req: Request, res: Response, next: NextFunction) {
    try {
      const rawIds = req.body?.ids || req.body?.id || (req.params?.id ? [req.params.id] : []);
      const idsArray = Array.isArray(rawIds) ? rawIds : [rawIds].filter(Boolean);
      const result = await invoiceService.deleteInvoicesByIds(idsArray);
      return sendResponse(res, 200, 'Invoices deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async toggleFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await invoiceService.getInvoiceById(id);
      await resolveBranchScope(req, existing.branchId);
      const invoice = await invoiceService.toggleFavorite(id);
      return sendResponse(res, 200, 'Invoice favorite status updated', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async paySingleInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await invoiceService.getInvoiceById(id);
      await resolveBranchScope(req, existing.branchId);
      const { amount } = req.body;
      const invoice = await invoiceService.payInvoice(id, Number(amount));
      return sendResponse(res, 200, 'Payment applied to invoice successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async payCustomerDebt(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerPhone, amount, branchId } = req.body;
      const scope = await resolveBranchScope(req, branchId);
      const effectiveBranchId = scope.isGlobalAdmin ? (branchId ? String(branchId).trim() : undefined) : scope.branchId;
      const result = await invoiceService.payCustomerDebt(customerPhone, Number(amount), effectiveBranchId);
      return sendResponse(res, 200, 'Customer debt payment applied successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await invoiceService.getInvoiceById(id);
      const scope = await resolveBranchScope(req, existing.branchId);
      if (!scope.isGlobalAdmin && req.body.branchId && req.body.branchId !== scope.branchId) {
        throw new AppError(`Forbidden: You cannot transfer invoice to branch '${req.body.branchId}'`, 403);
      }
      const invoice = await invoiceService.updateInvoice(id, req.body);
      return sendResponse(res, 200, 'Invoice updated successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  public async getReportsSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req, req.query.branchId as string);
      const effectiveBranchId = scope.isGlobalAdmin ? (req.query.branchId as string) : scope.branchId;

      const summary = await invoiceService.getReportsSummary({
        branchId: effectiveBranchId,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        year: req.query.year ? Number(req.query.year) : undefined,
        month: req.query.month !== undefined ? Number(req.query.month) : undefined,
      });
      return sendResponse(res, 200, 'Reports summary retrieved successfully', summary);
    } catch (error) {
      next(error);
    }
  }

  public async getCustomerStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req, req.query.branchId as string);
      const effectiveBranchId = scope.isGlobalAdmin ? (req.query.branchId as string) : scope.branchId;

      const statement = await invoiceService.getCustomerStatement({
        phone: req.query.phone as string,
        name: req.query.name as string,
        branchId: effectiveBranchId,
      });
      return sendResponse(res, 200, 'Customer statement retrieved successfully', statement);
    } catch (error) {
      next(error);
    }
  }

  public async getCustomerSummaries(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req, req.query.branchId as string);
      const effectiveBranchId = scope.isGlobalAdmin ? (req.query.branchId as string) : scope.branchId;

      const summaries = await invoiceService.getCustomerSummaries({
        branchId: effectiveBranchId,
      });
      return sendResponse(res, 200, 'Customer summaries retrieved successfully', summaries);
    } catch (error) {
      next(error);
    }
  }
}

