require("dotenv").config()
const email = require('./email');
const cors = require('cors')({origin: true});
const firebase = require(process.env.PRODEV);
const moment = require('moment');
const fs = require('fs');
const path = require('path');

const findCreatorsForStudioBrief = async (req, res) => {
    cors(req, res, async () => {
  try {
    let { brand_id, message, task } = req.body;
    let matchingCreators = [];

    console.log("req body", req.body);
    let usersRef = await firebase.database().ref('users').once('value');
    let users = usersRef.val();

    // Get the regions from the task in the request body
    const taskRegions = task.regions.map(region => region.value);
    console.log("taskRegions", taskRegions);
    Object.entries(users).forEach(([key, user]) => {
                // Check if the user has the creator_tasks property
                if (user && user.creator_tasks) {
                    const userState = user.shipping_details && user.shipping_details.state.toUpperCase();
                    const userCountry = user.shipping_details && user.shipping_details.country.toUpperCase();

                    // Check if the user's state or country matches the task regions
                    const isRegionMatch = 
                        taskRegions.includes('USA') && userCountry === 'USA' ||
                        taskRegions.includes('CAN') && userCountry === 'CAN' ||
                        taskRegions.includes(userState);

                    if (isRegionMatch) {
                        // If the user's state or country matches a task region, add the user to the list
                        const userSummary = {
                            email: user.email || user.paypail_email,
                            id: key,
                            shipping_details: user.shipping_details
                        };

                        matchingCreators.push(userSummary);
                        console.log("add user ", userSummary);
                    }
                }
            });

    email.inviteCreators(matchingCreators, brand_id, task.name, message, task);
    console.log("matchingCreators", matchingCreators);
    res.status(200).json({ status: "200", statuscode: "1", message: message, length: matchingCreators.length, data: matchingCreators  });
  }
  catch (error) {
    console.error('Error finding creators for brief:', error);
    res.status(500).json({ status: "500", statuscode: "-1", message: 'Error finding creators for brief.' });
  }
    })
}

module.exports = { 
       findCreatorsForStudioBrief,
      }