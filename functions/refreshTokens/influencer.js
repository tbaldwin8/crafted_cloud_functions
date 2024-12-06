require("dotenv").config();
const cors = require("cors")({ origin: true });
const firebase = require(process.env.PRODEV);
const moment = require("moment");

const refreshTiktokAccessTokens = async (req, res) => {
  cors(req, res, async () => {
    const { query } = req.query;
    try {
      const ref = firebase.database().ref("users");
      const snapshot = await ref.once("value");

      const promises = [];
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        if (
          data.creator_socials &&
          data.creator_socials.tiktok &&
          data.creator_socials.tiktok.refresh_token
        ) {
          console.log("token" + data.creator_socials.tiktok.refresh_token);
          const refreshToken = data.creator_socials.tiktok.refresh_token;

          if (refreshToken) {
            const body = new URLSearchParams({
              client_key: "awdpgd7ih1asm72a",
              client_secret: "357014f753c08457f74c0e3115a2c3c1",
              grant_type: "refresh_token",
              refresh_token: refreshToken,
            }).toString();

            const options = {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body,
            };

            const promise = fetch(
              "https://open.tiktokapis.com/v2/oauth/token/",
              options,
            )
              .then((response) => response.json())
              .then(async (responseData) => {
                const accessToken = responseData.access_token;
                if (!accessToken) {
                  console.log(
                    `Access token for user ${childSnapshot.key} is undefined.`,
                  );
                  return Promise.resolve(); // Prevent breaking the promise chain
                }
                console.log("Access token: " + accessToken);
                const accessExpiresAt = moment()
                  .add(responseData.expires_in, "seconds")
                  .toISOString();
                const refreshExpiresAt = moment()
                  .add(responseData.refresh_expires_in, "seconds")
                  .toISOString();

                // Update access token expiry date
                const access_token_expire = firebase
                  .database()
                  .ref(
                    `users/${childSnapshot.key}/creator_socials/tiktok/access_token_expiry_date`,
                  );
                await access_token_expire.set(accessExpiresAt);

                // Update refresh token expiry date
                const refresh_token_expire = firebase
                  .database()
                  .ref(
                    `users/${childSnapshot.key}/creator_socials/tiktok/refresh_token_expiry_date`,
                  );
                await refresh_token_expire.set(refreshExpiresAt);

                // Setting the access_token in the database
                const tok = firebase
                  .database()
                  .ref(
                    `users/${childSnapshot.key}/creator_socials/tiktok/access_token`,
                  );
                await tok.set(accessToken);
              })
              .catch((error) => {
                console.error(
                  `Error refreshing token for user ${childSnapshot.key}:`,
                  error,
                );
                throw error; // Rethrow to propagate to Promise.all
              });

            promises.push(promise);
          }
        }
      });

      console.log(`Number of promises created: ${promises.length}`);
      await Promise.all(promises);
      console.log("All promises have been resolved.");

      res
        .status(200)
        .json({ status: "200", statuscode: "1", result: "Refresh completed" });
    } catch (error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
      res
        .status(500)
        .json({ status: "500", statuscode: "-1", result: error.toString() });
    }
  });
};

module.exports = {
  refreshTiktokAccessTokens,
};
