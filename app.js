// require("dotenv").config();
// const OpenAI = require("openai");
// const fsPromises = require("fs").promises;
// const readline = require("readline").createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// // Create an OpenAI connection
// const secretKey = process.env.OPENAI_API_KEY;
// const openai = new OpenAI({
//   apiKey: secretKey,
// });

// async function askQuestion(question) {
//   return new Promise((resolve, reject) => {
//     readline.question(question, (answer) => {
//       resolve(answer);
//     });
//   });
// }

// async function main() {
//   try {
//     let assistantId;
//     const assistantFilePath = "./assistant.json";

//     // Check if the assistant.json file exists
//     try {
//       const assistantData = await fsPromises.readFile(
//         assistantFilePath,
//         "utf8"
//       );
//       assistantDetails = JSON.parse(assistantData);
//       assistantId = assistantDetails.assistantId;
//       console.log("\nExisting assistant detected.\n");
//     } catch (error) {
//       // If the file does not exist or there is an error in reading it, create a new assistant
//       console.log("No existing assistant detected, creating new.\n");
//       const assistantConfig = {
//         name: "Murder mystery helper",
//         instructions:
//           "You're a murder mystery assistant, helping solve murder mysteries.",
//         tools: [{ type: "retrieval" }], // configure the retrieval tool to retrieve files in the future
//         model: "gpt-4-1106-preview",
//       };

//       const assistant = await openai.beta.assistants.create(assistantConfig);
//       assistantDetails = { assistantId: assistant.id, ...assistantConfig };

//       // Save the assistant details to assistant.json
//       await fsPromises.writeFile(
//         assistantFilePath,
//         JSON.stringify(assistantDetails, null, 2)
//       );
//       assistantId = assistantDetails.assistantId;
//     }

//     // Log the first greeting
//     console.log(
//       `Hello there, I'm your personal assistant. You gave me these instructions:\n${assistantDetails.instructions}\n`
//     );

//     // Create a thread using the assistantId
//     const thread = await openai.beta.threads.create();

//     // Ask questions indefinitely
//     while (true) {
//       const userQuestion = await askQuestion("\nWhat is your question? ");

//       // Pass in the user question into the existing thread
//       await openai.beta.threads.messages.create(thread.id, {
//         role: "user",
//         content: userQuestion,
//       });

//       const run = await openai.beta.threads.runs.create(thread.id, {
//         assistant_id: assistantId,
//       });

//       let runStatus = await openai.beta.threads.runs.retrieve(
//         thread.id,
//         run.id
//       );

//       while (runStatus.status !== "completed") {
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//         runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

//         if (["failed", "cancelled", "expired"].includes(runStatus.status)) {
//           console.log(
//             `Run status is '${runStatus.status}'. Unable to complete the request.`
//           );
//           break; // Exit the loop if the status indicates a failure or cancellation
//         }
//       }

//       const messages = await openai.beta.threads.messages.list(thread.id);

//       // Find the last message for the current run
//       const lastMessageForRun = messages.data
//         .filter(
//           (message) => message.run_id === run.id && message.role === "assistant"
//         )
//         .pop();

//       if (lastMessageForRun) {
//         console.log(`${lastMessageForRun.content[0].text.value} \n`);
//       } else if (
//         !["failed", "cancelled", "expired"].includes(runStatus.status)
//       ) {
//         console.log("No response received from the assistant.");
//       }
//     }
//   } catch (error) {
//     console.error(error);
//   } finally {
//     // Close the readline interface
//     readline.close();
//   }
// }

// main();

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const fsPromises = require("fs").promises;
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

const app = express();
const port = process.env.PORT || 8880;

// Create an OpenAI connection
const secretKey = "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";
const openai = new OpenAI({
  apiKey: secretKey,
});

async function askQuestion(question) {
  return new Promise((resolve, reject) => {
    readline.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createAssistant() {
  try {
    const assistantFilePath = "./assistant.json";

    let assistantId;

    try {
      const assistantData = await fsPromises.readFile(
        assistantFilePath,
        "utf8"
      );
      assistantDetails = JSON.parse(assistantData);
      assistantId = assistantDetails.assistantId;
      console.log("\nExisting assistant detected.\n");
    } catch (error) {
      // If the file does not exist or there is an error in reading it, create a new assistant
      console.log("No existing assistant detected, creating new.\n");
      const assistantConfig = {
        name: "Murder mystery helper",
        instructions:
          "You're a murder mystery assistant, helping solve murder mysteries.",
        tools: [{ type: "retrieval" }], // configure the retrieval tool to retrieve files in the future
        model: "gpt-4-1106-preview",
      };

      const assistant = await openai.beta.assistants.create(assistantConfig);
      assistantDetails = { assistantId: assistant.id, ...assistantConfig };

      // Save the assistant details to assistant.json
      await fsPromises.writeFile(
        assistantFilePath,
        JSON.stringify(assistantDetails, null, 2)
      );
      assistantId = assistantDetails.assistantId;
    }

    return assistantId;
  } catch (error) {
    console.error(error);
    throw new Error("Error creating assistant");
  }
}

app.use(bodyParser.json());

app.post("/ask", async (req, res) => {
  try {
    const userQuestion = req.body.question;

    // Create a thread using the assistantId
    const assistantId = await createAssistant();
    const thread = await openai.beta.threads.create();

    const response = await processUserQuestion(
      thread,
      assistantId,
      userQuestion
    );

    // Return the response as JSON
    res.json({ response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function processUserQuestion(thread, assistantId, userQuestion) {
  // Pass in the user question into the existing thread
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: userQuestion,
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
  });

  // Wait for the completion of the run
  await waitForRunCompletion(thread.id, run.id);

  const messages = await openai.beta.threads.messages.list(thread.id);

  // Find the last message for the current run
  const lastMessageForRun = messages.data
    .filter(
      (message) => message.run_id === run.id && message.role === "assistant"
    )
    .pop();

  return lastMessageForRun ? lastMessageForRun.content[0].text.value : null;
}

async function waitForRunCompletion(threadId, runId) {
  let runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);

  while (runStatus.status !== "completed") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);

    if (["failed", "cancelled", "expired"].includes(runStatus.status)) {
      console.log(
        `Run status is '${runStatus.status}'. Unable to complete the request.`
      );
      break;
    }
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
