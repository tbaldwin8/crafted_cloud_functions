require("dotenv").config();
const axios = require("axios");
const firebase = require(process.env.PRODEV);
const cors = require("cors")({ origin: true });
const moment = require("moment");

const BATCH_SIZE_USERS = 5; // Adjust this number based on how many concurrent requests you want for users
const BATCH_SIZE_MEDIA = 5; // Adjust this number based on how many concurrent requests you want for media IDs

const refreshInstagramRates = async (req, res) => {
  cors(req, res, async () => {
    try {
      // Fetch all users with their Instagram info
      const usersSnapshot = await firebase
        .database()
        .ref("users")
        .once("value");
      const users = usersSnapshot.val();
      const userEntries = Object.entries(users);

      for (let i = 0; i < userEntries.length; i += BATCH_SIZE_USERS) {
        const batch = userEntries.slice(i, i + BATCH_SIZE_USERS);

        const updatePromises = batch.map(async ([creator_id, user]) => {
          const instagramInfo =
            user && user.creator_socials && user.creator_socials.instagram;
          if (
            instagramInfo &&
            instagramInfo.instagram_business_account_id &&
            instagramInfo.access_token
          ) {
            try {
              const suggestedRate = await calculateSuggestedRate(
                instagramInfo.access_token,
                instagramInfo.instagram_business_account_id,
              );

              // Set the new data in the respective creator's creator_socials.instagram
              if (!suggestedRate) {
                console.error(
                  `Failed to calculate a suggested rate for creator ${creator_id}`,
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
            } catch (error) {
              console.error(
                `Failed to calculate or update suggested rate for creator_id ${creator_id}:`,
                error,
              );
              return;
            }
          }
        });

        // Wait for the current batch to complete before moving to the next batch
        await Promise.all(updatePromises);
      }

      res.status(200).json({
        status: "200",
        statuscode: "1",
        message: "Refreshed all Instagram accounts successfully",
      });
    } catch (error) {
      console.error("Error refreshing Instagram accounts:", error);
      res.status(500).json({ status: "500", statuscode: "-1", result: error });
    }
  });
};

async function calculateSuggestedRate(access_token, business_account_id) {
  try {
    const mediaUrl = `https://graph.facebook.com/v20.0/${business_account_id}/media?fields=media_type&access_token=${access_token}&limit=300`;
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      throw new Error(
        `Failed to fetch media data: ${mediaResponse.status} ${mediaResponse.statusText}`,
      );
    }
    const mediaData = await mediaResponse.json();
    console.log("MEDIA LENGTH", Object.keys(mediaData.data).length);

    const reels = mediaData.data
      .filter((media) => media.media_type === "VIDEO")
      .slice(0, 25);

    const mediaIds = reels.map((media) => media.id);

    // Batch the media ID requests
    let allPlayCounts = [];
    for (let i = 0; i < mediaIds.length; i += BATCH_SIZE_MEDIA) {
      const mediaBatch = mediaIds.slice(i, i + BATCH_SIZE_MEDIA);

      const playPromises = mediaBatch.map(async (mediaId) => {
        try {
          const insightsUrl = `https://graph.facebook.com/v20.0/${mediaId}/insights?access_token=${access_token}&metric=views`;
          const insightsResponse = await fetch(insightsUrl);
          if (!insightsResponse.ok) {
            throw new Error(
              `Failed to fetch insights for mediaId ${mediaId}: ${insightsResponse.status} ${insightsResponse.statusText}`,
            );
          }
          const insightsData = await insightsResponse.json();

          if (insightsData.data && insightsData.data.length > 0) {
            return insightsData.data[0].values[0].value;
          }
          return null;
        } catch (error) {
          console.error(
            `Error fetching insights for mediaId ${mediaId}:`,
            error,
          );
          return null;
        }
      });

      const playArray = await Promise.all(playPromises);
      allPlayCounts = allPlayCounts.concat(
        playArray.filter((play) => play !== null),
      ); // Accumulate valid play counts
    }

    // Calculate median and suggested rate
    let medianPlays = median(allPlayCounts);
    let suggestedRate = parseInt((medianPlays / 1000) * 2500);
    console.log("suggested rate: " + suggestedRate);

    return suggestedRate;
  } catch (error) {
    console.error("Failed to calculate suggested rate:", error);
    throw error; // Rethrow the error to be caught in the outer try-catch
  }
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
