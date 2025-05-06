require("dotenv").config();
const firebase = require(process.env.PRODEV);
const moment = require("moment");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cors = require("cors")({ origin: true });

const refreshAllCampaignAnalytics = async (req, res) => {
  cors(req, res, async () => {
    try {
      let curDate = moment().format();

      const snapshot = await firebase
        .database()
        .ref("influencer_campaigns")
        .once("value");
      const campaigns = snapshot.val();

      for (const [campaign_id, campaign] of Object.entries(campaigns)) {
        let brand_id = campaign.brand_id;
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        let totalPosts = 0;
        let posts = 0;
        let totalClicks = 0;
        const tiktok_posts = [];
        const instagram_posts = [];
        const tasks = campaign.tasks;

        for (const [task_id, task] of Object.entries(tasks)) {
          const task_posts = task.posts;

          console.log("posts: " + posts);
          if (
            task_posts &&
            Object.keys(task_posts).length > 0 &&
            campaign.status != "completed"
          ) {
            posts += Object.entries(task_posts).length || 0;
            hasPosts = true;
            for (const [post_id, task_post] of Object.entries(task_posts)) {
              if (task_post.platform === "tiktok") {
                const video_id =
                  task_post.link &&
                  task_post.link.split("/video/")[1]?.split("?")[0];
                const userSnapshotPromise = firebase
                  .database()
                  .ref(
                    `users/${task_post.creator_id}/creator_socials/tiktok/access_token`,
                  )
                  .once("value");
                const snapshot = await userSnapshotPromise;
                const accessToken = snapshot.val();
                if (accessToken && video_id) {
                  const new_entry = {
                    video_id: video_id,
                    task_id: task_id,
                    post_id: post_id,
                    token: accessToken,
                    short_link: task_post.short_link,
                    creator_id: task_post.creator_id,
                  };
                  tiktok_posts.push(new_entry);
                }
              }

              if (hasPosts) {
                if (task_post.platform === "instagram") {
                  const userSnapshotPromise = firebase
                    .database()
                    .ref(
                      `users/${task_post.creator_id}/creator_socials/instagram/access_token`,
                    )
                    .once("value");
                  const snapshot = await userSnapshotPromise;
                  const accessToken = snapshot.val();
                  if (accessToken) {
                    const new_entry = {
                      media_id: task_post.media_id,
                      task_id: task_id,
                      post_id: post_id,
                      token: accessToken,
                      short_link: task_post.short_link,
                      creator_id: task_post.creator_id,
                    };
                    //console.log("new entry", new_entry);
                    instagram_posts.push(new_entry);
                  } else if (!task_post.media_id) {
                    //console.log
                    const performanceRef = firebase
                      .database()
                      .ref(
                        `influencer_campaigns/${campaign_id}/tasks/${task_id}/posts/${post_id}/performance`,
                      );
                    const performanceSnapshot = await performanceRef.once(
                      "value",
                    );
                    const performanceValue = performanceSnapshot.val();
                    if (performanceValue !== null) {
                      const new_entry = {
                        task_id: task_id,
                        post_id: post_id,
                        creator_id: task_post.creator_id,
                        performance: performanceValue,
                      };
                      //console.log("new entry", new_entry);
                      instagram_posts.push(new_entry);
                    }
                  }
                }
              }
            }

            //await Promise.all(promises);
            // 2 - iterate through each object in the array and make a call to TikTok to get the likes, comments, shares, views for that post -> add this to a new array of objects with the video ids as keys
            console.log("Before for loop: " + totalViews);
            console.log(tiktok_posts);
            for (const post of tiktok_posts) {
              let totalClicksForLink = 0;
              let performance_data;

              try {
                // Make call to TikTok API
                const tiktokResponse = await fetchTikTokData(
                  post,
                  campaign_id,
                  task_id,
                );

                if (tiktokResponse) {
                  performance_data = {
                    likes: tiktokResponse.data.videos[0].like_count,
                    comments: tiktokResponse.data.videos[0].comment_count,
                    shares: tiktokResponse.data.videos[0].share_count,
                    views: tiktokResponse.data.videos[0].view_count,
                    date: moment().format(),
                  };
                }

                // Make call to Bitly API
                if (post.short_link && post.short_link !== "") {
                  totalClicksForLink = await fetchBitlyData(post);
                }

                if (performance_data) {
                  performance_data.clicks = totalClicksForLink;

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

                  console.log("total likes: " + performance_data.likes);
                  console.log("TikTok: " + totalViews);
                }
              } catch (error) {
                // Handle errors
                console.log("error:" + error);
              }
            }

            async function fetchTikTokData(post, campaign_id, task_id) {
              const headers = {
                Authorization: `Bearer ${post.token}`,
                "Content-Type": "application/json",
              };
              const body = {
                filters: {
                  video_ids: [post.video_id],
                },
              };

              const options = {
                method: "POST",
                headers,
                body: JSON.stringify(body),
              };
              try {
                const response = await fetch(
                  `https://open.tiktokapis.com/v2/video/query/?fields=id,share_count,like_count,comment_count,view_count`,
                  options,
                );

                const responseData = await response.json();

                if (!responseData.data.videos.length) {
                  throw new Error(
                    "Failed to fetch from TikTok API. No videos found.",
                  );
                }

                return responseData;
              } catch (error) {
                console.log("Error w/ TikTok API: " + error);
                // Fetch the initial data from Firebase
                const postsRef = firebase
                  .database()
                  .ref(
                    `influencer_campaigns/${campaign_id}/tasks/${task_id}/posts`,
                  );
                const postsSnapshot = await postsRef.once("value");
                const postsData = postsSnapshot.val();
                if (postsData) {
                  console.log(
                    "TikTok api failed: retrieving data from Firebase",
                  );
                  // Get the last object that starts with "-"
                  const postKeys = Object.keys(postsData);
                  console.log("Post data: ", postsData);
                  const lastObjectKey = postKeys
                    .filter((key) => key.startsWith("-"))
                    .sort()
                    .pop();
                  if (lastObjectKey) {
                    console.log("PostsData taken: ", postsData[lastObjectKey]);
                    // Get the metrics from that object
                    // Create a new analytics object

                    if (!isPostValid(postsData)) {
                      console.log(
                        "Invalid post data: ",
                        postsData[lastObjectKey],
                      );
                      return null;
                    }

                    const { performance: metrics } = postsData[lastObjectKey];
                    const analytics = {
                      likes: metrics.likes,
                      comments: metrics.comments,
                      shares: metrics.shares,
                      views: metrics.views,
                      date: moment().format(),
                    };
                    // Add the metrics to the total variables
                    totalViews += analytics.views;
                    totalLikes += analytics.likes;
                    totalShares += analytics.shares;
                    totalComments += analytics.comments;
                    totalPosts += 1;
                    // Push a new key in Firebase
                    const performanceRef = firebase
                      .database()
                      .ref(
                        `influencer_campaigns/${campaign_id}/tasks/${task_id}/posts/${post.post_id}/performance`,
                      );
                    const newPerformanceRef = performanceRef.push();
                    newPerformanceRef.set(analytics);
                    return analytics;
                  }
                }
                return null;
              }
            }

            async function fetchBitlyData(post) {
              const shortLink = post.short_link.replace("https://", "");
              const response = await fetch(
                `https://api-ssl.bitly.com/v4/bitlinks/${shortLink}/clicks/summary?unit=day&units=-1`,
                {
                  headers: {
                    Authorization: `Bearer ${process.env.BITLY_ACCESS_TOKEN}`,
                  },
                },
              );

              if (response.ok) {
                const responseData = await response.json();
                console.log("Bitly Response:", responseData);
                return responseData.total_clicks;
              } else {
                console.error(
                  "Failed to get data from Bitly API",
                  response.status,
                  response.statusText,
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
                .ref(
                  `influencer_tasks/${post.task_id}/posts/${post.post_id}/performance`,
                );
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
              const newBrandInfluencerCampaignsRef =
                brandInfluencerCampaignsRef.push();
              newBrandInfluencerCampaignsRef.set(performance_data);
            }

            for (const post of instagram_posts) {
              console.log(post);
              let totalClicksForLink = 0;
              if (post.short_link && post.short_link !== "") {
                const shortLink = post.short_link.replace("https://", "");
                console.log("Short Link: ", shortLink);
                const response = await fetch(
                  `https://api-ssl.bitly.com/v4/bitlinks/${shortLink}/clicks/summary?unit=day&units=-1`,
                  {
                    headers: {
                      Authorization: `Bearer ${process.env.BITLY_ACCESS_TOKEN}`,
                    },
                  },
                );

                if (response.ok) {
                  const responseData = await response.json();
                  console.log("Bitly Response:", responseData);
                  totalClicksForLink = responseData.total_clicks;

                  // Update the total clicks for the short_link in the database
                  // You need to implement this part based on your database structure
                } else {
                  console.error(
                    "Failed to get data from Bitly API",
                    response.status,
                    response.statusText,
                  );
                }
              }
              if (post.media_id) {
                try {
                  // MAKE A CALL TO INSTAGRAM API
                  //  console.log("instagram post info:" + post.media_id);
                  const insightsUrl = `https://graph.facebook.com/v18.0/${post.media_id}/insights?access_token=${post.token}&metric=views,comments,likes,shares`;
                  const insightsResponse = await fetch(insightsUrl);
                  const insightsData = await insightsResponse.json();
                  if (insightsData.error) {
                    throw new Error(insightsData.error.message);
                  }
                  //  console.log(insightsData);
                  let performance_data = {};
                  if (insightsData.data && insightsData.data.length > 0) {
                    const plays = insightsData.data[0].values[0].value;
                    const comments = insightsData.data[1].values[0].value;
                    const likes = insightsData.data[2].values[0].value;
                    const shares = insightsData.data[3].values[0].value;

                    //  console.log("Plays: ", plays);
                    //   console.log("Comments: ", comments);
                    ///  console.log("Likes: ", likes);
                    //  console.log("Shares: ", shares);

                    performance_data = {
                      views: plays,
                      comments: comments,
                      likes: likes,
                      shares: shares,
                      clicks: totalClicksForLink,
                      updated: moment().format(),
                    };
                  }
                  // console.log("performance data", performance_data);

                  const performanceRef = firebase
                    .database()
                    .ref(
                      `influencer_campaigns/${campaign_id}/tasks/${post.task_id}/posts/${post.post_id}/performance`,
                    );
                  const newPerformanceRef = performanceRef.push();
                  newPerformanceRef.set(performance_data);

                  const influencerTasksRef = firebase
                    .database()
                    .ref(
                      `influencer_tasks/${post.task_id}/posts/${post.post_id}/performance`,
                    );
                  const newInfluencerTasksRef = influencerTasksRef.push();
                  newInfluencerTasksRef.set(performance_data);

                  const userInfluencerTasksRef = firebase
                    .database()
                    .ref(
                      `users/${post.creator_id}/influencer_tasks/${post.task_id}/posts/${post.post_id}/performance`,
                    );
                  const newUserInfluencerTasksRef =
                    userInfluencerTasksRef.push();
                  newUserInfluencerTasksRef.set(performance_data);

                  const brandInfluencerCampaignsRef = firebase
                    .database()
                    .ref(
                      `brands/${brand_id}/influencer_campaigns/${campaign_id}/tasks/${post.task_id}/posts/${post.post_id}/performance`,
                    );
                  const newBrandInfluencerCampaignsRef =
                    brandInfluencerCampaignsRef.push();
                  newBrandInfluencerCampaignsRef.set(performance_data);
                  //  console.log("total views before IG: " + totalViews);
                  if (Object.keys(performance_data).length === 0) {
                    totalPosts += 1;
                    continue;
                  } else {
                    totalViews += performance_data.views;
                    totalLikes += performance_data.likes;
                    totalShares += performance_data.shares;
                    totalComments += performance_data.comments;
                    totalClicks += performance_data.clicks;
                    totalPosts += 1;
                  }
                  // Update your database with performance data
                } catch (error) {
                  console.log("error:" + error);

                  // Fetch the last added performance object
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

                  console.log(lastPerformance);

                  if (lastPerformance) {
                    // Copy the data over to newPerformanceRef
                    lastPerformance.updated = moment().format();
                    const newPerformanceRef = performanceRef.push();
                    newPerformanceRef.set(lastPerformance);

                    // Add the values from lastPerformance to the totals
                    totalViews += lastPerformance.views || 0;
                    totalLikes += lastPerformance.likes || 0;
                    totalShares += lastPerformance.shares || 0;
                    totalComments += lastPerformance.comments || 0;
                    totalClicks += lastPerformance.clicks || 0;
                  }
                }
              } else if (!post.media_id) {
                const postSnapshot = await firebase
                  .database()
                  .ref(
                    `influencer_campaigns/${campaign_id}/tasks/${post.task_id}/posts/${post.post_id}`,
                  )
                  .once("value");
                const postValue = postSnapshot.val();
                console.log("POST WITHOUT MEDIA ID: ", postValue);
                console.log("PERFORMANCE: ", postValue.performance);

                if (!postValue.performance) {
                  continue;
                }
                const performanceUpdate = {
                  likes: parseFloat(postValue.performance.likes),
                  comments: parseFloat(postValue.performance.comments),
                  shares: parseFloat(postValue.performance.shares),
                  views: parseFloat(postValue.performance.views),
                  updated: moment().format(),
                };

                const postRef = firebase
                  .database()
                  .ref(
                    `influencer_campaigns/${campaign_id}/tasks/${post.task_id}/posts/${post.post_id}/performance`,
                  );

                await postRef.update(performanceUpdate);

                totalViews += parseInt(postValue.performance.views);
                totalLikes += parseInt(postValue.performance.likes);
                totalShares += parseInt(postValue.performance.shares);
                totalComments += parseInt(postValue.performance.comments);
                totalPosts += 1;
              }
            }
            console.log("After for loop:" + totalViews);
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
          } else {
            console.log("no posts");
          }
        }
      }
      res.status(200).json({
        statuscode: 200,
        message: "Successfully updated campaign analytics",
      });
    } catch (error) {
      console.error("Error finding campaigns for brand", error);
      res
        .status(500)
        .json({ statuscode: 500, message: "Failed to find campaigns." });
    }
  });
};

const isPostValid = (post) => {
  const { performance: metrics } = post;

  return (
    metrics &&
    "likes" in metrics &&
    "comments" in metrics &&
    "shares" in metrics &&
    "views" in metrics
  );
};

module.exports = {
  refreshAllCampaignAnalytics,
};
