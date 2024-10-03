require("dotenv").config()
const cors = require('cors')({origin: true});
const firebase = require(process.env.PRODEV);
const moment = require('moment');


  const getAllUsersWithBalances = async (req, res) => {
    cors(req, res, async () => {
      let usersWithBalanceGreaterThan6500 = [];
      try {
        let queryRef = firebase.database().ref('users').orderByChild('creator_balance').startAt(6500);

        let snapshot = await queryRef.once('value');
        const users = snapshot.val();
        usersWithBalanceGreaterThan6500 = Object.keys(users)
          .map(key => {
            const userData = users[key];
            return {
              key,
              email: userData.email,
              fullname: userData && userData.shipping_details && userData.shipping_details.fullname,
              stripe_id: userData.stripe_id || null,
              creator_balance: userData.creator_balance,
            };
          })
          .filter(user => user.creator_balance >= 6500)
          .sort((a, b) => a.creator_balance - b.creator_balance); // Sort from least to greatest

        res.send({ status: 200, statuscode: "1", result: usersWithBalanceGreaterThan6500 });
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Internal server error', error });
      }
    });
  }

  module.exports = { 
  getAllUsersWithBalances,
  }