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
      console.log(
        `Questions collection already contains ${existingCount} questions.`,
      );

      console.log(
        "No questions were inserted. Run the reset command to replace them.",
      );

      return;
    }

    const insertedQuestions = await Question.insertMany(questions);

    console.log(`Successfully inserted ${insertedQuestions.length} questions.`);
  } catch (error) {
    console.error("Question seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

seedQuestions();
