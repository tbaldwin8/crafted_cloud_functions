const functions = require('@google-cloud/functions-framework');
const { refreshInstagramRates } = require('./instagram');

functions.http('refreshInstagramRates', refreshInstagramRates);
