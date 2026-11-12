import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getMyNotifications(authUser: AuthenticatedUser) {
    const profile = await this.usersService.getCurrentUserProfile(authUser);

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId: profile.id, isRead: false },
      }),
    ]);

    return {
      unreadCount,
      items: items.map((n) => ({
        id: n.id,
        userId: n.userId,
        circleId: n.circleId,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async markAsRead(authUser: AuthenticatedUser, id: string) {
    const profile = await this.usersService.getCurrentUserProfile(authUser);

    const existing = await this.prisma.notification.findFirst({
      where: { id, userId: profile.id },
    });

    if (!existing) {
      throw new NotFoundException(`Notification "${id}" not found`);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      circleId: updated.circleId,
      title: updated.title,
      body: updated.body,
      isRead: updated.isRead,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async markAllAsRead(authUser: AuthenticatedUser) {
    const profile = await this.usersService.getCurrentUserProfile(authUser);
    const result = await this.prisma.notification.updateMany({
      where: { userId: profile.id, isRead: false },
      data: { isRead: true },
    });
    return { updatedCount: result.count };
  }
}

