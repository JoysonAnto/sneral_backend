const { exec } = require('child_process');
const child = exec('node dist/server.js');
child.stdout.on('data', (data) => console.log('OUT:', data));
child.stderr.on('data', (data) => console.log('ERR:', data));
child.on('close', (code) => console.log('EXIT:', code));
setTimeout(() => {
    child.kill();
    process.exit();
}, 20000);
