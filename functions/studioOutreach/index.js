const functions = require('@google-cloud/functions-framework');
const { findCreatorsForStudioBrief } = require('./task');

functions.http('findCreatorsForStudioBrief', findCreatorsForStudioBrief);
