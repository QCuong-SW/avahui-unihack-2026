import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding AvaHui 5 EVM builder accounts & wallets...');

  const demoUsers = [
    {
      privyDid: 'did:privy:usr_01',
      email: 'minh.nguyen@avahui.io',
      displayName: 'Minh Nguyễn (Builder #1)',
      walletAddress: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
      role: UserRole.ADMIN,
    },
    {
      privyDid: 'did:privy:usr_02',
      email: 'hoang.le@avahui.io',
      displayName: 'Hoàng Lê (Builder #2)',
      walletAddress: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
      role: UserRole.VERIFIER,
    },
    {
      privyDid: 'did:privy:usr_03',
      email: 'tuan.pham@avahui.io',
      displayName: 'Tuấn Phạm (Builder #3)',
      walletAddress: '0x22d491bde2303f2f43325b2108d26f1eaba1e32b',
      role: UserRole.MEMBER,
    },
    {
      privyDid: 'did:privy:usr_04',
      email: 'an.tran@avahui.io',
      displayName: 'An Trần (Builder #4)',
      walletAddress: '0xe11ba2b4d45eaed5996cd0823791e0c93114882d',
      role: UserRole.MEMBER,
    },
    {
      privyDid: 'did:privy:usr_05',
      email: 'bao.dang@avahui.io',
      displayName: 'Bảo Đặng (Builder #5)',
      walletAddress: '0xd03ea8624c8c5987235048901fb614fdca89b117',
      role: UserRole.MEMBER,
    },
  ];

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { privyDid: u.privyDid },
      update: { displayName: u.displayName, email: u.email, role: u.role },
      create: {
        privyDid: u.privyDid,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
      },
    });

    await prisma.wallet.upsert({
      where: { address: u.walletAddress.toLowerCase() },
      update: { userId: user.id, isPrimary: true },
      create: {
        userId: user.id,
        address: u.walletAddress.toLowerCase(),
        walletClientType: 'privy',
        isPrimary: true,
      },
    });
  }

  console.log('Seeded 5 builder accounts mapped to live EVM wallets.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
