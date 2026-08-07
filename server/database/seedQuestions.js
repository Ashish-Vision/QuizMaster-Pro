"use strict";

require("dotenv").config();

const mongoose = require("mongoose");

const connectDatabase = require("../config/database");
const Question = require("../models/Question");
const questions = require("./questions");

async function seedQuestions() {
  try {
    await connectDatabase();

    const existingCount = await Question.countDocuments();

    if (existingCount > 0) {
      console.info(
        `Questions collection already contains ${existingCount} questions.`,
      );

      console.info(
        "No questions were inserted. Run the reset command to replace them.",
      );

      return;
    }

    const insertedQuestions = await Question.insertMany(questions);

    console.info(
      `Successfully inserted ${insertedQuestions.length} questions.`,
    );
  } catch (error) {
    console.error("Question seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.info("MongoDB connection closed.");
  }
}

seedQuestions();
