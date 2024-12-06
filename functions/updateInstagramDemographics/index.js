const functions = require('@google-cloud/functions-framework');
const { fetchAndUpdateInstagramDemographics } = require('./instagram');

functions.http('fetchAndUpdateInstagramDemographics', fetchAndUpdateInstagramDemographics);
