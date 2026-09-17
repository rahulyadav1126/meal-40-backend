import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorCode, ORDER_TRANSITIONS, OrderStatus } from '@app/contracts';
import { DomainException } from '@app/common';
import { OrderEntity, OrderStatusHistoryEntity } from '@app/database';
@Injectable()
export class OrderStateService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderStatusHistoryEntity)
    private readonly history: Repository<OrderStatusHistoryEntity>,
  ) {}
  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return ORDER_TRANSITIONS[from].includes(to);
  }
  async transition(
    order: OrderEntity,
    to: OrderStatus,
    actorUserId: number,
    note?: string,
  ): Promise<OrderEntity> {
    const from = order.orderStatus;
    if (!this.canTransition(from, to))
      throw new DomainException(
        ErrorCode.INVALID_ORDER_STATUS_TRANSITION,
        `Cannot transition order from ${from} to ${to}`,
      );
    order.orderStatus = to;
    this.setTimestamp(order, to);
    await this.orders.manager.transaction(async (manager) => {
      await manager.save(OrderEntity, order);
      await manager.save(
        OrderStatusHistoryEntity,
        manager.create(OrderStatusHistoryEntity, {
          orderId: order.id,
          oldStatus: from,
          newStatus: to,
          changedByUserId: actorUserId,
          note: note ?? null,
        }),
      );
    });
    return order;
  }
  private setTimestamp(order: OrderEntity, status: OrderStatus): void {
    const now = new Date();
    const fields: Partial<Record<OrderStatus, keyof OrderEntity>> = {
      [OrderStatus.ACCEPTED]: 'acceptedAt',
      [OrderStatus.PREPARING]: 'preparingAt',
      [OrderStatus.READY]: 'readyAt',
      [OrderStatus.OUT_FOR_DELIVERY]: 'outForDeliveryAt',
      [OrderStatus.DELIVERED]: 'deliveredAt',
      [OrderStatus.CANCELLED]: 'cancelledAt',
    };
    const field = fields[status];
    if (field) (order[field] as Date | null) = now;
  }
}
