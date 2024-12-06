# Crafted Cloud Functions

This repository contains all of Crafted's Google Cloud Functions. These functions are designed to handle various backend processes for the Crafted platform.

## Folder Structure

```bash
crafted_cloud_functions/
│
├── functions/
│   ├── getBalancedUsers/
│   ├── loadUsers/
│   ├── processInstagramComments/
│   ├── refreshAllCampaignAnalytics/
│   ├── refreshInstagramRates/
│   ├── refreshTokens/
│   ├── studioOutreach/
│   └── updateInstagramDemographics/
│
├── .gitignore
└── README.md
```

Each function folder contains:
- `index.js`: Main entry point for the function
- `package.json`: Function-specific dependencies and scripts
- Other relevant JavaScript files (e.g., `user.js`, `campaign.js`, etc.)


## Functions Description

Each folder inside the `functions` directory represents a separate Google Cloud Function:

1. **getBalancedUsers**: Retrieves a list of users with their balances.
2. **loadUsers**: Loads and reformat user data.
3. **processInstagramComments**: Processes comments from Instagram posts, likely for analytics or moderation.
4. **refreshAllCampaignAnalytics**: Refreshes analytics data for all campaigns, including data from TikTok and Instagram.
5. **refreshInstagramRates**: Updates Instagram suggested rates for creators.
6. **refreshTikTokRates**: Updates TikTok suggested rates for creators.
7. **refreshTokens**: Refreshes authentication tokens for maintaining access to third-party APIs.
8. **studioOutreach**: Handles creators email sending for campaign briefs.
9. **updateInstagramDemographics**: Updates demographic information based on Instagram data.

## Local Development Setup

To run these functions in a local environment, follow these steps:

1. Navigate to the function's directory:
```bash
   cd functions/[function-name]
```

2. Install dependencies:
```bash
   npm install
```

3. Set up environment variables:
Create a `.env` file in the function's directory and add the necessary environment variables.

4. Run a specific function locally:
```bash
   npm run dev
```
This command uses the `@google-cloud/functions-framework` to run the function specified in the `package.json` file. It will start the function on `http://localhost:8080` by default. You can then test the function by sending HTTP requests to this address.

## Cloud SDK Emulator Setup

For a more accurate Google Cloud-like environment, you can use the Cloud SDK Emulator:

1. Install Cloud SDK (if you don't have it):
```bash
    curl https://sdk.cloud.google.com | bash
    exec -l $SHELL
    gcloud init
```
2. Install the beta component (if necessary):
```bash
   gcloud components install beta
```

