const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function migrateStudents() {
  const filePath = path.join(__dirname, 'students.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(data) || data.length === 0) return;
  for (const s of data) {
    // Remove _id if present
    delete s._id;
    // Prisma expects Date objects for date fields
    if (s.dob) s.dob = new Date(s.dob);
    if (s.enrollmentDate) s.enrollmentDate = new Date(s.enrollmentDate);
    if (s.createdAt) s.createdAt = new Date(s.createdAt);
    if (s.updatedAt) s.updatedAt = new Date(s.updatedAt);
    try {
      await prisma.student.create({ data: s });
      console.log(`Inserted student: ${s.admissionNumber}`);
    } catch (err) {
      console.error(`Failed to insert student ${s.admissionNumber}:`, err.message);
    }
  }
}

async function migrateInquiries() {
  const filePath = path.join(__dirname, 'inquiries.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(data) || data.length === 0) return;
  for (const i of data) {
    delete i._id;
    if (i.createdAt) i.createdAt = new Date(i.createdAt);
    if (i.updatedAt) i.updatedAt = new Date(i.updatedAt);
    try {
      await prisma.inquiry.create({ data: i });
      console.log(`Inserted inquiry: ${i.email || i.phone}`);
    } catch (err) {
      console.error(`Failed to insert inquiry:`, err.message);
    }
  }
}

async function main() {
  await migrateStudents();
  await migrateInquiries();
  await prisma.$disconnect();
  console.log('Migration complete.');
}

main(); 