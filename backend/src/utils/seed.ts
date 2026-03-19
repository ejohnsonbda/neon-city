import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORGANIZATIONS = [
  { name: 'Bermuda Football Association', accessCode: '1A2b3C4d5E6f7G', email: 'football@sportsandrec.gov.bm', sport: 'Football (Soccer)' },
  { name: 'Bermuda Cricket Board', accessCode: '1H2i3J4k5L6m7N', email: 'cricket@sportsandrec.gov.bm', sport: 'Cricket' },
  { name: 'Bermuda Rugby Football Union', accessCode: '1O2p3Q4r5S6t7U', email: 'rugby@sportsandrec.gov.bm', sport: 'Rugby' },
  { name: 'Bermuda Basketball Association', accessCode: '1V2w3X4y5Z6a7B', email: 'basketball@sportsandrec.gov.bm', sport: 'Basketball' },
  { name: 'Bermuda Netball Association', accessCode: '1c2D3e4F5g6H7i', email: 'netball@sportsandrec.gov.bm', sport: 'Netball' },
  { name: 'Bermuda Tennis Association', accessCode: '1J2k3L4m5N6o7P', email: 'tennis@sportsandrec.gov.bm', sport: 'Tennis' },
  { name: 'Bermuda Swimming Association', accessCode: '1Q2r3S4t5U6v7W', email: 'swimming@sportsandrec.gov.bm', sport: 'Swimming' },
  { name: 'Bermuda Athletics Association', accessCode: '1X2y3Z4a5B6c7D', email: 'athletics@sportsandrec.gov.bm', sport: 'Athletics (Track & Field)' },
  { name: 'Bermuda Cycling Federation', accessCode: '1e2F3g4H5i6J7k', email: 'cycling@sportsandrec.gov.bm', sport: 'Cycling' },
  { name: 'Bermuda Triathlon Association', accessCode: '1L2m3N4o5P6q7R', email: 'triathlon@sportsandrec.gov.bm', sport: 'Triathlon' },
  { name: 'Bermuda Squash Racquet Association', accessCode: '1S2t3U4v5W6x7Y', email: 'squash@sportsandrec.gov.bm', sport: 'Squash' },
  { name: 'Bermuda Bowling Federation', accessCode: '1Z2a3B4c5D6e7F', email: 'bowling@sportsandrec.gov.bm', sport: 'Bowling' },
  { name: 'Bermuda Golf Association', accessCode: '2G3h4I5j6K7l8M', email: 'golf@sportsandrec.gov.bm', sport: 'Golf' },
  { name: 'Bermuda Hockey Association', accessCode: '2N3o4P5q6R7s8T', email: 'hockey@sportsandrec.gov.bm', sport: 'Hockey' },
  { name: 'Bermuda Boxing Association', accessCode: '2U3v4W5x6Y7z8A', email: 'boxing@sportsandrec.gov.bm', sport: 'Boxing' },
  { name: 'Bermuda Karate Association', accessCode: '2b3C4d5E6f7G8h', email: 'karate@sportsandrec.gov.bm', sport: 'Karate' },
  { name: 'Bermuda Equestrian Federation', accessCode: '2I3j4K5l6M7n8O', email: 'equestrian@sportsandrec.gov.bm', sport: 'Equestrian' },
  { name: 'Bermuda Sailing Association', accessCode: '3Q4r5S6t7U8v9W', email: 'sailing@sportsandrec.gov.bm', sport: 'Sailing' },
  { name: 'Bermuda Volleyball Association', accessCode: '4L5m6N7o8P9q0R', email: 'volleyball@sportsandrec.gov.bm', sport: 'Volleyball' },
  { name: 'Boccia Bermuda', accessCode: '4n5O6p7Q8R9s0T', email: 'boccia@sportsandrec.gov.bm', sport: 'Boccia' },
  { name: 'Gymnastics Federation of Bermuda', accessCode: '4v5W6x7Y8Z9a0B', email: 'gymnastics@sportsandrec.gov.bm', sport: 'Gymnastics' },
  { name: 'National Archery Association of Bermuda', accessCode: '5G6h7I8j9K0l1M', email: 'archery@sportsandrec.gov.bm', sport: 'Archery' },
  { name: 'Pickleball Association of Bermuda', accessCode: '5O6p7Q8r9S0t1U', email: 'pickleball@sportsandrec.gov.bm', sport: 'Pickleball' },
  { name: 'Bermuda Karting Association', accessCode: '6K7l8M9n0O1p2Q', email: 'karting@sportsandrec.gov.bm', sport: 'Karting' },
  { name: 'Bermuda Rowing Association', accessCode: '6R7s8T9u0V1w2X', email: 'rowing@sportsandrec.gov.bm', sport: 'Rowing' },
  { name: 'Bermuda Motocross Association', accessCode: '6Y7z8A9b0C1d2E', email: 'motocross@sportsandrec.gov.bm', sport: 'Motocross' },
  { name: 'Bermuda Olympic Association', accessCode: 'Z3309MZS8K', email: 'olympic@sportsandrec.gov.bm', sport: 'Olympics' },
];

const SAMPLE_EVENTS = [
  {
    title: 'Football - Premier Division Opening Day',
    description: 'The opening day of the 2026 Premier Division season. All clubs competing in a round-robin format.',
    date: '2026-04-05',
    time: '14:00',
    location: 'National Sports Centre, Devonshire',
    sport: 'Football (Soccer)',
    orgName: 'Bermuda Football Association',
  },
  {
    title: 'Cricket - Cup Match Classic',
    description: 'The annual Cup Match cricket classic between Somerset and St. George\'s. A beloved Bermuda tradition.',
    date: '2026-07-30',
    time: '10:00',
    location: 'Somerset Cricket Club',
    sport: 'Cricket',
    orgName: 'Bermuda Cricket Board',
  },
  {
    title: 'Triathlon - Bermuda World Triathlon',
    description: 'Elite and age-group triathletes compete in the annual Bermuda World Triathlon event.',
    date: '2026-05-16',
    time: '07:00',
    location: 'Hamilton, Bermuda',
    sport: 'Triathlon',
    orgName: 'Bermuda Triathlon Association',
  },
  {
    title: 'Swimming - National Championships',
    description: 'Annual national swimming championships across all age groups and distances.',
    date: '2026-06-20',
    time: '09:00',
    location: 'National Aquatics Centre',
    sport: 'Swimming',
    orgName: 'Bermuda Swimming Association',
  },
  {
    title: 'Rugby - Ariel Re 7s Tournament',
    description: 'The prestigious Ariel Re Rugby 7s Tournament featuring international and local teams.',
    date: '2026-04-25',
    time: '09:00',
    location: 'National Sports Centre',
    sport: 'Rugby',
    orgName: 'Bermuda Rugby Football Union',
  },
  {
    title: 'Sailing - Newport to Bermuda Race',
    description: 'The biennial Newport Bermuda Race — one of the oldest ocean races in the world.',
    date: '2026-06-19',
    time: '12:00',
    location: 'Hamilton Harbour',
    sport: 'Sailing',
    orgName: 'Bermuda Sailing Association',
  },
  {
    title: 'Athletics - Track & Field Championships',
    description: 'National Track & Field Championships featuring sprints, jumps, throws and distance events.',
    date: '2026-05-30',
    time: '09:00',
    location: 'National Sports Centre Track',
    sport: 'Athletics (Track & Field)',
    orgName: 'Bermuda Athletics Association',
  },
  {
    title: 'Tennis - ITF Junior Circuit',
    description: 'International Tennis Federation Junior Circuit event hosted in Bermuda.',
    date: '2026-04-12',
    time: '08:00',
    location: 'Coral Beach & Tennis Club',
    sport: 'Tennis',
    orgName: 'Bermuda Tennis Association',
  },
];

async function main() {
  console.log('🌱 Seeding SportCal database...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log('✅ Cleared existing data');

  // Seed organizations
  const createdOrgs: Record<string, string> = {};
  for (const org of ORGANIZATIONS) {
    const created = await prisma.organization.create({ data: org });
    createdOrgs[org.name] = created.id;
    console.log(`  ✓ Organization: ${org.name}`);
  }

  console.log(`\n✅ Created ${ORGANIZATIONS.length} organizations`);

  // Seed sample events
  for (const event of SAMPLE_EVENTS) {
    const orgId = createdOrgs[event.orgName];
    if (!orgId) continue;

    await prisma.event.create({
      data: {
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        location: event.location,
        organizationId: orgId,
        organizationName: event.orgName,
        sport: event.sport,
        isPublished: true,
      },
    });
    console.log(`  ✓ Event: ${event.title}`);
  }

  console.log(`\n✅ Created ${SAMPLE_EVENTS.length} sample events`);
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Super Admin Credentials:');
  console.log('   Access Code: safehands  →  Department of Sports & Recreation (super_admin)');
  console.log('   Access Code: juren      →  UMIN Design (super_admin)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
