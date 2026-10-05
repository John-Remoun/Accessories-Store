import { Request, Response, NextFunction } from 'express';
import { CustomerService } from './customer.service';
import { sendResponse } from '../../common/utils/response.utils';

const customerService = new CustomerService();

export class CustomerController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const customers = await customerService.getAllCustomers();
      return sendResponse(res, 200, 'Customers retrieved successfully', customers);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const customer = await customerService.getCustomerById(id);
      return sendResponse(res, 200, 'Customer retrieved successfully', customer);
    } catch (error) {
      next(error);
    }
  }

  public async createOrUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await customerService.createOrUpdateCustomer(req.body);
      return sendResponse(res, 201, 'Customer saved successfully', customer);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const idOrPhone = req.params.idOrPhone as string;
      const result = await customerService.deleteCustomer(idOrPhone);
      return sendResponse(res, 200, 'Customer deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
