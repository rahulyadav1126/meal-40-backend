import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_COUNTRY } from '@app/contracts';
import { AddressEntity } from '@app/database';
import type {
  CreateAddressDto,
  UpdateAddressDto,
} from './addresses.controller.js';
@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(AddressEntity)
    private readonly addresses: Repository<AddressEntity>,
  ) {}
  list(userId: number) {
    return this.addresses.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }
  async create(userId: number, dto: CreateAddressDto) {
    return this.addresses.manager.transaction(async (manager) => {
      if (dto.isDefault)
        await manager.update(AddressEntity, { userId }, { isDefault: false });
      return manager.save(
        AddressEntity,
        manager.create(AddressEntity, {
          ...dto,
          userId,
          country: DEFAULT_COUNTRY,
          isDefault: dto.isDefault ?? false,
        }),
      );
    });
  }
  async update(userId: number, id: number, dto: UpdateAddressDto) {
    const address = await this.find(userId, id);
    return this.addresses.manager.transaction(async (manager) => {
      if (dto.isDefault)
        await manager.update(AddressEntity, { userId }, { isDefault: false });
      Object.assign(address, dto);
      return manager.save(AddressEntity, address);
    });
  }
  async remove(userId: number, id: number) {
    await this.addresses.remove(await this.find(userId, id));
  }
  private async find(userId: number, id: number) {
    const address = await this.addresses.findOneBy({ id, userId });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }
}
