require('dotenv').config();
const axios = require('axios');
const firebase = require(process.env.PRODEV);
const cors = require('cors')({origin: true});

const processInstagramComments = async (req, res) => {
  cors(req, res, async () => {
  try {
    // Fetch influencer campaigns
    const influencerCampaignsRef = firebase.database().ref('influencer_campaigns');
    const influencerCampaignsSnapshot = await influencerCampaignsRef.once('value');
    const influencerCampaigns = influencerCampaignsSnapshot.val();
    const allComments = {};
    for (const influencerCampaignId in influencerCampaigns) {
      const influencerCampaign = influencerCampaigns[influencerCampaignId];

      for (const taskId in influencerCampaign.tasks) {
        const task = influencerCampaign.tasks[taskId];

        if (task.posts) {
          for (const postId in task.posts) {
            const post = task.posts[postId];

            if (post.media_id) {
              // Retrieve the creator's Instagram business account ID and access token
              const creatorId = post.creator_id;
              const creatorRef = firebase.database().ref(`users/${creatorId}/creator_socials/instagram`);
              const creatorSnapshot = await creatorRef.once('value');
              const creatorData = creatorSnapshot.val();

              if (creatorData && creatorData.instagram_business_account_id && creatorData.access_token) {
                try {
                  // Making a request to the Instagram comments endpoint with access_token as a query parameter
                  const url = `https://graph.facebook.com/v24.0/${post.media_id}/comments?access_token=${creatorData.access_token}`;
                  
                  // Retrieving comments from the API
                  const response = await axios.get(url);
                  if (response.status === 400) {
                    console.log('Error retrieving comments for post:', postId);
                    continue; // Skip to the next post
                  }
                  if (response.data.error) {
                    console.log('Error retrieving comments for post:', postId);
                    continue; // Skip to the next post
                  }
                  // Storing the comments under the corresponding post
                  const comments = response.data.data;
                  if (!allComments[influencerCampaignId]) {
                    allComments[influencerCampaignId] = {};
                  }
                  if (!allComments[influencerCampaignId][taskId]) {
                    allComments[influencerCampaignId][taskId] = {};
                  }
                  if (!allComments[influencerCampaignId][taskId][postId]) {
                    allComments[influencerCampaignId][taskId][postId] = [];
                  }
                  allComments[influencerCampaignId][taskId][postId] = comments;
                  const commentsRef = firebase.database().ref('influencer_campaigns').child(influencerCampaignId).child('instagram_comments').child(postId);
                  await commentsRef.set(comments);
                } catch (error) {
                  console.error('Error retrieving comments for post:', postId, error);
                  continue; // Skip to the next post
                }
              }
            }
          }
        }
      }
    }

    // Send success response to the client
    res.status(200).json({ message: 'Influencer campaigns processed successfully' });
  } catch (error) {
    console.error('Error processing influencer campaigns:', error);
  }
   });
};

module.exports = { 
    processInstagramComments,
}