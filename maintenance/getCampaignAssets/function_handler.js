require("dotenv").config();
const firebase = require(process.env.PRODEV);
const cors = require("cors")({ origin: true });
const xlsx = require("xlsx");

const fetchCampaignAssets = async (req, res) => {
  const campaignsAssets = [];

  cors(req, res, async () => {
    const campaignsSnapshot = await firebase
      .database()
      .ref("influencer_campaigns")
      .once("value");
    const campaigns = campaignsSnapshot.val();

    for (const campaignId in campaigns) {
      const { tasks } = campaigns[campaignId];

      for (const taskId in tasks) {
        console.log("Task: ", taskId);
        const { assets } = tasks[taskId];
        for (const assetId in assets) {
          console.log("Asset: ", assets);

          const snapshot = await firebase
            .database()
            .ref("users/" + assets[assetId].creator_id)
            .once("value");

          if (snapshot.val()) {
            const user = snapshot.val();

            const object = {
              brandId: tasks[taskId].brand_id,
              brandName: tasks[taskId].brand_name,
              campaignId,
              campaignName: campaigns[campaignId].campaign_name,
              taskId,
              taskName: tasks[taskId].name,
              creatorId: assets[assetId].creator_id,
              creatorName: user?.shipping_details?.fullname || user.name,
              creatorUsername: user.username,
              creatorEmail: user.email,
              assetType: assets[assetId].type,
              assetLink: assets[assetId].source,
            };

            campaignsAssets.push(object);
          }
        }
      }
    }

    console.log("Results: ", campaignsAssets);

    // Create a new workbook and worksheet for CampaignsAssets
    const revisionWorkbook = xlsx.utils.book_new();
    const revisionWorksheet = xlsx.utils.json_to_sheet(campaignsAssets);
    xlsx.utils.book_append_sheet(
      revisionWorkbook,
      revisionWorksheet,
      "CampaignsAssets",
    );
    xlsx.writeFile(revisionWorkbook, "CampaignsAssets.xlsx");

    res.send("All results written to CampaignsAssets.xlsx.");
  });
};

module.exports = {
  fetchCampaignAssets,
};
