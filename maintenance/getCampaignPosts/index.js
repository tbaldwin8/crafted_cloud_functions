const functions = require('@google-cloud/functions-framework');
const { fetchCampaignsPosts } = require('./function_handler');

functions.http('fetchCampaignsPosts', fetchCampaignsPosts);
