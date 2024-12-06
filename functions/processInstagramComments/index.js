const functions = require('@google-cloud/functions-framework');
const { processInstagramComments } = require('./instagram');

functions.http('processInstagramComments', processInstagramComments);
