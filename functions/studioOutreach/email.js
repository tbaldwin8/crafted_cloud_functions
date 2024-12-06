const https = require("https");
require("dotenv").config();
const firebase = require(process.env.PRODEV);
const sgMail = require("@sendgrid/mail");
const fs = require("fs");

sgMail.setApiKey(process.env.SENGRID_API);

const from = "Crafted <team@usecrafted.com>";

const fetchEmailData = async (brand_id, task_id, creator_id) => {
  console.log(
    "fetching email data:",
    "brand_id",
    brand_id,
    "task_id",
    task_id,
    "creator_id",
    creator_id,
  );
  const [
    brand_nameSnapshot,
    brand_emailSnapshot,
    creator_emailSnapshot,
    creator_nameSnapshot,
    creator_fullnameSnapshot,
    task_name_snapshot,
    task_brief_snapshot,
  ] = await Promise.all([
    firebase.database().ref(`brands/${brand_id}/brand_name`).once("value"),
    firebase.database().ref(`brands/${brand_id}/email`).once("value"),
    firebase.database().ref(`users/${creator_id}/email`).once("value"),
    firebase.database().ref(`users/${creator_id}/name`).once("value"),
    firebase
      .database()
      .ref(`users/${creator_id}/shipping_details/fullname`)
      .once("value"),
    firebase.database().ref(`tasks/${task_id}/name`).once("value"),
    firebase.database().ref(`tasks/${task_id}/note3`).once("value"),
  ]);

  const brand_name = brand_nameSnapshot.val();
  const creator_name = creator_nameSnapshot.val();
  const task_name = task_name_snapshot.val();
  const brand_email = brand_emailSnapshot.val();
  const creator_fullname = creator_fullnameSnapshot.val();
  const creator_email = creator_emailSnapshot.val();
  const task_brief = task_brief_snapshot.val();
  console.log(
    "email data:",
    brand_name,
    creator_name,
    task_name,
    brand_email,
    creator_fullname,
    creator_email,
    task_brief,
  );
  return {
    brand_name,
    brand_email,
    creator_email,
    creator_name,
    creator_fullname,
    task_name,
    task_brief,
  };
};

const inviteCreators = async (creators, brand_id, task_name, message, task) => {
  try {
    console.log("task_name", task_name);
    const personalizations = [];
    const templatePath = "./StudioBriefInvite.html";
    let template = fs.readFileSync(templatePath, "utf8");

    if (!task.note3 || task.note3.trim() === "") {
      template = template.replace(
        /<li>Additional Information: <strong>{{note3}}<\/strong><\/li>/,
        "",
      );
    }
    if (!task.brief_link || task.brief_link.trim() === "") {
      template = template.replace(
        /<li>Brief Link: <strong>{{brief_link}}<\/strong><\/li>/,
        "",
      );
    }

    for (const creator of creators) {
      // Fetch email data for each creator inside the loop
      if (!creator.email) {
        continue;
      }
      
      console.log("creator", creator);
      const emailData = await fetchEmailData(brand_id, task.id, creator.id); // Assuming fetchEmailData can work with a single creator

      const renderedTemplate = template
        .replace(/{{brand_name}}/g, emailData.brand_name || emailData.name)
        .replace("{{name}}", creator.shipping_details.fullname)
        .replace("{{brand_email}}", emailData.brand_email)
        .replace(/{{task_name}}/g, task.name)
        .replace(/{{note1}}/g, task.note1)
        .replace(/{{note2}}/g, task.note2)
        .replace("{{note3}}", task.note3 || "")
        .replace("{{brief_link}}", task.brief_link || "")
        .replace("{{price}}", (task.price / 100).toFixed(2));

      personalizations.push({
        from,
        to: creator.email,
        subject: `You've been invited to ${emailData.brand_name}'s Studio brief!`,
        html: renderedTemplate,
      });
    }

    // If there are personalizations, send bulk email
    if (personalizations.length > 0) {
      // Send the emails
      console.log("Attempting to send emails...");
      const result = await sgMail.send(personalizations, true); // True for bulk

      // Log the SendGrid response
      console.log(`${result.length} emails sent successfully`);

      // Provide feedback on how many emails were sent successfully
      const successfulEmails = result.filter((r) => r[0].statusCode === 202);
      console.log(`${successfulEmails.length} emails accepted by SendGrid`);

      // Extract x-message-id values and join them with commas
      const messageIds = result
        .map((r) => r[0].headers["x-message-id"]) // Access x-message-id in headers
        .filter(Boolean) // Ensure x-message-id exists
        .join(","); // Join all IDs with commas

      return {
        messages: messageIds,
        sent: successfulEmails.length,
        failed: personalizations.length - successfulEmails.length,
      };
    } else {
      console.log("No valid creators to send emails to.");
      return { sent: 0, failed: 0, messages: "" };
    }
  } catch (error) {
    console.error("Failed to send emails: ", error);
  }
};

module.exports = {
  inviteCreators,
};
