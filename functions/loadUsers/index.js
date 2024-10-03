const functions = require('@google-cloud/functions-framework');
const { loadUsersInBatches } = require('./user');

functions.http('loadUsers', loadUsersInBatches);
