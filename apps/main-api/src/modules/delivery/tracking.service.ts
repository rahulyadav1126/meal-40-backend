import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DeliveryEntity, DeliveryPartnerEntity, OrderEntity } from '@app/database';
import { type AuthenticatedUser, DeliveryStatus, UserRole } from '@app/contracts';
import { IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class DeliveryLocationDto {
  @IsNumber() @Min(-90) @Max(90) latitude: number;
  @IsNumber() @Min(-180) @Max(180) longitude: number;
  @IsNumber() @Min(0) @Max(200) accuracy: number;
  @IsOptional() @IsNumber() @Min(0) @Max(360) heading?: number;
  @IsISO8601() recordedAt: string;
}
const ACTIVE = [DeliveryStatus.ASSIGNED, DeliveryStatus.ARRIVED_AT_MERCHANT, DeliveryStatus.PICKED_UP, DeliveryStatus.OUT_FOR_DELIVERY, DeliveryStatus.ARRIVED_AT_CUSTOMER];
type Point = { latitude: number; longitude: number };
type MapResult = { image: string | null; distanceMeters: number | null; durationSeconds: number | null; routeAvailable: boolean; message: string | null };

@Injectable()
export class TrackingService {
  // Short-lived, bounded provider cache; authorization is always checked before use.
  private readonly maps = new Map<string, { expires: number; promise: Promise<MapResult> }>();
  constructor(private readonly db: DataSource, private readonly config: ConfigService) {}

  async publish(userId: number, deliveryId: number, dto: DeliveryLocationDto) {
    const age = Date.now() - Date.parse(dto.recordedAt);
    if (!Number.isFinite(age) || age < -15000 || age > 60000) throw new BadRequestException('Send a fresh GPS position');
    return this.db.transaction(async manager => {
      const partner = await manager.findOneBy(DeliveryPartnerEntity, { userId });
      if (!partner) throw new NotFoundException('Active delivery not found');
      const delivery = await manager.getRepository(DeliveryEntity).createQueryBuilder('d').addSelect('d.lastLocation')
        .where('d.id = :id AND d.deliveryPartnerId = :partnerId', { id: deliveryId, partnerId: partner.id }).setLock('pessimistic_write').getOne();
      if (!delivery || !ACTIVE.includes(delivery.status)) throw new NotFoundException('Active delivery not found');
      if (delivery.lastLocation && Date.parse(dto.recordedAt) <= Date.parse(delivery.lastLocation.recordedAt)) return { accepted: false, reason: 'OLDER_POSITION' };
      if (delivery.lastLocation && Date.now() - Date.parse(delivery.lastLocation.receivedAt) < 4000) return { accepted: false, reason: 'TOO_FREQUENT' };
      delivery.lastLocation = { ...dto, receivedAt: new Date().toISOString() };
      await manager.save(delivery);
      return { accepted: true };
    });
  }

  async snapshot(user: AuthenticatedUser, orderId: number) {
    const order = await this.db.getRepository(OrderEntity).findOne({ where: { id: orderId }, relations: { restaurant: true, address: true } });
    if (!order) throw new NotFoundException('Order not found');
    const delivery = await this.db.getRepository(DeliveryEntity).createQueryBuilder('d').addSelect('d.lastLocation').where('d.orderId = :orderId', { orderId }).getOne();
    const partner = user.role === UserRole.DELIVERY_PARTNER ? await this.db.getRepository(DeliveryPartnerEntity).findOneBy({ userId: user.sub }) : null;
    const authorized = user.role === UserRole.ADMIN || (user.role === UserRole.CUSTOMER && Number(order.customerId) === Number(user.sub)) ||
      (user.role === UserRole.MERCHANT && Number(order.restaurant.merchantId) === Number(user.sub)) ||
      (partner && delivery?.deliveryPartnerId && Number(partner.id) === Number(delivery.deliveryPartnerId));
    if (!authorized) throw new NotFoundException('Order not found');
    const address = order.addressSnapshot ?? order.address;
    const pickup = this.point(order.restaurant);
    const dropoff = this.point(address);
    const active = !!delivery && ACTIVE.includes(delivery.status);
    const location = active ? delivery.lastLocation : null;
    const stale = !location || Date.now() - Date.parse(location.recordedAt) > 90000;
    const leg = delivery && [DeliveryStatus.ASSIGNED, DeliveryStatus.ARRIVED_AT_MERCHANT].includes(delivery.status) ? 'PICKUP' : 'DROPOFF';
    const rider = location ? { ...location } : null;
    const destination = leg === 'PICKUP' ? pickup : dropoff;
    const origin = !stale && rider ? this.point(rider) : null;
    let map: MapResult = { image: null, routeAvailable: false, durationSeconds: null, distanceMeters: null, message: active ? 'Waiting for a fresh rider location' : 'Live tracking starts after assignment and stops when the delivery ends' };
    if (active && pickup && dropoff) {
      const cacheKey = `${orderId}:${delivery!.id}:${leg}:${stale ? 'stale' : 'fresh'}`;
      let cached = this.maps.get(cacheKey);
      if (!cached || cached.expires <= Date.now()) {
        for (const [key, value] of this.maps) if (value.expires <= Date.now()) this.maps.delete(key);
        if (this.maps.size >= 200) this.maps.delete(this.maps.keys().next().value!);
        cached = { expires: Date.now() + 20000, promise: this.renderMap(pickup, dropoff, origin, destination!) };
        this.maps.set(cacheKey, cached);
      }
      map = await cached.promise;
    }
    return { orderId, deliveryId: delivery?.id ?? null, status: delivery?.status ?? null, active, leg, pickup, dropoff, rider, stale,
      map, polledAt: new Date().toISOString(), navigationUrl: active && destination ? `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving` : null };
  }

  private point(value: { latitude: string | number; longitude: string | number } | null | undefined): Point | null {
    if (!value || value.latitude === null || value.longitude === null) return null;
    const latitude = Number(value.latitude), longitude = Number(value.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
  }

  private async renderMap(pickup: Point, dropoff: Point, rider: Point | null, destination: Point): Promise<MapResult> {
    const result: MapResult = { image: null, distanceMeters: null, durationSeconds: null, routeAvailable: false, message: null };
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!key) return { ...result, message: 'Google Maps is not configured. Navigation is still available.' };
    let polyline: string | null = null;
    if (rider) {
      try {
        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', signal: AbortSignal.timeout(5000),
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline' },
          body: JSON.stringify({ origin: { location: { latLng: rider } }, destination: { location: { latLng: destination } }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', polylineQuality: 'OVERVIEW' }) });
        if (!response.ok) throw new Error('Provider unavailable');
        const data = await response.json() as { routes?: Array<{ duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }> };
        const route = data.routes?.[0];
        polyline = route?.polyline?.encodedPolyline ?? null;
        result.routeAvailable = !!polyline;
        result.distanceMeters = route?.distanceMeters ?? null;
        result.durationSeconds = route?.duration ? Number(route.duration.replace(/s$/, '')) : null;
      } catch { result.message = 'Road route temporarily unavailable; showing location markers only.'; }
    } else result.message = 'Waiting for a fresh rider location. No live ETA is available.';
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
      url.searchParams.set('key', key); url.searchParams.set('size', '640x400'); url.searchParams.set('scale', '2'); url.searchParams.set('format', 'png');
      url.searchParams.append('markers', `color:green|label:S|${pickup.latitude},${pickup.longitude}`);
      url.searchParams.append('markers', `color:red|label:D|${dropoff.latitude},${dropoff.longitude}`);
      if (rider) url.searchParams.append('markers', `color:blue|label:R|${rider.latitude},${rider.longitude}`);
      if (polyline) url.searchParams.set('path', `color:0x164e63ff|weight:5|enc:${polyline}`);
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Map unavailable');
      result.image = `data:image/png;base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
    } catch { result.message = 'Map unavailable. Check Maps Static API access; use navigation below.'; }
    return result;
  }
}
