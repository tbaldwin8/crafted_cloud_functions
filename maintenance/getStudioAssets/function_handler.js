require("dotenv").config();
const firebase = require(process.env.PRODEV);
const cors = require("cors")({ origin: true });
const xlsx = require("xlsx");

const fetchStudioAssets = async (req, res) => {
  const StudioAssets = [];

  cors(req, res, async () => {
    const tasksSnapshot = await firebase.database().ref("tasks").once("value");
    const tasks = tasksSnapshot.val();

    for (const taskId in tasks) {
      console.log("Task: ", taskId);
      const { assets } = tasks[taskId];
      for (const assetId in assets) {
        let snapshot = null;
        console.log("Asset: ", assets);
        snapshot = await firebase
          .database()
          .ref("users/" + assets[assetId].creator_uid)
          .once("value");
        if (snapshot.val()) {
          const user = snapshot.val();
          const object = {
            brandId: tasks[taskId].brand_id,
            brandName: tasks[taskId].brand_name,
            taskId,
            taskName: tasks[taskId].name,
            creatorId: assets[assetId].creator_uid,
            creatorName: user?.shipping_details?.fullname || user.name,
            creatorUsername: user.username,
            creatorEmail: user.email,
            assetType: assets[assetId].type,
            assetLink: assets[assetId].source,
          };

          StudioAssets.push(object);
        }
      }
    }

    console.log("Results: ", StudioAssets);

    // Create a new workbook and worksheet for StudioAssets
    const revisionWorkbook = xlsx.utils.book_new();
    const revisionWorksheet = xlsx.utils.json_to_sheet(StudioAssets);
    xlsx.utils.book_append_sheet(
      revisionWorkbook,
      revisionWorksheet,
      "StudioAssets",
    );
    xlsx.writeFile(revisionWorkbook, "StudioAssets.xlsx");

    res.send(
      "All results written to CreatorsRevisions.xlsx and CreatorsPending.xlsx.",
    );
  });
};

module.exports = {
  fetchStudioAssets,
};
