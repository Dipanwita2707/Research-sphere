const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'chat_group',
        'chat_group_member',
        'chat_group_permission',
        'chat_message',
        'direct_message',
        'user_chat_status',
        'chat_user_permission'
      )
    ORDER BY table_name
  `);

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
