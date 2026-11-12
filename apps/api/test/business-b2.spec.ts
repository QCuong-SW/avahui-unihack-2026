import { UsersService } from '../src/modules/users/services/users.service';
import { AutonomousKeeperService } from '../src/modules/blockchain/services/autonomous-keeper.service';

describe('Stage B2 — Credit Score & Deadline Reminders', () => {
  it('computes ROSCA credit score and tier from on-chain history', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          privyDid: 'did:privy:u1',
          role: 'MEMBER',
          isActive: true,
          email: 'u1@avahui.io',
          displayName: 'Builder 1',
          avatarUrl: null,
          team1Verified: true,
          identityNullifier: '0x1234',
          trustTier: 2,
          wallets: [
            {
              id: 'w1',
              address: '0x1111111111111111111111111111111111111111',
              walletClientType: 'privy',
              isPrimary: true,
            },
          ],
        }),
      },
      circleMember: {
        count: jest
          .fn()
          .mockResolvedValueOnce(1) // activeCirclesCount
          .mockResolvedValueOnce(2), // completedCirclesCount
        aggregate: jest.fn().mockResolvedValue({ _sum: { defaultCount: 0 } }),
      },
      contribution: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: BigInt(250_000000) },
          _count: { _all: 5 },
        }),
      },
      collateral: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { currentLockedAmount: BigInt(50_000000) } }),
      },
      payout: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: BigInt(450_000000) } }),
      },
    };

    const usersService = new UsersService(mockPrisma);
    const profile = await usersService.getUserProfileById('u1');

    expect(profile.stats.completedCirclesCount).toBe(2);
    expect(profile.stats.onTimePaymentsCount).toBe(5);
    expect(profile.stats.defaultCount).toBe(0);
    // 500 + 5*25 + 2*80 + 100 = 885
    expect(profile.stats.creditScore).toBe(885);
    expect(profile.stats.creditTier).toBe('EXPERT');

    const penalized = usersService.computeRoscaCreditProfile({
      completedCirclesCount: 0,
      onTimePaymentsCount: 0,
      defaultCount: 2,
      team1Verified: false,
    });
    expect(penalized.creditScore).toBe(200);
    expect(penalized.creditTier).toBe('NEW');
  });

  it('sends contribution and bidding reminders once per member per round', async () => {
    const now = new Date('2026-11-12T10:00:00Z');
    const createdNotifs: any[] = [];

    const mockPrisma: any = {
      round: {
        findMany: jest.fn().mockResolvedValue([
          {
            circleId: 'c1',
            roundNumber: 2,
            contributionDeadline: new Date(now.getTime() + 45_000), // 45s left <= 20% of 300s (60s)
            biddingDeadline: new Date(now.getTime() + 20_000), // 20s left <= 25% of 120s (30s)
            circle: {
              name: 'Fuji Test Circle',
              allocationMode: 'BIDDING',
              roundDurationSeconds: 300,
              biddingDurationSeconds: 120,
              members: [
                {
                  userId: 'u1',
                  memberAddress: '0x1111111111111111111111111111111111111111',
                  hasReceivedPayout: true,
                },
                {
                  userId: 'u2',
                  memberAddress: '0x2222222222222222222222222222222222222222',
                  hasReceivedPayout: false,
                },
              ],
            },
            contributions: [
              { memberAddress: '0x1111111111111111111111111111111111111111' },
            ],
            bids: [],
          },
        ]),
      },
      notification: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(
            createdNotifs
              .filter(
                (n) =>
                  n.circleId === where.circleId && n.title === where.title,
              )
              .map((n) => ({ userId: n.userId })),
          );
        }),
        createMany: jest.fn().mockImplementation(({ data }: any) => {
          createdNotifs.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
    };

    const keeper = new AutonomousKeeperService(mockPrisma);

    const firstRun = await keeper.sendDeadlineReminders(now);
    // u2 gets both contribution reminder & bidding reminder
    expect(firstRun).toBe(2);
    expect(createdNotifs).toHaveLength(2);
    expect(createdNotifs.every((n) => n.userId === 'u2')).toBe(true);

    // Running again should not duplicate reminders
    const secondRun = await keeper.sendDeadlineReminders(now);
    expect(secondRun).toBe(0);
    expect(createdNotifs).toHaveLength(2);
  });
});

