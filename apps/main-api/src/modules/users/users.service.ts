import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '@app/database';
import { Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/users.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}
  async me(userId: number) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status, createdAt: user.createdAt };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.phone !== undefined) user.phone = dto.phone;

    await this.users.save(user);

    return this.me(userId);
  }
}
