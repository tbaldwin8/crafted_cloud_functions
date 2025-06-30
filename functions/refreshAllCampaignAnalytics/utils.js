require("dotenv").config();
const firebase = require(process.env.PRODEV);
const moment = require("moment");
const axios = require("axios");
const cors = require("cors")({ origin: true });

/**
 * Processes analytics for a single campaign.
 */
async function processCampaignAnalytics({ campaign_id, campaign, curDate }) {
  let { brand_id } = campaign;
  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalPosts = 0;
  let posts = 0;
  let totalClicks = 0;
  const tiktok_posts = [];
  const instagram_posts = [];
  const { tasks } = campaign;

  if (campaign.status === "completed") {
    console.warn(
      `[WARN] Campaign ${campaign_id} is completed. Skipping analytics processing.`,
    );
    return;
  }

  if (!tasks || Object.keys(tasks).length === 0) {
    console.warn(`[WARN] No tasks found for campaign ${campaign_id}`);
    return;
  }

  for (const [task_id, task] of Object.entries(tasks)) {
    const taskPosts = task.posts;

    if (!taskPosts || Object.keys(taskPosts).length === 0) {
      console.warn(
        `[WARN] No posts found for task ${task_id} in campaign ${campaign_id}`,
      );
      continue;
    }

    posts += Object.entries(taskPosts).length || 0;
    for (const [postId, post] of Object.entries(taskPosts)) {
      if (post.platform === "tiktok") {
        const videoId =
          post.link && post.link.split("/video/")[1]?.split("?")[0];
        const userSnapshotPromise = firebase
          .database()
          .ref(`users/${post.creator_id}/creator_socials/tiktok/access_token`)
          .once("value");
        const snapshot = await userSnapshotPromise;
        const accessToken = snapshot.val();
        if (accessToken && videoId) {
          const new_entry = {
            video_id: videoId,
            task_id: task_id,
            post_id: postId,
            token: accessToken,
            short_link: post.short_link,
            creator_id: post.creator_id,
          };
          tiktok_posts.push(new_entry);
        }
      }

      if (post.platform === "instagram") {
        const userSnapshotPromise = firebase
          .database()
          .ref(
            `users/${post.creator_id}/creator_socials/instagram/access_token`,
          )
          .once("value");
        const snapshot = await userSnapshotPromise;
        const accessToken = snapshot.val();
        if (accessToken) {
          const new_entry = {
            media_id: post.media_id,
            task_id: task_id,
            post_id: postId,
            token: accessToken,
            short_link: post.short_link,
            creator_id: post.creator_id,
          };
          instagram_posts.push(new_entry);
        } else if (!post.media_id) {
          const performanceRef = firebase
            .database()
            .ref(
              `influencer_campaigns/${campaign_id}/tasks/${task_id}/posts/${postId}/performance`,
            );
          const performanceSnapshot = await performanceRef.once("value");
          const performanceValue = performanceSnapshot.val();
          if (performanceValue !== null) {
            const new_entry = {
              task_id: task_id,
              post_id: postId,
              creator_id: post.creator_id,
              performance: performanceValue,
            };
            instagram_posts.push(new_entry);
          }
        }
      }
    }

    // 2 - iterate through each object in the array and make a call to TikTok to get the likes, comments, shares, views for that post -> add this to a new array of objects with the video ids as keys
    for (const post of tiktok_posts) {
      try {
        // Make call to TikTok API
        const performance_data = await fetchTikTokData(
          post,
          campaign_id,
          task_id,
        );

        if (!performance_data || Object.keys(performance_data).length === 0) {
          console.warn(
            `[WARN] No TikTok data found for post ID: ${post.post_id} in campaign ${campaign_id}`,
          );
          continue;
        }
        console.log("[INFO] TikTok post data: ", performance_data);

        // Make call to Bitly API
        if (post.short_link && post.short_link !== "") {
          const totalClicksForLink = await fetchBitlyData(post);
          performance_data.clicks =
            totalClicksForLink || performance_data.clicks || 0;
        }

        // Update your database with performance data
        updateDatabaseWithPerformanceData(
          performance_data,
          post,
          campaign_id,
          brand_id,
        );

        // Update totals
        totalViews += performance_data.views;
        totalLikes += performance_data.likes;
        totalShares += performance_data.shares;
        totalComments += performance_data.comments;
        totalClicks += performance_data.clicks;
        totalPosts += 1;
      } catch (error) {
        // Handle errors
        console.error(
          `[ERROR] Failed to fetch TikTok data for post ID: ${post.post_id} in campaign ${campaign_id}:`,
          error,
        );
      }
    }

    for (const post of instagram_posts) {
      let totalClicksForLink = 0;
      if (post.short_link && post.short_link !== "") {
        totalClicksForLink = await fetchBitlyData(post);
      }
      try {
        // Always use fetchInstagramData, regardless of media_id
        const performance_data = await fetchInstagramData(
          post,
          totalClicksForLink,
          campaign_id,
        );

        if (performance_data && Object.keys(performance_data).length > 0) {
          updateDatabaseWithPerformanceData(
            performance_data,
            post,
            campaign_id,
            brand_id,
          );

          totalViews += performance_data.views || 0;
          totalLikes += performance_data.likes || 0;
          totalShares += performance_data.shares || 0;
          totalComments += performance_data.comments || 0;
          totalClicks += performance_data.clicks || 0;
          totalPosts += 1;
        } else {
          totalPosts += 1;
          continue;
        }
      } catch (error) {
        // No need to fetch from Firebase here, handled in fetchInstagramData
        console.error(
          `[ERROR] Failed to fetch Instagram data for post ID: ${post.post_id} in campaign ${campaign_id}: `,
          error,
        );
      }
    }

    // 4 - iterate through each object in the post performance array and save the total number of posts, total Views, Likes, Comments, Shares -> write this info under the analytics tab for a campaign
    let campaignUpdate = {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalPosts: posts,
      totalClicks,
      updated: curDate,
    };

    campaignUpdate = Object.entries(campaignUpdate).reduce(
      (updatedCampaign, [key, value]) => {
        updatedCampaign[key] =
          key === "updated" ? value : isNaN(value) ? 0 : value;
        return updatedCampaign;
      },
      {},
    );

    campaignUpdate = Object.entries(campaignUpdate).reduce(
      (updatedCampaign, [key, value]) => {
        updatedCampaign[key] =
          key === "updated" ? value : isNaN(value) ? 0 : value;
        return updatedCampaign;
      },
      {},
    );

    const brandAnalyticsRef = firebase
      .database()
      .ref(
        `brands/${brand_id}/influencer_campaigns/${campaign_id}/historical_analytics`,
      );
    const newBrandAnalyticsRef = brandAnalyticsRef.push();
    newBrandAnalyticsRef.set(campaignUpdate);

    const influencerCampaignsAnalyticsRef = firebase
      .database()
      .ref(`influencer_campaigns/${campaign_id}/historical_analytics`);
    const newInfluencerCampaignsAnalyticsRef =
      influencerCampaignsAnalyticsRef.push();
    newInfluencerCampaignsAnalyticsRef.set(campaignUpdate);
  }
}

const isPerformanceValid = (metrics) => {
  return (
    "likes" in metrics &&
    "comments" in metrics &&
    "shares" in metrics &&
    "views" in metrics
  );
};

async function fetchTikTokData(post, campaign_id, task_id) {
  console.log("Post: ", post);
  const headers = {
    Authorization: `Bearer ${post.token}`,
    "Content-Type": "application/json",
  };
  const body = {
    filters: {
      video_ids: [post.video_id],
    },
  };

  try {
    const response = await axios.post(
      `https://open.tiktokapis.com/v2/video/query/?fields=id,share_count,like_count,comment_count,view_count`,
      body,
      { headers },
    );

    const { data: responseData } = response;

    if (responseData.data.videos.length === 0) {
      throw new Error("Failed to fetch from TikTok API. No videos found.");
    }

    const analytics = {
      likes: responseData.data.videos[0].like_count,
      comments: responseData.data.videos[0].comment_count,
      shares: responseData.data.videos[0].share_count,
      views: responseData.data.videos[0].view_count,
      date: moment().format(),
    };

    return analytics;
  } catch (error) {
    const message =
      error?.response?.statusText || error.message || "Unknown error";

    console.error(
      "[ERROR] Failed to fetch TikTok post information: ",
      error.response?.status,
      message,
    );

    try {
      // Fetch the latest valid performance object from Firebase (same as Instagram)
      console.log(
        `[INFO] Fetching post data from Firebase for post ID: ${post.post_id}`,
      );

      const performanceRef = firebase
        .database()
        .ref(
          `influencer_campaigns/${campaign_id}/tasks/${task_id}/posts/${post.post_id}/performance`,
        );
      const snapshot = await performanceRef
        .orderByChild("updated")
        .limitToLast(1)
        .once("value");

      let lastPerformance;
      snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        if (key.startsWith("-")) {
          lastPerformance = childSnapshot.val();
        }
      });

      if (lastPerformance) {
        if (!isPerformanceValid(lastPerformance)) {
          return null;
        }

        lastPerformance.date = moment().format();

        return lastPerformance;
      }

      return null;
    } catch (fbError) {
      console.error(
        "[ERROR] Failed to fetch TikTok performance from Firebase: ",
        fbError.message,
      );
    }
  }
}

async function fetchBitlyData(post) {
  const shortLink = post.short_link.replace("https://", "");
  try {
    console.log(`[INFO] Fetching Bitly data for short link: ${shortLink}`);
    const response = await axios.get(
      `https://api-ssl.bitly.com/v4/bitlinks/${shortLink}/clicks/summary?unit=day&units=-1`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BITLY_ACCESS_TOKEN}`,
        },
      },
    );

    return response.data.total_clicks;
  } catch (error) {
    const message =
      error?.response?.statusText || error.message || "Unknown error";

    console.error(
      "[ERROR] Failed to get data from Bitly API: ",
      error.response?.status,
      message,
    );

    return 0;
  }
}

function updateDatabaseWithPerformanceData(
  performance_data,
  post,
  campaign_id,
  brand_id,
) {
  const performanceRef = firebase
    .database()
    .ref(
      `influencer_campaigns/${campaign_id}/tasks/${post.task_id}/posts/${post.post_id}/performance`,
    );
  const newPerformanceRef = performanceRef.push();
  newPerformanceRef.set(performance_data);

  const influencerTasksRef = firebase
    .database()
    .ref(`influencer_tasks/${post.task_id}/posts/${post.post_id}/performance`);
  const newInfluencerTasksRef = influencerTasksRef.push();
  newInfluencerTasksRef.set(performance_data);

  const userInfluencerTasksRef = firebase
    .database()
    .ref(
      `users/${post.creator_id}/influencer_tasks/${post.task_id}/posts/${post.post_id}/performance`,
    );
  const newUserInfluencerTasksRef = userInfluencerTasksRef.push();
  newUserInfluencerTasksRef.set(performance_data);

  const brandInfluencerCampaignsRef = firebase
    .database()
    .ref(
      `brands/${brand_id}/influencer_campaigns/${campaign_id}/tasks/${post.task_id}/posts/${post.post_id}/performance`,
    );
  const newBrandInfluencerCampaignsRef = brandInfluencerCampaignsRef.push();
  newBrandInfluencerCampaignsRef.set(performance_data);
}

/**
 * Fetch Instagram insights for a post, or fallback to Firebase if needed.
 * @param {object} post - The post object containing media_id, token, etc.
 * @param {number} totalClicksForLink - The total clicks for the Bitly link.
 * @param {string} campaign_id - Campaign ID.
 * @returns {object} performance_data or empty object if failed.
 */
async function fetchInstagramData(post, totalClicksForLink, campaign_id) {
  try {
    if (!post.media_id) {
      throw new Error("Missing media_id");
    }

    const insightsUrl = `https://graph.facebook.com/v18.0/${post.media_id}/insights?access_token=${post.token}&metric=views,comments,likes,shares`;
    const insightsResponse = await axios.get(insightsUrl);
    const { data: insightsData } = insightsResponse;

    if (insightsData.error) {
      throw new Error(insightsData.error.message);
    }

    let performance_data = {};

    if (insightsData.data && insightsData.data.length > 0) {
      const plays = insightsData.data[0].values[0].value;
      const comments = insightsData.data[1].values[0].value;
      const likes = insightsData.data[2].values[0].value;
      const shares = insightsData.data[3].values[0].value;

      performance_data = {
        views: plays,
        comments: comments,
        likes: likes,
        shares: shares,
        clicks: totalClicksForLink,
        updated: moment().format(),
      };
    }

    return performance_data;
  } catch (error) {
    const message =
      error?.response?.statusText || error.message || "Unknown error";

    console.error(
      "[ERROR] Failed to fetch Instagram post information: ",
      error.response?.status,
      message,
    );

    try {
      // Fetch the latest valid performance object from Firebase (same as TikTok)
      console.log(
        `[INFO] Fetching post data from Firebase for post ID: ${post.post_id}`,
      );

      const performanceRef = firebase
        .database()
        .ref(
          `influencer_campaigns/${campaign_id}/tasks/${post.task_id}/posts/${post.post_id}/performance`,
        );
      const snapshot = await performanceRef
        .orderByChild("updated")
        .limitToLast(1)
        .once("value");

      let lastPerformance;
      snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        if (key.startsWith("-")) {
          lastPerformance = childSnapshot.val();
        }
      });

      if (lastPerformance) {
        if (!isPerformanceValid(lastPerformance)) {
          return null;
        }

        lastPerformance.updated = moment().format();

        return lastPerformance;
      }

      return null;
    } catch (fbError) {
      console.error(
        "[ERROR] Failed to fetch Instagram performance from Firebase: ",
        fbError.message,
      );
    }
    console.error(
      "[ERROR] Failed to fetch Instagram insights: ",
      error.message,
    );
    return {};
  }
}

module.exports = {
  processCampaignAnalytics,
};
