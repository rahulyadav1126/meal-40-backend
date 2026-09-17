export class Money {
  private constructor(private readonly minorUnits: bigint) {}
  static fromDecimal(value: string | number): Money {
    const normalized = String(value).trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(normalized))
      throw new Error('Invalid money value');
    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [whole, fraction = ''] = unsigned.split('.');
    const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    return new Money(negative ? -minor : minor);
  }
  add(other: Money): Money {
    return new Money(this.minorUnits + other.minorUnits);
  }
  subtract(other: Money): Money {
    return new Money(this.minorUnits - other.minorUnits);
  }
  multiply(quantity: number): Money {
    if (!Number.isInteger(quantity))
      throw new Error('Quantity must be an integer');
    return new Money(this.minorUnits * BigInt(quantity));
  }
  percentage(rate: string | number): Money {
    const basisPoints = Math.round(Number(rate) * 100);
    return new Money((this.minorUnits * BigInt(basisPoints) + 5000n) / 10000n);
  }
  min(other: Money): Money {
    return this.minorUnits <= other.minorUnits ? this : other;
  }
  isLessThan(other: Money): boolean {
    return this.minorUnits < other.minorUnits;
  }
  toMinorUnitsNumber(): number {
    const value = Number(this.minorUnits);
    if (!Number.isSafeInteger(value))
      throw new Error('Money value exceeds safe payment-provider range');
    return value;
  }
  toDecimal(): string {
    const absolute = this.minorUnits < 0n ? -this.minorUnits : this.minorUnits;
    return `${this.minorUnits < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
  }
}
