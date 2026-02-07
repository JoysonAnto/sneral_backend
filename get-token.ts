
import { AuthService } from './src/services/auth.service';
import fs from 'fs';
async function run() {
    const auth = new AuthService();
    try {
        const res = await auth.login('admin@snearal.com', 'password123');
        fs.writeFileSync('token.txt', (res as any).accessToken);
        console.log('Token written to token.txt');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
