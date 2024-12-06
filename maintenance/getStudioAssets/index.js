const functions = require('@google-cloud/functions-framework');
const { fetchStudioAssets } = require('./function_handler');

functions.http('fetchStudioAssets', fetchStudioAssets);

