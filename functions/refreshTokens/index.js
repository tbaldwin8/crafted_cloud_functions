const functions = require("@google-cloud/functions-framework");
const { refreshTiktokAccessTokens } = require("./influencer");

functions.http("refreshTiktokAccessTokens", refreshTiktokAccessTokens);
