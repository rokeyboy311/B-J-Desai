const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const token = parsed.token;
      if (!token) {
        // Maybe try login
        const loginReq = http.request({
          hostname: 'localhost',
          port: 3000,
          path: '/api/auth/login',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }, (res2) => {
           let data2 = '';
           res2.on('data', chunk => data2 += chunk);
           res2.on('end', () => {
             const token2 = JSON.parse(data2).token;
             if (token2) fetchLocs(token2);
             else console.log("Login failed", data2);
           });
        });
        loginReq.write(JSON.stringify({email: 'test@example.com', password: 'password'}));
        loginReq.end();
      } else {
        fetchLocs(token);
      }
    } catch(e) { console.error(e); }
  });
});
req.write(JSON.stringify({email: 'test@example.com', password: 'password', name: 'Test'}));
req.end();

function fetchLocs(token) {
  const req2 = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/locations',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  }, (res2) => {
    let data2 = '';
    res2.on('data', chunk => data2 += chunk);
    res2.on('end', () => {
      console.log("Locations response:", data2);
    });
  });
  req2.end();
}
