require("dotenv").config();
const firebase = require(process.env.PRODEV);
const moment = require("moment");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cors = require("cors")({ origin: true });
const {
  fetchCampaignBatch,
  processCampaignAnalytics,
  getCampaignIds,
} = require("./utils");

const BATCH_SIZE = 10;

const refreshAllCampaignAnalytics = async (req, res) => {
  cors(req, res, async () => {
    try {
      let curDate = moment().format();

      // Get all campaign IDs first
      const campaignIds = await getCampaignIds(firebase);
      console.log(`[INFO] Found ${campaignIds.length} campaigns to process.`);

      for (let i = 0; i < campaignIds.length; i += BATCH_SIZE) {
        const batchIds = campaignIds.slice(i, i + BATCH_SIZE);
        console.log(
          `[INFO] Processing batch ${i / BATCH_SIZE + 1}: ${batchIds.join(", ")}`,
        );

        // Fetch only the batch of campaigns
        const campaigns = await fetchCampaignBatch(firebase, batchIds);

        for (const [campaign_id, campaign] of Object.entries(campaigns)) {
          if (!campaign) {
            console.warn(`[WARN] Campaign ${campaign_id} not found or is null.`);
            continue;
          }
          try {
            await processCampaignAnalytics({
              firebase,
              fetch,
              moment,
              campaign_id,
              campaign,
              curDate,
            });
            console.log(
              `[SUCCESS] Processed analytics for campaign ${campaign_id}`,
            );
          } catch (err) {
            console.error(
              `[ERROR] Failed processing campaign ${campaign_id}:`,
              err,
            );
          }
        }
      }

      res.status(200).json({
        statuscode: 200,
        message: "Successfully updated campaign analytics",
      });
    } catch (error) {
      console.error("[FATAL] Error finding campaigns for brand", error);
      res
        .status(500)
        .json({ statuscode: 500, message: "Failed to find campaigns." });
    }
  });
};

module.exports = {
  refreshAllCampaignAnalytics,
};
