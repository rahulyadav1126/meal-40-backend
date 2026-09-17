import { describe, expect, it } from 'vitest';
import { ORDER_TRANSITIONS } from '../../libs/contracts/src/constants.js';
import { OrderStatus } from '../../libs/contracts/src/enums.js';

describe('order transition policy', () => {
  it('allows the normal order lifecycle', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.PENDING]).toContain(OrderStatus.ACCEPTED);
    expect(ORDER_TRANSITIONS[OrderStatus.READY]).toContain(OrderStatus.OUT_FOR_DELIVERY);
  });
  it('prevents terminal orders from moving backwards', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.DELIVERED]).not.toContain(OrderStatus.PREPARING);
    expect(ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });
});
