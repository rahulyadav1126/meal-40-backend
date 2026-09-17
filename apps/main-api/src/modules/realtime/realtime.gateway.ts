import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Repository } from 'typeorm';
import type { Server, Socket } from 'socket.io';
import { SOCKET_ROOM, type JwtPayload, UserRole } from '@app/contracts';
import { RestaurantEntity } from '@app/database';
@WebSocketGateway({ cors: false })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RestaurantEntity)
    private readonly restaurants: Repository<RestaurantEntity>,
  ) {}
  async handleConnection(client: Socket) {
    try {
      const token = this.token(client);
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
      await client.join(`${SOCKET_ROOM.USER}:${payload.sub}`);
      if (payload.role === UserRole.ADMIN) await client.join(SOCKET_ROOM.ADMIN);
      if (payload.role === UserRole.MERCHANT) {
        const restaurants = await this.restaurants.find({
          where: { merchantId: payload.sub },
          select: { id: true },
        });
        await Promise.all(
          restaurants.map((restaurant) =>
            client.join(`${SOCKET_ROOM.RESTAURANT}:${restaurant.id}`),
          ),
        );
      }
      client.data.user = payload;
    } catch {
      client.disconnect(true);
    }
  }
  emitToRestaurant(restaurantId: number, event: string, data: unknown) {
    this.server
      .to(`${SOCKET_ROOM.RESTAURANT}:${restaurantId}`)
      .emit(event, data);
  }
  emitToUser(userId: number, event: string, data: unknown) {
    this.server.to(`${SOCKET_ROOM.USER}:${userId}`).emit(event, data);
  }
  emitToAdmin(event: string, data: unknown) {
    this.server.to(SOCKET_ROOM.ADMIN).emit(event, data);
  }
  private token(client: Socket): string {
    const value: unknown = client.handshake.auth.token;
    if (typeof value !== 'string') throw new Error('Missing token');
    return value.startsWith('Bearer ') ? value.slice(7) : value;
  }
}
