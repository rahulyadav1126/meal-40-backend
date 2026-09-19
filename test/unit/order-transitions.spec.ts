import { describe, expect, it } from 'vitest';
import { ORDER_TRANSITIONS } from '../../libs/contracts/src/constants.js';
import { OrderStatus } from '../../libs/contracts/src/enums.js';

describe('order transition policy', () => {
  it('allows the normal order lifecycle', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.PENDING]).toContain(
      OrderStatus.ACCEPTED,
    );
    expect(ORDER_TRANSITIONS[OrderStatus.READY]).toContain(
      OrderStatus.ASSIGNED,
    );
    expect(ORDER_TRANSITIONS[OrderStatus.ASSIGNED]).toContain(
      OrderStatus.PICKED_UP,
    );
    expect(ORDER_TRANSITIONS[OrderStatus.PICKED_UP]).toContain(
      OrderStatus.OUT_FOR_DELIVERY,
    );
    expect(ORDER_TRANSITIONS[OrderStatus.OUT_FOR_DELIVERY]).toContain(
      OrderStatus.DELIVERED,
    );
  });
  it('only allows delivery completion after dispatch', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.READY]).not.toContain(
      OrderStatus.DELIVERED,
    );
    expect(ORDER_TRANSITIONS[OrderStatus.PREPARING]).not.toContain(
      OrderStatus.DELIVERED,
    );
  });
  it('prevents terminal orders from moving backwards', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.DELIVERED]).not.toContain(
      OrderStatus.PREPARING,
    );
    expect(ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });
});
