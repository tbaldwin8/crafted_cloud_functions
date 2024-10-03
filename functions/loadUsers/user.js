require("dotenv").config()
const cors = require('cors')({origin: true});
const firebase = require(process.env.PRODEV);
const moment = require('moment');

  const loadUsersInBatches = async (req, res) => { 
      cors(req, res, async () => {
      let { query } = req.query;
      console.log("query", query);

      try {
        const snapshot = await firebase.database().ref('users').once('value');

        let users = [];

         snapshot.forEach((childSnapshot) => {
          const userData = childSnapshot.val();
          // Structure each item with the key and the data
          const userObject = {
            key: childSnapshot.key,
            data: {
              name: userData.name || null, // Added name property
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
        
        // If a search query is provided, filter the users
        if (query && query.trim() !== "") {
          query = query.toLowerCase();
          users = users.filter(userData =>
            (userData.data && userData.data.shipping_details && userData.data.shipping_details.fullname && userData.data.shipping_details.fullname.toLowerCase().includes(query)) ||
            (userData.data && userData.data.email && userData.data.email.toLowerCase().includes(query)) ||
            (userData.data && userData.data.name && userData.data.name.toLowerCase().includes(query)) // Added name to the filter condition
          );
        }

        res.send({ "status": 200, "statuscode": "1", "result": users, "length": users.length });
      } catch (error) {
        console.error('Error loading users:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
      });
    }

       module.exports = { 
        loadUsersInBatches,
      }