import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { enqueueEvent } from '../../realtime/outbox.js';
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
    afterTransition?: (manager: EntityManager, updated: OrderEntity) => Promise<void>,
  ): Promise<OrderEntity> {
    return this.orders.manager.transaction(async (manager) => {
    const current = await manager.findOneOrFail(OrderEntity, { where: { id: order.id }, lock: { mode: 'pessimistic_write' } });
    if (current.orderStatus === to) return current;
    if (current.orderStatus !== order.orderStatus) throw new ConflictException('Order changed. Refresh and retry.');
    const from = current.orderStatus;
    if (!this.canTransition(from, to))
      throw new DomainException(
        ErrorCode.INVALID_ORDER_STATUS_TRANSITION,
        `Cannot transition order from ${from} to ${to}`,
      );
    current.orderStatus = to;
    if (to === OrderStatus.CANCELLED) current.cancellationReason = note ?? null;
    this.setTimestamp(current, to);
      await manager.save(OrderEntity, current);
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
      if (afterTransition) await afterTransition(manager, current);
      const event = `order.${to.toLowerCase()}`;
      await enqueueEvent(manager, 'user', current.customerId, event, { id: current.id });
      await enqueueEvent(manager, 'restaurant', current.restaurantId, event, { id: current.id });
      await enqueueEvent(manager, 'admin', null, event, { id: current.id });
      return current;
    });
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
