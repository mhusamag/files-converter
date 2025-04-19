const path = require("path");
const express = require("express");
const serveIndex = require("serve-index");
const app = express();
const PORT = 8080;
const ROOT = path.join(__dirname, "public");

// Middleware to set headers for cross-origin isolation
app.use((_, res, next) => {
  res.set({
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  });
  next();
});

// Serve static files from the "public" directory
app.use(express.static(ROOT));

// Serve directory listing for the root path
app.use("/", serveIndex(ROOT, { icons: true }));

// Serve index.html for the root path
app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
