import { describe, expect, it } from 'vitest';
import { Money } from '../../libs/common/src/utils/money.util.js';

describe('Money', () => {
  it('calculates totals without floating-point drift', () => {
    const total = Money.fromDecimal('40.10').multiply(3).add(Money.fromDecimal('0.20'));
    expect(total.toDecimal()).toBe('120.50');
  });
  it('rounds percentages to the nearest paisa', () => {
    expect(Money.fromDecimal('99.99').percentage('5').toDecimal()).toBe('5.00');
  });
});
