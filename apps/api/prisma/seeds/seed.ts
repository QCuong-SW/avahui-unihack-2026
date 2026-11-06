import { PrismaClient, AllocationMode, CircleStatus, RoundStatus, MemberStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding AvaHui demo data...');

  const demoUsers = [
    {
      privyDid: 'did:privy:usr_01HXYZ1',
      email: 'builder@avahui.io',
      displayName: 'Minh Nguyễn (UniHack Builder)',
      walletAddress: '0x71c95911e9a5d330f4d621842ec243ee13432921',
    },
    {
      privyDid: 'did:privy:usr_02',
      email: 'hoang@avahui.io',
      displayName: 'Hoàng Lê',
      walletAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    },
    {
      privyDid: 'did:privy:usr_03',
      email: 'tuan@avahui.io',
      displayName: 'Tuấn Phạm',
      walletAddress: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
    },
    {
      privyDid: 'did:privy:usr_04',
      email: 'an@avahui.io',
      displayName: 'An Trần',
      walletAddress: '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
    },
    {
      privyDid: 'did:privy:usr_05',
      email: 'bao@avahui.io',
      displayName: 'Bảo Đặng',
      walletAddress: '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc',
    },
  ];

  const createdUsers: Record<string, string> = {};
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { privyDid: u.privyDid },
      update: { displayName: u.displayName, email: u.email },
      create: {
        privyDid: u.privyDid,
        email: u.email,
        displayName: u.displayName,
        wallets: {
          create: {
            address: u.walletAddress.toLowerCase(),
            walletClientType: 'privy',
            isPrimary: true,
          },
        },
      },
    });
    createdUsers[u.walletAddress.toLowerCase()] = user.id;
  }

  // Circle 1: Active Bidding Circle (Round 2/5)
  const circle1 = await prisma.circle.upsert({
    where: { metadataId: 'meta_001' },
    update: {},
    create: {
      metadataId: 'meta_001',
      contractAddress: '0x9a676e781a523b5d0c0e43731313a708cb607508',
      chainId: 43113,
      name: 'Hụi Đầu Tư Avalanche Builders — Kỳ Ngắn',
      description: 'Dây hụi 5 người chế độ đấu giá chiết khấu tại Avalanche UniHack 2026 TP.HCM.',
      creatorAddress: demoUsers[0].walletAddress.toLowerCase(),
      tokenAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      allocationMode: AllocationMode.BIDDING,
      status: CircleStatus.ACTIVE,
      maxMembers: 5,
      currentMemberCount: 5,
      currentRound: 2,
      totalRounds: 5,
      contributionAmount: '100000000',
      collateralAmount: '100000000',
      roundDurationSeconds: 300,
      biddingDurationSeconds: 180,
      gracePeriodSeconds: 60,
      startDeadline: new Date(Date.now() + 86400 * 1000),
      minBid: '2000000',
      maxBid: '40000000',
      totalDiscountPool: '15000000',
      creationTxHash: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      activatedAt: new Date(Date.now() - 3600 * 1000),
    },
  });

  for (let i = 0; i < demoUsers.length; i++) {
    const addr = demoUsers[i].walletAddress.toLowerCase();
    const member = await prisma.circleMember.upsert({
      where: {
        circleId_memberAddress: {
          circleId: circle1.id,
          memberAddress: addr,
        },
      },
      update: {},
      create: {
        circleId: circle1.id,
        userId: createdUsers[addr],
        memberAddress: addr,
        slotIndex: i + 1,
        status: MemberStatus.ACTIVE,
        hasReceivedPayout: i === 1,
        wonRoundNumber: i === 1 ? 1 : null,
        defaultCount: 0,
        joinTxHash: `0xjoin00000000000000000000000000000000000000000000000000000000000${i + 1}`,
      },
    });

    await prisma.collateral.upsert({
      where: { memberId: member.id },
      update: {},
      create: {
        circleId: circle1.id,
        memberId: member.id,
        memberAddress: addr,
        initialLockedAmount: '100000000',
        currentLockedAmount: '100000000',
        totalSlashedAmount: '0',
      },
    });
  }

  // Round 1 (Settled) & Round 2 (Open)
  const r1 = await prisma.round.upsert({
    where: { circleId_roundNumber: { circleId: circle1.id, roundNumber: 1 } },
    update: {},
    create: {
      circleId: circle1.id,
      roundNumber: 1,
      status: RoundStatus.SETTLED,
      startTime: new Date(Date.now() - 3600 * 1000),
      contributionDeadline: new Date(Date.now() - 3300 * 1000),
      biddingDeadline: new Date(Date.now() - 3420 * 1000),
      graceDeadline: new Date(Date.now() - 3240 * 1000),
      winnerAddress: demoUsers[1].walletAddress.toLowerCase(),
      grossPotAmount: '500000000',
      winningBidAmount: '15000000',
      netPayoutAmount: '485000000',
      settledAt: new Date(Date.now() - 3200 * 1000),
      settlementTxHash: '0x88a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01',
    },
  });

  await prisma.payout.upsert({
    where: { roundId: r1.id },
    update: {},
    create: {
      circleId: circle1.id,
      roundId: r1.id,
      roundNumber: 1,
      recipientAddress: demoUsers[1].walletAddress.toLowerCase(),
      grossAmount: '500000000',
      discountAmount: '15000000',
      netAmount: '485000000',
      txHash: '0x88a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01',
    },
  });

  await prisma.round.upsert({
    where: { circleId_roundNumber: { circleId: circle1.id, roundNumber: 2 } },
    update: {},
    create: {
      circleId: circle1.id,
      roundNumber: 2,
      status: RoundStatus.OPEN,
      startTime: new Date(),
      contributionDeadline: new Date(Date.now() + 3600 * 1000),
      biddingDeadline: new Date(Date.now() + 1800 * 1000),
      graceDeadline: new Date(Date.now() + 4200 * 1000),
      grossPotAmount: '500000000',
      winningBidAmount: '12000000',
      netPayoutAmount: '488000000',
    },
  });

  // Circle 2: Recruiting Fixed Circle
  await prisma.circle.upsert({
    where: { metadataId: 'meta_002' },
    update: {},
    create: {
      metadataId: 'meta_002',
      contractAddress: '0x0b306bf915c4d645ff596e518faf3f9669b97016',
      chainId: 43113,
      name: 'Hụi Xoay Vòng Cố Định — Sinh Viên TP.HCM',
      description: 'Mỗi kỳ đóng 50 mUSDC, nhận lần lượt theo thứ tự tham gia, không cần đấu giá.',
      creatorAddress: demoUsers[1].walletAddress.toLowerCase(),
      tokenAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      allocationMode: AllocationMode.FIXED,
      status: CircleStatus.RECRUITING,
      maxMembers: 5,
      currentMemberCount: 3,
      currentRound: 0,
      totalRounds: 5,
      contributionAmount: '50000000',
      collateralAmount: '50000000',
      roundDurationSeconds: 180,
      biddingDurationSeconds: 0,
      gracePeriodSeconds: 60,
      startDeadline: new Date(Date.now() + 86400 * 1000),
      minBid: '0',
      maxBid: '0',
      totalDiscountPool: '0',
    },
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

