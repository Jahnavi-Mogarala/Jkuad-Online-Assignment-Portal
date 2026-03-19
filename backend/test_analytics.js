const http = require('http');
http.get('http://localhost:3000/api/teacher/analytics', res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body));
}).on('error', e => console.error(e));
