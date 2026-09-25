import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscountType, ErrorCode } from '@app/contracts';
import { DomainException, Money, menuPrice } from '@app/common';
import type { CouponEntity, MenuItemEntity } from '@app/database';
export interface PricedItem {
  menuItem: MenuItemEntity;
  quantity: number;
  unitPrice: Money;
  total: Money;
}
export interface OrderPricing {
  items: PricedItem[];
  subtotal: Money;
  discount: Money;
  deliveryFee: Money;
  platformFee: Money;
  tax: Money;
  total: Money;
}
@Injectable()
export class OrderPricingService {
  constructor(private readonly config: ConfigService) {}
  calculate(
    items: Array<{ menuItem: MenuItemEntity; quantity: number }>,
    coupon?: CouponEntity | null,
    now = new Date(),
  ): OrderPricing {
    const priced = items.map(({ menuItem, quantity }) => {
      const unitPrice = Money.fromDecimal(
        menuPrice(menuItem, now).effectivePrice,
      );
      return {
        menuItem,
        quantity,
        unitPrice,
        total: unitPrice.multiply(quantity),
      };
    });
    const subtotal = priced.reduce(
      (sum, item) => sum.add(item.total),
      Money.fromDecimal(0),
    );
    let discount = Money.fromDecimal(0);
    if (coupon) {
      if (subtotal.isLessThan(Money.fromDecimal(coupon.minimumOrderAmount)))
        throw new DomainException(
          ErrorCode.COUPON_INVALID,
          'Minimum order amount not met',
        );
      const eligible = priced.filter(item => (!coupon.menuItemIds?.length || coupon.menuItemIds.some(id => Number(id) === Number(item.menuItem.id))) &&
        (coupon.stackWithDishDiscount || !item.unitPrice.isLessThan(Money.fromDecimal(item.menuItem.price))));
      const eligibleSubtotal = eligible.reduce((sum, item) => sum.add(item.total), Money.fromDecimal(0));
      if (eligibleSubtotal.toMinorUnitsNumber() <= 0) throw new DomainException(ErrorCode.COUPON_INVALID, 'This offer does not apply to any items in your cart');
      discount =
        coupon.discountType === DiscountType.FIXED
          ? Money.fromDecimal(coupon.discountValue)
          : eligibleSubtotal.percentage(coupon.discountValue);
      if (coupon.maximumDiscount)
        discount = discount.min(Money.fromDecimal(coupon.maximumDiscount));
      discount = discount.min(eligibleSubtotal);
    }
    const deliveryFee = Money.fromDecimal(
      this.config.getOrThrow<string>('pricing.deliveryFee'),
    );
    const platformFee = Money.fromDecimal(
      this.config.getOrThrow<string>('pricing.platformFee'),
    );
    const taxable = subtotal.subtract(discount);
    const tax = taxable.percentage(
      this.config.getOrThrow<string>('pricing.taxRatePercent'),
    );
    const total = taxable.add(deliveryFee).add(platformFee).add(tax);
    return {
      items: priced,
      subtotal,
      discount,
      deliveryFee,
      platformFee,
      tax,
      total,
    };
  }
}
