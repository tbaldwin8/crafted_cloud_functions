require("dotenv").config()
const cors = require('cors')({origin: true});
const firebase = require(process.env.PRODEV);
const moment = require('moment');

const loadUsersInBatches = async (req, res) => { 
  cors(req, res, async () => {
    let { query, pageSize, pageToken } = req.query;
    pageSize = parseInt(pageSize, 10) || 100; // Default batch size
    console.log("query", query, "pageSize", pageSize, "pageToken", pageToken);

    try {
      const usersRef = firebase.database().ref('users');

      if (query && query.trim() !== "") {
        // Fetch all users, filter, then paginate
        const snapshot = await usersRef.once('value');
        const allUsers = snapshot.val() || {};
        const filtered = Object.entries(allUsers).map(([key, userData]) => ({
          key,
          data: {
            name: userData.name || null,
            email: userData.email,
            bio: userData.bio,
            creator_socials: userData.creator_socials,
            avatar: userData.avatar,
            shipping_details: {
              address1: userData.shipping_details && userData.shipping_details.address_1 ? userData.shipping_details.address_1 : null,
              address2: userData.shipping_details && userData.shipping_details.address_2 ? userData.shipping_details.address_2 : null,
              fullname: userData.shipping_details && userData.shipping_details.fullname ? userData.shipping_details.fullname : null,
              city: userData.shipping_details && userData.shipping_details.city ? userData.shipping_details.city : null,
              state: userData.shipping_details && userData.shipping_details.state ? userData.shipping_details.state : null,
              zipcode: userData.shipping_details && userData.shipping_details.zipcode ? userData.shipping_details.zipcode : null,
            }
          }
        })).filter(userData => {
          const q = query.toLowerCase();
          return (
            (userData.data && userData.data.shipping_details && userData.data.shipping_details.fullname && userData.data.shipping_details.fullname.toLowerCase().includes(q)) ||
            (userData.data && userData.data.email && userData.data.email.toLowerCase().includes(q)) ||
            (userData.data && userData.data.name && userData.data.name.toLowerCase().includes(q))
          );
        });

        // Pagination on filtered results
        let startIdx = 0;
        if (pageToken) {
          startIdx = filtered.findIndex(u => u.key === pageToken) + 1;
        }
        const paged = filtered.slice(startIdx, startIdx + pageSize);
        const nextPageToken = (startIdx + pageSize) < filtered.length ? paged[paged.length - 1]?.key : null;

        return res.send({
          status: 200,
          statuscode: "1",
          result: paged,
          length: paged.length,
          nextPageToken
        });
      }

      // Batched fetch if no query
      let fbQuery = usersRef.orderByKey().limitToFirst(pageSize + 1);
      if (pageToken) {
        fbQuery = fbQuery.startAfter(pageToken);
      }
      const snapshot = await fbQuery.once('value');
      const batchUsers = snapshot.val();
      if (!batchUsers) {
        return res.send({ status: 200, statuscode: "1", result: [], length: 0, nextPageToken: null });
      }
      const userKeys = Object.keys(batchUsers);

      let nextPageToken = null;
      let keysToReturn = userKeys;
      if (userKeys.length > pageSize) {
        // More users exist, set nextPageToken and trim the last user
        nextPageToken = userKeys[pageSize];
        keysToReturn = userKeys.slice(0, pageSize);
      }

      let users = [];
      keysToReturn.forEach((key) => {
        const userData = batchUsers[key];
        const userObject = {
          key: key,
          data: {
            name: userData.name || null,
            email: userData.email,
            bio: userData.bio,
            creator_socials: userData.creator_socials,
            avatar: userData.avatar,
            shipping_details: {
              address1: userData.shipping_details && userData.shipping_details.address_1 ? userData.shipping_details.address_1 : null,
              address2: userData.shipping_details && userData.shipping_details.address_2 ? userData.shipping_details.address_2 : null,
              fullname: userData.shipping_details && userData.shipping_details.fullname ? userData.shipping_details.fullname : null,
              city: userData.shipping_details && userData.shipping_details.city ? userData.shipping_details.city : null,
              state: userData.shipping_details && userData.shipping_details.state ? userData.shipping_details.state : null,
              zipcode: userData.shipping_details && userData.shipping_details.zipcode ? userData.shipping_details.zipcode : null,
            }
          }
        };
        users.push(userObject);
      });

      res.send({ 
        status: 200, 
        statuscode: "1", 
        result: users, 
        length: users.length, 
        nextPageToken 
      });
    } catch (error) {
      console.error('Error loading users:', error);
      res.status(500).send({ message: 'Internal server error' });
    }
  });
}

module.exports = { 
  loadUsersInBatches,
}