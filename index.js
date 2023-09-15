const express = require('express');
const fs = require('fs-extra');
const axios = require('axios');
const stringSimilarity = require('string-similarity');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

const qaFile = 'bypass/new_qna.json';
const qna = JSON.parse(fs.readFileSync(qaFile));

const newQaFile = 'bypass/new_qna.json';
let newQna = {};
if (fs.existsSync(newQaFile)) {
  newQna = JSON.parse(fs.readFileSync(newQaFile));
}

// Function to update the bypass/qna.json file
function updateQnaFile(question, answer) {
  const qnaFilePath = path.join(__dirname, 'bypass', 'qna.json');

  try {
    let qnaData = {};
    if (fs.existsSync(qnaFilePath)) {
      const qnaContent = fs.readFileSync(qnaFilePath, 'utf-8');
      qnaData = JSON.parse(qnaContent);
    }

    if (!qnaData[question]) {
      qnaData[question] = [answer];
      fs.writeFileSync(qnaFilePath, JSON.stringify(qnaData, null, 2));
      console.log(`Added new question and answer to bypass/qna.json: ${question}`);
    } else if (!qnaData[question].includes(answer)) {
      qnaData[question].push(answer);
      fs.writeFileSync(qnaFilePath, JSON.stringify(qnaData, null, 2));
      console.log(`Added answer to an existing question in bypass/qna.json: ${question}`);
    }
  } catch (error) {
    console.error(`Error updating bypass/qna.json: ${error}`);
  }
}

app.get('/ask', async (req, res) => {
  try {
    const userQuestion = req.query.q;
    if (!userQuestion) {
      return res.status(400).json({ error: 'Please provide a question using the "q" query parameter.' });
    }

    let botAnswer = null;
    let matchedQuestion = null;
    let maxSimilarity = -1;

    for (const [question, answers] of Object.entries(qna)) {
      const similarity = stringSimilarity.compareTwoStrings(
        userQuestion.toLowerCase(),
        question.toLowerCase()
      );
      
      if (similarity > maxSimilarity && similarity >= 0.7) {
        maxSimilarity = similarity;
        matchedQuestion = question;
        botAnswer = answers[Math.floor(Math.random() * answers.length)];
      }
    }

    if (!botAnswer) {
      for (const [question, answers] of Object.entries(newQna)) {
        const similarity = stringSimilarity.compareTwoStrings(
          userQuestion.toLowerCase(),
          question.toLowerCase()
        );

        if (similarity > maxSimilarity && similarity >= 0.8) {
          maxSimilarity = similarity;
          matchedQuestion = question;
          botAnswer = answers[Math.floor(Math.random() * answers.length)];
        }
      }
    }

    if (!botAnswer) {
      const openaiApiKey = "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";
      /*
      Add here your openai apikey to give access to your api.
      Get Apikey from Here: https://platform.openai.com/account/api-keys
      */
      const openaiApiUrl = 'https://api.openai.com/v1/engines/text-davinci-003/completions';
      try {
        const response = await axios.post(
          openaiApiUrl,
          {
            prompt: `Q: ${userQuestion}\nA:`,
            temperature: 0.5,
            max_tokens: 2000,
            top_p: 0.3,
            frequency_penalty: 0.5,
            presence_penalty: 0.0,
            n: 1,
            stop: '\n',
          },
          {
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
             },
        });

        botAnswer = response.data.choices[0].text.trim();
        
        updateQnaFile(userQuestion, botAnswer); // Call to updateQnaFile for API answers
        // Check if the question is already in bypass/qna.json
    const qnaFilePath = path.join(__dirname, 'bypass', 'qna.json');
    if (fs.existsSync(qnaFilePath)) {
      const qnaContent = fs.readFileSync(qnaFilePath, 'utf-8');
      const qnaData = JSON.parse(qnaContent);
      if (qnaData[userQuestion]) {
        botAnswer = qnaData[userQuestion][0];
        return res.json({ answer: botAnswer });
      }
    }

    try {
      const response = await axios.post(
          openaiApiUrl,
          {
            prompt: `Q: ${userQuestion}\nA:`,
            temperature: 0.5,
            max_tokens: 2000,
            top_p: 0.3,
            frequency_penalty: 0.5,
            presence_penalty: 0.0,
            n: 1,
            stop: '\n',
          },
          {
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
             },
        });

        botAnswer = response.data.choices[0].text.trim();

      updateQnaFile(userQuestion, botAnswer); // Call to updateQnaFile for API answers
    } catch (err) {
      console.error(err);
    }

    res.json({ answer: botAnswer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred.' });
  }
      
    }

    if (matchedQuestion !== userQuestion && !newQna[userQuestion]) {
      newQna[userQuestion] = qna[matchedQuestion];
      fs.writeFileSync(newQaFile, JSON.stringify(newQna, null, 2));
    }

    res.json({ answer: botAnswer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred.' });
  }
});

// New endpoint to add a new question and answer to new_qna.json
app.get('/add', async (req, res) => {
  const userQuestion = req.query.question;
  const botAnswer = req.query.answer;

  if (!userQuestion || !botAnswer) {
    return res.status(400).json({ error: 'Please provide both "question" and "answer" query parameters.' });
  }

  newQna[userQuestion] = [botAnswer];
  fs.writeFileSync(newQaFile, JSON.stringify(newQna, null, 2));

  res.json({ message: 'Question and answer added successfully.' });
});

// New endpoint to update an existing question and answer in new_qna.json
app.get('/update', async (req, res) => {
  const userQuestion = req.query.question;
  const botAnswer = req.query.answer;

  if (!userQuestion || !botAnswer) {
    return res.status(400).json({ error: 'Please provide both "question" and "answer" query parameters.' });
  }

  if (!newQna[userQuestion]) {
    return res.status(404).json({ error: 'Question not found in new_qna.json.' });
  }

  if (newQna[userQuestion].includes(botAnswer)) {
    return res.status(400).json({ error: 'Existed question and answer detected! Please add a different answer to update response.' });
  }

  newQna[userQuestion].push(botAnswer);
  fs.writeFileSync(newQaFile, JSON.stringify(newQna, null, 2));

  res.json({ message: 'Question and answer updated successfully.' });
});
// New endpoint to delete a question and its answers from new_qna.json
app.get('/delete', async (req, res) => {
  const userQuestion = req.query.question;

  if (!userQuestion) {
    return res.status(400).json({ error: 'Please provide the "question" query parameter for deletion.' });
  }

  if (!newQna[userQuestion]) {
    return res.status(404).json({ error: 'Question not found in new_qna.json.' });
  }

  const botAnswer = newQna[userQuestion].join(', '); // Get all answers as a comma-separated string
  delete newQna[userQuestion]; // Delete the question and its answers
  fs.writeFileSync(newQaFile, JSON.stringify(newQna, null, 2));

  res.json({ message: `Successfully Deleted: ${userQuestion} = ${botAnswer}` });
})


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
