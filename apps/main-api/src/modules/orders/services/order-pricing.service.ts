import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscountType, ErrorCode } from '@app/contracts';
import { DomainException, Money } from '@app/common';
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
  ): OrderPricing {
    const priced = items.map(({ menuItem, quantity }) => {
      const unitPrice = Money.fromDecimal(
        menuItem.discountedPrice ?? menuItem.price,
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
      discount =
        coupon.discountType === DiscountType.FIXED
          ? Money.fromDecimal(coupon.discountValue)
          : subtotal.percentage(coupon.discountValue);
      if (coupon.maximumDiscount)
        discount = discount.min(Money.fromDecimal(coupon.maximumDiscount));
      discount = discount.min(subtotal);
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
