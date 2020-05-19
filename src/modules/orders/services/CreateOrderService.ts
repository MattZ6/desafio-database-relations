import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Usuário não econtrado');
    }

    const productsIds = products.map(x => ({ id: x.id }));

    const storedProducts = await this.productsRepository.findAllById(
      productsIds,
    );

    if (storedProducts.length < products.length) {
      throw new AppError('Um ou mais produto(s) informado(s) não exite(m)');
    }

    const productsToUpdateStock = storedProducts.map<IProduct>(
      storedProduct => {
        const { quantity } = products.find(
          x => x.id === storedProduct.id,
        ) as IProduct;

        return {
          id: storedProduct.id,
          quantity: storedProduct.quantity - quantity,
        };
      },
    );

    if (productsToUpdateStock.some(x => x.quantity < 0)) {
      throw new AppError(
        'Um ou mais produtos não possuem essa quantidade em estoque',
      );
    }

    const order = await this.ordersRepository.create({
      customer,
      products: storedProducts.map(storedProduct => {
        const product = products.find(
          x => x.id === storedProduct.id,
        ) as IProduct;

        return {
          quantity: product.quantity,
          product_id: storedProduct.id,
          price: storedProduct.price,
        };
      }),
    });

    await this.productsRepository.updateQuantity(productsToUpdateStock);

    return order;
  }
}

export default CreateProductService;
