export interface MenuPriceSource {
  price: string; discountedPrice?: string | null;
  discountStartsAt?: Date | string | null; discountEndsAt?: Date | string | null;
}
/** One pricing rule for discovery, cart, quotes and persisted order items. */
export function menuPrice(item: MenuPriceSource, now = new Date()) {
  const active = item.discountedPrice != null && (!item.discountStartsAt || new Date(item.discountStartsAt) <= now) && (!item.discountEndsAt || new Date(item.discountEndsAt) > now);
  return { discountedPrice: active ? item.discountedPrice! : null, effectivePrice: active ? item.discountedPrice! : item.price, hasActiveDiscount: active };
}
