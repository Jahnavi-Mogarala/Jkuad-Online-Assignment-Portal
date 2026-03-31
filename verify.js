const http = require('http');

function test(name, data, path = '/api/auth/register') {
    return new Promise((resolve) => {
        console.log(`\n--- Test: ${name} ---`);
        const body = JSON.stringify(data);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${data}`);
                resolve();
            });
        });
        
        req.on('error', (e) => {
            console.error(`Problem with request: ${e.message}`);
            resolve();
        });
        
        req.write(body);
        req.end();
    });
}

async function run() {
    await test('Invalid Email', { name: "Test User", email: "test@yahoo.com", password: "Password1!", role_id: 3, mobile: "+919876543210" });
    await test('Invalid Name (Special Chars)', { name: "Te@st", email: "test@gmail.com", password: "Password1!", role_id: 3, mobile: "+919876543210" });
    await test('Invalid Password (Weak)', { name: "Test User", email: "test@gmail.com", password: "weakpassword", role_id: 3, mobile: "+919876543210" });
    await test('Invalid Mobile (Missing +91)', { name: "Test User", email: "test@gmail.com", password: "Password1!", role_id: 3, mobile: "91987654321" });
    await test('Valid Registration', { name: "Test User", email: "test99@gmail.com", password: "Password1!", role_id: 3, mobile: "+919876543210" });
    
    // Now verify login constraints
    await test('Login Invalid Email', { email: 'test99@yahoo.com', password: 'Password1!' }, '/api/auth/login');
}

run();
