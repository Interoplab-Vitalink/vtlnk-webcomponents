const connect = require("connect");
const serveStatic = require("serve-static");

connect()
  .use(serveStatic(__dirname, { index: ["index.html", "index.htm"] }))
  .listen(3001, () => console.log("Server running on port 3001"));