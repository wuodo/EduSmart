import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function hashExistingPasswords() {
  console.log('Starting password hashing process...');
  
  try {
    // Get all users with plain text passwords (not starting with $2a$ which is bcrypt)
    const users = await prisma.user.findMany({
      where: {
        password: {
          not: {
            startsWith: '$2a$'
          }
        }
      }
    });
    
    console.log(`Found ${users.length} users with plain text passwords`);
    
    for (const user of users) {
      try {
        // Hash the existing password
        const hashedPassword = bcrypt.hashSync(user.password, 10);
        
        // Update the user with hashed password
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        });
        
        console.log(`✓ Hashed password for user: ${user.email} (ID: ${user.id})`);
      } catch (error) {
        console.error(`✗ Failed to hash password for user ${user.email}:`, error);
      }
    }
    
    console.log('Password hashing process completed!');
  } catch (error) {
    console.error('Error during password hashing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

hashExistingPasswords().then(() => process.exit(0)).catch(console.error);
