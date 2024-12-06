require("dotenv").config();
const firebase = require(process.env.PRODEV);
const cors = require("cors")({ origin: true });
const xlsx = require("xlsx");

const fetchCampaignsPosts = async (req, res) => {
  const campaignPosts = [];

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
        const { posts } = tasks[taskId];
        for (const postId in posts) {
          console.log("Post: ", postId);
          const snapshot = await firebase
            .database()
            .ref("users/" + posts[postId].creator_id)
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
              creatorId: posts[postId].creator_id,
              creatorName: user?.shipping_details?.fullname || user.name,
              creatorUsername: user.username,
              creatorEmail: user.email,
              postLink: posts[postId].link,
            };

            campaignPosts.push(object);
          }
        }
      }
    }

    console.log("Results: ", campaignPosts);

    // Create a new workbook and worksheet for CampaignPosts
    const revisionWorkbook = xlsx.utils.book_new();
    const revisionWorksheet = xlsx.utils.json_to_sheet(campaignPosts);
    xlsx.utils.book_append_sheet(
      revisionWorkbook,
      revisionWorksheet,
      "CampaignPosts",
    );
    xlsx.writeFile(revisionWorkbook, "CampaignPosts.xlsx");

    res.send("All results written to CampaignPosts.xlsx.");
  });
};

module.exports = {
  fetchCampaignsPosts,
};
