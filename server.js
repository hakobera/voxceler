/**
 * HTTP server for testing using Node.js.
 *
 * If you want to run example,
 * type 'node server.js' in console,
 * then accesss 'http://localhost:3000/examples'
 */
var connect = require('connect');

var port = 3000;

connect.createServer(
	connect.logger(),
	connect.static(__dirname)
).listen(port);

console.log("Connect server listening on port %d", port);
