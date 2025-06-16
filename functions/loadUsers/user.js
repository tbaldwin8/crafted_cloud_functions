require("dotenv").config()
const cors = require('cors')({origin: true});
const firebase = require(process.env.PRODEV);
const moment = require('moment');

const loadUsersInBatches = async (req, res) => { 
  cors(req, res, async () => {
    let { query, pageSize, nextCursor } = req.query;
    pageSize = parseInt(pageSize, 10) || 100; // Default batch size
    console.log("query", query, "pageSize", pageSize, "nextCursor", nextCursor);

    try {
      const usersRef = firebase.database().ref('users');

      if (query && query.trim() !== "") {
        // Fetch users in batches, filter, and paginate
        const q = query.toLowerCase();
        let filtered = [];
        let lastKey = null;
        const batchSize = 500; // Adjust as needed for memory/performance
        let moreUsers = true;

        while (moreUsers && filtered.length < (parseInt(nextCursor ? pageSize + 1 : pageSize, 10))) {
          let fbQuery = usersRef.orderByKey().limitToFirst(batchSize);
          if (lastKey) {
            fbQuery = fbQuery.startAfter(lastKey);
          }
          const snapshot = await fbQuery.once('value');
          const usersBatch = snapshot.val();
          if (!usersBatch) break;
          const userKeys = Object.keys(usersBatch);
          if (userKeys.length < batchSize) moreUsers = false;
          lastKey = userKeys[userKeys.length - 1];

          // Filter first, then map
          const batchFiltered = Object.entries(usersBatch)
            .filter(([_, userData]) =>
              (userData.shipping_details && userData.shipping_details.fullname && userData.shipping_details.fullname.toLowerCase().includes(q)) ||
              (userData.email && userData.email.toLowerCase().includes(q)) ||
              (userData.name && userData.name.toLowerCase().includes(q))
            )
            .map(([key, userData]) => ({
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
            }));

          filtered = filtered.concat(batchFiltered);
        }

        // Pagination on filtered results
        let startIdx = 0;
        if (nextCursor) {
          startIdx = filtered.findIndex(u => u.key === nextCursor) + 1;
        }
        const paged = filtered.slice(startIdx, startIdx + pageSize);
        const cursor = (startIdx + pageSize) < filtered.length ? paged[paged.length - 1]?.key : null;

        return res.send({
          status: 200,
          statuscode: "1",
          result: paged,
          length: paged.length,
          cursor
        });
      }

      // Batched fetch if no query
      let fbQuery = usersRef.orderByKey().limitToFirst(pageSize + 1);
      if (nextCursor) {
        fbQuery = fbQuery.startAt(nextCursor);
      }
      const snapshot = await fbQuery.once('value');
      const batchUsers = snapshot.val();
      if (!batchUsers) {
        return res.send({ status: 200, statuscode: "1", result: [], length: 0, cursor: null });
      }
      const userKeys = Object.keys(batchUsers);

      let cursor = null;
      let keysToReturn = userKeys;
      if (userKeys.length > pageSize) {
        // More users exist, set cursor and trim the last user
        cursor = userKeys[pageSize];
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
        cursor 
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