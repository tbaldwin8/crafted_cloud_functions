const functions = require('@google-cloud/functions-framework');
const { fetchCampaignAssets } = require('./function_handler');

functions.http('fetchCampaignAssets', fetchCampaignAssets);
