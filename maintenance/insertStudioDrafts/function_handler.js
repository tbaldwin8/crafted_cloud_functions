require("dotenv").config();
const firebase = require(process.env.PRODEV);
const cors = require("cors")({ origin: true });
const xlsx = require("xlsx");

const insertCampaignDrafts = async (req, res) => {
  const workbook = xlsx.readFile("studio_drafts_recovery.xlsx");

  cors(req, res, async () => {
    workbook.SheetNames.forEach(async (sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      data.forEach(async (row) => {
        const brandId = row["brandId"];
        const taskId = row["taskId"];
        const creatorId = row["creatorId"];
        const s3Link = row["s3Link"];

        const logObject = { brandId, taskId, creatorId, s3Link };

        if (!brandId || !taskId || !creatorId || !s3Link) {
          console.error("Missing data in row:", logObject);
          return;
        }

        try {
          await Promise.all([
            firebase
              .database()
              .ref(
                `brands/${brandId}/brand_tasks/${taskId}/drafts/${creatorId}/video`,
              )
              .set(s3Link),
            firebase
              .database()
              .ref(
                `tasks/${taskId}/drafts/${creatorId}/video`,
              )
              .set(s3Link),
            firebase
              .database()
              .ref(
                `users/${creatorId}creator_tasks/${taskId}/drafts/${creatorId}/video`,
              )
              .set(s3Link),
          ]);
        } catch (error) {
          console.error("Error writing data to Firebase:", logObject, error);
        }
      });
    });

    res.send(
      "All updates written into firebase.",
    );
  });
};

module.exports = {
  insertCampaignDrafts,
};
