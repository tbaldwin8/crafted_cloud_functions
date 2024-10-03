const https = require('https');
require("dotenv").config()
const cors = require('cors')({origin: true});
const firebase = require(process.env.PRODEV);
const nodemailer = require("nodemailer");
const sgMail = require('@sendgrid/mail');
const path = require('path');
const fs = require('fs');

sgMail.setApiKey(process.env.SENGRID_API);

const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 465,
  secure: true,
  auth: {
    user: 'apikey',
    pass: process.env.SENGRID_API
  },
	tls: {
		ciphers:'SSLv3'
},
});

const from  =  'Crafted <team@usecrafted.com>';

const fetchEmailData = async (brand_id, task_id, creator_id) => {
  console.log("fetching email data:", "brand_id", brand_id, "task_id", task_id, "creator_id", creator_id);
  const [
    brand_nameSnapshot,
    brand_emailSnapshot,
    creator_emailSnapshot,
    creator_nameSnapshot,
    creator_fullnameSnapshot,
    task_name_snapshot,
    task_brief_snapshot
  ] = await Promise.all([
    firebase.database().ref(`brands/${brand_id}/brand_name`).once('value'),
    firebase.database().ref(`brands/${brand_id}/email`).once('value'),
    firebase.database().ref(`users/${creator_id}/email`).once('value'),
    firebase.database().ref(`users/${creator_id}/name`).once('value'),
    firebase.database().ref(`users/${creator_id}/shipping_details/fullname`).once('value'),
    firebase.database().ref(`tasks/${task_id}/name`).once('value'),
    firebase.database().ref(`tasks/${task_id}/note3`).once('value')
  ]);

  const brand_name = brand_nameSnapshot.val();
  const creator_name = creator_nameSnapshot.val();
  const task_name = task_name_snapshot.val();
  const brand_email = brand_emailSnapshot.val();
  const creator_fullname = creator_fullnameSnapshot.val();
  const creator_email = creator_emailSnapshot.val();
  const task_brief = task_brief_snapshot.val();
  console.log("email data:", brand_name, creator_name, task_name, brand_email, creator_fullname, creator_email, task_brief);
  return {
    brand_name,
    brand_email,
    creator_email,
    creator_name,
    creator_fullname,
    task_name,
    task_brief
  };
}

const inviteCreators = async (creators, brand_id, task_name, message, task) => {
  try {
    console.log("task_name", task_name);
    const templatePath = './StudioBriefInvite.html';
    let template = fs.readFileSync(templatePath, 'utf8');
    if (!task.note3 || task.note3.trim() === '') {
      template = template.replace(/<li>Additional Information: <strong>{{note3}}<\/strong><\/li>/, '');
    }
    if (!task.brief_link || task.brief_link.trim() === '') {
      template = template.replace(/<li>Brief Link: <strong>{{brief_link}}<\/strong><\/li>/, '');
    }

    for (const creator of creators) {
      try {
        // Fetch email data for each creator inside the loop
        console.log("creator", creator);
        const emailData = await fetchEmailData(brand_id, task.id, creator.id); // Assuming fetchEmailData can work with a single creator
        
        const renderedTemplate = template
          .replace(/{{brand_name}}/g, emailData.brand_name || emailData.name)
          .replace('{{name}}', creator.shipping_details.fullname)
          .replace('{{brand_email}}', emailData.brand_email)
          .replace(/{{task_name}}/g, task.name)
          .replace(/{{note1}}/g, task.note1)
          .replace(/{{note2}}/g, task.note2)
          .replace('{{note3}}', task.note3 || '')
          .replace('{{brief_link}}', task.brief_link || '')
          .replace('{{price}}', (task.price / 100).toFixed(2));
        
        const mailOptions = {
          from: from,
          to: creator.email,
          subject: `You've been invited to ${emailData.brand_name}'s Studio brief!`,
          html: renderedTemplate
        };
        
        await transporter.sendMail(mailOptions);
        console.log('Email sent to:', creator.email);
      } catch (error) {
        console.log('Error sending email to:', creator.email, error);
      }
    }
    
    console.log('All emails processed');
  } catch (error) {
    console.error('Error:', error);
    console.log('Failed to send emails');
  }
}

module.exports = {
  inviteCreators,
}