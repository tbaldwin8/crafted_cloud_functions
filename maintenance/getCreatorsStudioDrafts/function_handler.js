require("dotenv").config();
const firebase = require(process.env.PRODEV);
const cors = require("cors")({ origin: true });
const xlsx = require("xlsx");

const fetchCreatorsStudioDrafts = async (req, res) => {
  const StudioPendingTasks = [];
  const StudioRevisionTasks = [];

  cors(req, res, async () => {
    const tasksSnapshot = await firebase.database().ref("tasks").once("value");
    const tasks = tasksSnapshot.val();

    for (const taskId in tasks) {
      console.log("Task: ", taskId);
      const { drafts } = tasks[taskId];
      for (const draftId in drafts) {
        let snapshot = null;
        switch (drafts[draftId].status) {
          case "revisions":
            console.log("Draft: ", draftId);
            snapshot = await firebase
              .database()
              .ref("users/" + drafts[draftId].creator_id)
              .once("value");
            if (snapshot.val()) {
              const user = snapshot.val();
              const videoUrl = drafts[draftId].video;
              const draftName = videoUrl.substring(
                videoUrl.lastIndexOf("/") + 1,
              );
              const object = {
                brandId: tasks[taskId].brand_id,
                brandName: tasks[taskId].brand_name,
                taskId,
                taskName: tasks[taskId].name,
                creatorId: drafts[draftId].creator_id,
                creatorName: user.name,
                creatorUsername: user.username,
                creatorEmail: user.email,
                draftName,
                revisionNotes: drafts[draftId].revision_notes,
              };

              StudioRevisionTasks.push(object);
            }
            break;

          case "pending":
            console.log("Draft: ", draftId);
            snapshot = await firebase
              .database()
              .ref("users/" + drafts[draftId].creator_id)
              .once("value");
            if (snapshot.val()) {
              const user = snapshot.val();
              const videoUrl = drafts[draftId].video;
              const draftName = videoUrl.substring(
                videoUrl.lastIndexOf("/") + 1,
              );
              const object = {
                brandId: tasks[taskId].brand_id,
                brandName: tasks[taskId].brand_name,
                taskId,
                taskName: tasks[taskId].name,
                creatorId: drafts[draftId].creator_id,
                creatorName: user.name,
                creatorUsername: user.username,
                creatorEmail: user.email,
                draftName,
              };

              StudioPendingTasks.push(object);
            }
            break;

          default:
            break;
        }
      }
    }

    console.log("Results: ", StudioRevisionTasks, StudioPendingTasks);

    // Create a new workbook and worksheet for StudioRevisionTasks
    const revisionWorkbook = xlsx.utils.book_new();
    const revisionWorksheet = xlsx.utils.json_to_sheet(StudioRevisionTasks);
    xlsx.utils.book_append_sheet(revisionWorkbook, revisionWorksheet, "StudioRevisions");
    xlsx.writeFile(revisionWorkbook, "StudioRevisions.xlsx");

    // Create a new workbook and worksheet for StudioPendingTasks
    const pendingWorkbook = xlsx.utils.book_new();
    const pendingWorksheet = xlsx.utils.json_to_sheet(StudioPendingTasks);
    xlsx.utils.book_append_sheet(pendingWorkbook, pendingWorksheet, "StudioPending");
    xlsx.writeFile(pendingWorkbook, "StudioPending.xlsx");

    res.send("All results written to CreatorsRevisions.xlsx and CreatorsPending.xlsx.");
  });
};

module.exports = {
  fetchCreatorsStudioDrafts,
};
