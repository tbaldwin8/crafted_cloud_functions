require("dotenv").config();
const axios = require("axios");
const firebase = require(process.env.PRODEV);
const cors = require("cors")({ origin: true });
const moment = require("moment");

const BATCH_SIZE_USERS = 100; // Adjust as needed
const BATCH_SIZE_MEDIA = 5; // Adjust this number based on how many concurrent requests you want for media IDs

const refreshInstagramRates = async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log("[INFO] Starting Instagram rates refresh process");
      const usersRef = firebase.database().ref("users");
      let lastKey = null;
      let moreUsers = true;

      while (moreUsers) {
        let query = usersRef.orderByKey().limitToFirst(BATCH_SIZE_USERS);
        if (lastKey) {
          query = query.startAfter(lastKey);
        }
        const usersSnapshot = await query.once("value");
        const users = usersSnapshot.val();
        const userKeys = users ? Object.keys(users) : [];

        if (!users || userKeys.length === 0) {
          console.log("[INFO] No more users found in this batch");
          break;
        }

        lastKey = userKeys[userKeys.length - 1];
        if (userKeys.length < BATCH_SIZE_USERS) {
          moreUsers = false;
        }

        console.log(`[INFO] Processing batch with ${userKeys.length} users`);

        const updatePromises = userKeys.map(async (creator_id) => {
          const user = users[creator_id];

          if (user && user.negotiated === true) {
            console.log(
              `[INFO] Skipping user ${creator_id} due to negotiated=true`,
            );
            return;
          }

          const instagramInfo =
            user && user.creator_socials && user.creator_socials.instagram;

          if (
            instagramInfo &&
            instagramInfo.instagram_business_account_id &&
            instagramInfo.access_token
          ) {
            try {
              console.log(
                `[INFO] Calculating suggested rate for user ${creator_id}`,
              );
              const suggestedRate = await calculateSuggestedRate(
                instagramInfo.access_token,
                instagramInfo.instagram_business_account_id,
              );

              if (!suggestedRate) {
                console.error(
                  `[ERROR] Failed to calculate a suggested rate for creator ${creator_id}`,
                );
                return null;
              }

              await firebase
                .database()
                .ref(`users/${creator_id}/creator_socials/instagram`)
                .update({
                  suggested_rate: suggestedRate,
                  updated: moment().format(),
                });

              console.log(
                `[INFO] Updated suggested rate for user ${creator_id}`,
              );
            } catch (error) {
              console.error(
                `[ERROR] Failed to calculate or update suggested rate for creator_id ${creator_id}:`,
                error,
              );

              return;
            }
          } else {
            console.warn(
              `[WARN] Missing Instagram info for user ${creator_id}, skipping`,
            );
          }
        });

        await Promise.all(updatePromises);
      }

      console.log("[INFO] Finished refreshing all Instagram accounts");
      res.status(200).json({
        status: "200",
        statuscode: "1",
        message: "Refreshed all Instagram accounts successfully",
      });
    } catch (error) {
      console.error("[ERROR] Error refreshing Instagram accounts:", error);
      res.status(500).json({ status: "500", statuscode: "-1", result: error });
    }
  });
};

async function calculateSuggestedRate(access_token, business_account_id) {
  const mediaUrl = `https://graph.facebook.com/v20.0/${business_account_id}/media?fields=media_type&access_token=${access_token}&limit=300`;
  console.log(
    `[INFO] Fetching media for business_account_id ${business_account_id}`,
  );
  const mediaResponse = await fetch(mediaUrl);
  const mediaData = await mediaResponse.json();

  if (!mediaResponse.ok) {
    const message =
      mediaData?.error?.error_user_msg ||
      `${mediaResponse.status} ${mediaResponse.statusText}`;

    throw new Error(
      `[ERROR] Failed to fetch media for business_account_id ${business_account_id}: ${message}`,
    );
  }

  const reels = mediaData.data
    .filter((media) => media.media_type === "VIDEO")
    .slice(0, 25);

  const mediaIds = reels.map((media) => media.id);

  let allPlayCounts = [];
  for (let i = 0; i < mediaIds.length; i += BATCH_SIZE_MEDIA) {
    const mediaBatch = mediaIds.slice(i, i + BATCH_SIZE_MEDIA);

    const playPromises = mediaBatch.map(async (mediaId) => {
      try {
        const insightsUrl = `https://graph.facebook.com/v20.0/${mediaId}/insights?access_token=${access_token}&metric=views`;
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();

        if (!insightsResponse.ok) {
          const message =
            insightsData?.error?.error_user_msg ||
            `${insightsResponse.status} ${insightsResponse.statusText}`;

          throw new Error(message);
        }

        if (insightsData.data && insightsData.data.length > 0) {
          return insightsData.data[0].values[0].value;
        }

        return null;
      } catch (error) {
        console.error(
          `[ERROR] Failed to fetch insights for mediaId ${mediaId} of business_account_id ${business_account_id}:`,
          error,
        );

        return null;
      }
    });

    const playArray = await Promise.all(playPromises);
    allPlayCounts = allPlayCounts.concat(
      playArray.filter((play) => play !== null),
    );
  }

  let medianPlays = median(allPlayCounts);
  let suggestedRate = parseInt((medianPlays / 1000) * 2500);

  console.log(`[INFO] Calculated suggested rate: ${suggestedRate}`);

  return suggestedRate;
}

function median(arr) {
  if (arr.length === 0) return 0; // Handle empty array case

  let mid = Math.floor(arr.length / 2);
  let sortedArr = arr.sort((a, b) => a - b);

  if (arr.length % 2 === 0) {
    return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
  } else {
    return sortedArr[mid];
  }
}

module.exports = {
  refreshInstagramRates,
};
