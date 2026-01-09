const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Indian states and their codes
const indianStates = [
    { name: 'Andhra Pradesh', code: 'AP' },
    { name: 'Arunachal Pradesh', code: 'AR' },
    { name: 'Assam', code: 'AS' },
    { name: 'Bihar', code: 'BR' },
    { name: 'Chhattisgarh', code: 'CG' },
    { name: 'Goa', code: 'GA' },
    { name: 'Gujarat', code: 'GJ' },
    { name: 'Haryana', code: 'HR' },
    { name: 'Himachal Pradesh', code: 'HP' },
    { name: 'Jharkhand', code: 'JH' },
    { name: 'Karnataka', code: 'KA' },
    { name: 'Kerala', code: 'KL' },
    { name: 'Madhya Pradesh', code: 'MP' },
    { name: 'Maharashtra', code: 'MH' },
    { name: 'Manipur', code: 'MN' },
    { name: 'Meghalaya', code: 'ML' },
    { name: 'Mizoram', code: 'MZ' },
    { name: 'Nagaland', code: 'NL' },
    { name: 'Odisha', code: 'OR' },
    { name: 'Punjab', code: 'PB' },
    { name: 'Rajasthan', code: 'RJ' },
    { name: 'Sikkim', code: 'SK' },
    { name: 'Tamil Nadu', code: 'TN' },
    { name: 'Telangana', code: 'TG' },
    { name: 'Tripura', code: 'TR' },
    { name: 'Uttar Pradesh', code: 'UP' },
    { name: 'Uttarakhand', code: 'UK' },
    { name: 'West Bengal', code: 'WB' },
    { name: 'Delhi', code: 'DL' },
    { name: 'Jammu and Kashmir', code: 'JK' },
    { name: 'Ladakh', code: 'LA' },
    { name: 'Puducherry', code: 'PY' },
    { name: 'Chandigarh', code: 'CH' },
    { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DD' },
    { name: 'Lakshadweep', code: 'LD' },
    { name: 'Andaman and Nicobar Islands', code: 'AN' },
];

// Major districts by state (selected important ones)
const majorDistricts = {
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur'],
    'Delhi': ['Central Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'New Delhi'],
    'Karnataka': ['Bangalore Urban', 'Bangalore Rural', 'Mysore', 'Mangalore', 'Hubli-Dharwad', 'Belgaum'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli'],
    'West Bengal': ['Kolkata', 'Howrah', 'North 24 Parganas', 'South 24 Parganas', 'Hooghly', 'Darjeeling'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'],
    'Telangana': ['Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Warangal Urban', 'Nizamabad'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Meerut', 'Varanasi', 'Allahabad', 'Noida'],
    'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur'],
    'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'],
    'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal'],
    'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'],
    'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'],
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'],
};

async function seedLocations() {
    console.log('🌍 Starting location seeding...\n');

    try {
        // Create states
        console.log('📍 Creating states...');
        for (const state of indianStates) {
            const createdState = await prisma.state.upsert({
                where: { code: state.code },
                update: {},
                create: {
                    name: state.name,
                    code: state.code,
                    is_active: true,
                },
            });
            console.log(`   ✓ ${createdState.name} (${createdState.code})`);
        }

        console.log('\n📍 Creating major districts...');
        for (const [stateName, districts] of Object.entries(majorDistricts)) {
            const state = await prisma.state.findFirst({
                where: { name: stateName },
            });

            if (!state) {
                console.log(`   ⚠️  State not found: ${stateName}`);
                continue;
            }

            for (const districtName of districts) {
                const district = await prisma.district.upsert({
                    where: {
                        state_id_name: {
                            state_id: state.id,
                            name: districtName,
                        },
                    },
                    update: {},
                    create: {
                        state_id: state.id,
                        name: districtName,
                        is_active: true,
                    },
                });
                console.log(`   ✓ ${stateName} → ${district.name}`);
            }
        }

        console.log('\n✅ Location seeding completed successfully!');

        // Print summary
        const stateCount = await prisma.state.count();
        const districtCount = await prisma.district.count();
        console.log(`\n📊 Summary:`);
        console.log(`   States: ${stateCount}`);
        console.log(`   Districts: ${districtCount}`);

    } catch (error) {
        console.error('❌ Error seeding locations:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

seedLocations();
