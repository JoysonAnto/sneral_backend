
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- KYC Status Audit ---');
  
  const servicePartnerStats = await prisma.servicePartner.groupBy({
    by: ['kyc_status'],
    _count: { id: true },
  });
  console.log('Service Partner Statuses:', JSON.stringify(servicePartnerStats, null, 2));

  const businessPartnerStats = await prisma.businessPartner.groupBy({
    by: ['kyc_status'],
    _count: { id: true },
  });
  console.log('Business Partner Statuses:', JSON.stringify(businessPartnerStats, null, 2));

  const kycDocumentStats = await prisma.kycDocument.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log('KYC Document Statuses:', JSON.stringify(kycDocumentStats, null, 2));

  const pendingPartners = await prisma.servicePartner.findMany({
    where: { kyc_status: 'PENDING_VERIFICATION' },
    include: {
      user: true,
      kyc_documents: true,
    }
  });
  console.log('Service Partners in PENDING_VERIFICATION:', JSON.stringify(pendingPartners, null, 2));

  const partnersWithoutDocs = await prisma.servicePartner.findMany({
    where: {
      kyc_status: 'PENDING_VERIFICATION',
      kyc_documents: { none: {} }
    },
    include: { user: true }
  });
  console.log('Partners in PENDING_VERIFICATION without ANY documents:', JSON.stringify(partnersWithoutDocs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
