const functions = require('@google-cloud/functions-framework');
const { refreshTiktokRatesForAllAccounts } = require('./influencer');

functions.http('refreshTiktokRatesForAllAccounts', refreshTiktokRatesForAllAccounts);
