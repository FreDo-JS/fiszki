import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

export async function getDashboard() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalUsers, activeUsers, blockedUsers, totalDecks, totalCards, totalReviews, reviewsLast7Days] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastStudyDate: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { status: 'BLOCKED' } }),
      prisma.deck.count(),
      prisma.card.count(),
      prisma.review.count(),
      prisma.review.count({ where: { reviewedAt: { gte: sevenDaysAgo } } }),
    ]);

  return { totalUsers, activeUsers, blockedUsers, totalDecks, totalCards, totalReviews, reviewsLast7Days };
}

export async function listUsers(filters: { search?: string; page: number; pageSize: number }) {
  const where = filters.search
    ? {
        OR: [
          { username: { contains: filters.search, mode: 'insensitive' as const } },
          { email: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        currentStreak: true,
        _count: { select: { decks: true, reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      currentStreak: u.currentStreak,
      deckCount: u._count.decks,
      reviewCount: u._count.reviews,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

async function assertNotSelf(adminId: string, targetId: string, message: string) {
  if (adminId === targetId) throw ApiError.badRequest(message);
}

export async function setUserStatus(adminId: string, userId: string, status: 'ACTIVE' | 'BLOCKED') {
  await assertNotSelf(adminId, userId, 'Nie możesz zablokować własnego konta');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('Użytkownik nie istnieje');
  return prisma.user.update({ where: { id: userId }, data: { status } });
}

export async function setUserRole(adminId: string, userId: string, role: 'USER' | 'ADMIN') {
  await assertNotSelf(adminId, userId, 'Nie możesz zmienić własnej roli');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('Użytkownik nie istnieje');
  return prisma.user.update({ where: { id: userId }, data: { role } });
}

export async function deleteUser(adminId: string, userId: string) {
  await assertNotSelf(adminId, userId, 'Nie możesz usunąć własnego konta');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('Użytkownik nie istnieje');
  await prisma.user.delete({ where: { id: userId } });
}
