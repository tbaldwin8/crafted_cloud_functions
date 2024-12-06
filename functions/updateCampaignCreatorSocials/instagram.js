require("dotenv").config();
const firebase = require(process.env.PRODEV);
const cors = require("cors")({ origin: true });

const fetchAndUpdateInstagramDemographics = async (req, res) => {
  cors(req, res, async () => {
    const campaignsSnapshot = await firebase
      .database()
      .ref("influencer_campaigns")
      .once("value");
    const campaigns = campaignsSnapshot.val();

    for (const campaignId in campaigns) {
      console.log("Campaign: ", campaignId);
      const { tasks } = campaigns[campaignId];
      for (const taskId in tasks) {
        console.log("Task: ", taskId);
        const { proposals } = tasks[taskId];
        for (const proposalId in proposals) {
          console.log("Proposal: ", proposalId);
          const snapshot = await firebase
            .database()
            .ref(
              "users/" +
                proposals[proposalId].creator_id +
                "/creator_socials/instagram/demographics",
            )
            .once("value");
          if (snapshot.val())
            firebase
              .database()
              .ref(
                "influencer_campaigns/" +
                  campaignId +
                  "/tasks/" +
                  taskId +
                  "/proposals/" +
                  proposalId +
                  "/creator_socials/instagram/demographics",
              )
              .set(snapshot.val());
        }
      }
    }

    res.send("All campaigns updated.");
  });
};

module.exports = {
  fetchAndUpdateInstagramDemographics,
};
