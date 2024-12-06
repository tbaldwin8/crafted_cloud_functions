const functions = require('@google-cloud/functions-framework');
const { fetchCreatorsStudioDrafts } = require('./function_handler');

functions.http('fetchCreatorsStudioDrafts', fetchCreatorsStudioDrafts);

