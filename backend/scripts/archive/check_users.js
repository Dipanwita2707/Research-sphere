const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.userLogin.findMany({
        take: 5,
        select: {
            uid: true,
            role: true,
            status: true
        }
    });
    console.log('Sample users in database:');
    console.log(JSON.stringify(users, null, 2));
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
    });
