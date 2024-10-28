const firebase = require("firebase");
var admin = require('firebase-admin');

var serviceAccount = require("./serviceAccountKey.json");

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://crafted-dev-v1-default-rtdb.firebaseio.com"
});

module.exports = app;