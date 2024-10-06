const firebase = require("firebase");
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://crafted-v1.firebaseio.com",
});

module.exports = app;
