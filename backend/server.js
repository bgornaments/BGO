const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const { BedrockRuntime } = require('@aws-sdk/client-bedrock-runtime');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Redis client
const redisClient = redis.createClient();

// AWS Bedrock client configuration
const bedrockClient = new BedrockRuntime({
  region: 'us-east-1', 
});

// Conversation templates
const PROMPT_TEMPLATE = `
You are an expert jewellery designer engaged in a conversation with a customer to understand their specific design needs. 
Below is the conversation so far between you (the jewellery designer) and the customer:

Designer: What you want to make?, {}

Given the above conversation, please ask one concise and relevant follow-up question to gain a deeper understanding of the customer's design requirements. Your question should be clear and directly related to the previous responses.
`;

// Utility functions for Redis
const getUserConversation = (userId) => {
  return new Promise((resolve, reject) => {
    redisClient.get(userId, (err, data) => {
      if (err) {
        reject(new Error(`Error fetching user conversation: ${err.message}`));
      } else {
        resolve(data ? JSON.parse(data) : []);
      }
    });
  });
};

const saveUserConversation = (userId, conversation) => {
  return new Promise((resolve, reject) => {
    redisClient.set(userId, JSON.stringify(conversation), (err) => {
      if (err) {
        reject(new Error(`Error saving user conversation: ${err.message}`));
      } else {
        resolve();
      }
    });
  });
};

// Routes
app.post('/start', async (req, res) => {
  const userId = uuidv4();
  await saveUserConversation(userId, []);
  res.json({ user_id: userId });
});

app.post('/process', async (req, res) => {
  const { user_id, user_response } = req.body;

  try {
    // Retrieve user conversation from Redis
    const conversation = await getUserConversation(user_id);
    conversation.push(`Customer: ${user_response}`);

    // Generate prompt for follow-up question
    const prompt = PROMPT_TEMPLATE.replace('{}', conversation.join(', '));

    // Invoke Bedrock model to generate follow-up question
    const response = await bedrockClient.invokeModel({
      input: {
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: 8192,
          stopSequences: [],
          temperature: 0.6,
          topP: 0.4
        },
        modelId: 'amazon.titan-text-express-v1',
        accept: 'application/json',
        contentType: 'application/json'
      }
    });

    const followUpQuestion = response.results[0].outputText;
    conversation.push(`Designer: ${followUpQuestion}`);

    // Save updated conversation back to Redis
    await saveUserConversation(user_id, conversation);

    // Respond with the follow-up question
    res.json({ follow_up_question: followUpQuestion });
  } catch (error) {
    console.error('Error processing user response:', error);
    res.status(500).json({ detail: error.message });
  }
});

// The "catchall" handler: for any request that doesn't match the above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/client/build/index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
