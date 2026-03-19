const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 2, role_id: 2, name: 'Anjani' }, 'super_secret_key_dbms_project');
const http = require('http');

http.get('http://localhost:3000/api/teacher/export-results', {
    headers: { 'Authorization': `Bearer ${token}` }
}, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body.substring(0, 500)));
});
