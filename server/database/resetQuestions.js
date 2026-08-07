"use strict";

require("dotenv").config();

const mongoose = require("mongoose");

const connectDatabase = require("../config/database");
const Question = require("../models/Question");
const questions = require("./questions");

async function resetQuestions() {
  try {
    await connectDatabase();

    const deleteResult = await Question.deleteMany({});

    console.info(`Deleted ${deleteResult.deletedCount} existing questions.`);

    const insertedQuestions = await Question.insertMany(questions);

    console.info(
      `Successfully inserted ${insertedQuestions.length} questions.`,
    );
  } catch (error) {
    console.error("Question reset failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.info("MongoDB connection closed.");
  }
}

resetQuestions();
