require("dotenv").config();
const email = require("./email");
const cors = require("cors")({ origin: true });
const firebase = require(process.env.PRODEV);

const findCreatorsForStudioBrief = async (req, res) => {
  cors(req, res, async () => {
    try {
      let { brand_id, message, task } = req.body;
      let matchingCreators = [];

      console.log("req body", req.body);

      // Get the regions from the task in the request body
      const taskRegions = task.regions.map((region) => region.value);
      console.log("taskRegions", taskRegions);

      const usersRef = firebase.database().ref("users");
      let lastKey = null;
      const batchSize = 100; // Adjust as needed

      let moreUsers = true;
      while (moreUsers) {
        let query = usersRef.orderByKey().limitToFirst(batchSize);
        if (lastKey) {
          query = query.startAfter(lastKey);
        }
        const usersSnapshot = await query.once("value");
        const users = usersSnapshot.val();

        if (!users) break;

        const userKeys = Object.keys(users);
        lastKey = userKeys[userKeys.length - 1];
        if (userKeys.length < batchSize) {
          moreUsers = false;
        }

        Object.entries(users).forEach(([key, user]) => {
          // Check if the user has the creator_tasks property
          if (user && user.creator_tasks) {
            const userState =
              user.shipping_details && user.shipping_details.state && user.shipping_details.state.toUpperCase();
            const userCountry =
              user.shipping_details &&
              user.shipping_details.country && user.shipping_details.country.toUpperCase();

            // Check if the user's state or country matches the task regions
            const isRegionMatch =
              (taskRegions.includes("USA") && userCountry === "USA") ||
              (taskRegions.includes("CAN") && userCountry === "CAN") ||
              (userState && taskRegions.includes(userState));

            if (isRegionMatch) {
              // If the user's state or country matches a task region, add the user to the list
              const userSummary = {
                email: user.email || user.paypail_email,
                id: key,
                shipping_details: user.shipping_details,
              };

              matchingCreators.push(userSummary);
            }
          }
        });
      }

      const blastResults = await email.inviteCreators(
        matchingCreators,
        brand_id,
        task.name,
        message,
        task,
      );

      console.log("Blast Results: ", blastResults);

      await updateCampaignInviteResults({taskId: task.uid, payload: blastResults})

      return res.status(200).json({
        status: "200",
        statuscode: "1",
        message: message,
        length: matchingCreators.length,
        data: matchingCreators,
      });
    } catch (error) {
      console.error("Error finding creators for brief:", error);
      return res.status(500).json({
        status: "500",
        statuscode: "-1",
        message: "Error finding creators for brief.",
      });
    }
  });
};

const updateCampaignInviteResults = async ({ taskId, payload }) => {
  try {
    return await firebase
      .database()
      .ref(`tasks/${taskId}/invites`)
      .set(payload);
  } catch (error) {
    console.error("Failed to update invites analytics:", error);
    throw new Error(`Failed to update invites analytics: ${error?.message}`);
  }
};

module.exports = {
  findCreatorsForStudioBrief,
};
