// models/projectHero.model.js

import mongoose from "mongoose";

const cardSchema = new mongoose.Schema({
    icon: String,
    heading: String,
    subHeading: String,
    description: String,
});

const projectHeroSchema = new mongoose.Schema(
    {
        pageTitle: { type: String, required: true },
        subTitle: String,
        description: String,
        pageIcon: String,

        cards: [cardSchema],

        isActive: { type: Boolean, default: true }, // only 1 active hero
    },
    { timestamps: true }
);

export default mongoose.model("ProjectHero", projectHeroSchema);