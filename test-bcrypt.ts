import bcrypt from 'bcryptjs';

const hash = '$2a$12$0N6AeQ0NLzu2ofLTmqY9eeZ35HOT7p3hQqdDO/UF3.l69m2Jrvbju';
const password = 'password123';

async function test() {
    const result = await bcrypt.compare(password, hash);
    console.log('Comparison result for password123:', result);

    const newHash = await bcrypt.hash(password, 12);
    console.log('New hash generated:', newHash);
    const result2 = await bcrypt.compare(password, newHash);
    console.log('Comparison result for new hash:', result2);
}

test();
