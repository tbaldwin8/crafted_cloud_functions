const functions = require('@google-cloud/functions-framework');
const { getAllUsersWithBalances } = require('./user');

functions.http('getBalancedUsers', getAllUsersWithBalances);
