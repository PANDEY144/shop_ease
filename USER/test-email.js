const http = require('http');

const data = JSON.stringify({
  to: 'pamdeygaurav911@gmail.com',
  subject: 'Hello World',
  html: '<p>Congrats on sending your first email!</p>'
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/send-email',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => { console.log(body); });
});

req.on('error', (error) => { console.error(error); });
req.write(data);
req.end();
