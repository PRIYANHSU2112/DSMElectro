import mongoose from "mongoose";

const specificationSchema = new mongoose.Schema({
    key: { type: String, trim: true, required: true },
    detail: { type: String, trim: true, required: true },
});

const detailPointSchema = new mongoose.Schema({
    point: { type: String, trim: true, required: true },
});

const projectSchema = new mongoose.Schema(
    {
        title: { type: String, trim: true, required: true },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        subCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "subCategory",
            required: true,
        },


        projectType: {
            type: String,
            enum: ["beginner", "intermediate", "advance"],
            default: "beginner",
            required: true,
        },

        // Media
        icon: { type: String, default: null },
        banner: { type: String, default: null },
        images: [{ type: String }],
        video: { type: String, default: null },

        // Stats
        rating: { type: Number, default: 0, min: 0, max: 5 },
        totalRatings: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 },
        totalDownloads: { type: Number, default: 0 },

        // Pricing
        mrp: { type: Number, required: true, min: 0 },
        discount: { type: Number, default: 0, min: 0, max: 100 },
        discountAmount: { type: Number, default: 0 },
        finalPrice: { type: Number, default: 0 },

        // Content
        description: { type: String, trim: true },
        details: { type: String, trim: true },
        detailPoints: [detailPointSchema],
        specifications: [specificationSchema],
        keyFeatures: [{ type: String, trim: true }],
        advancedFeatures: [{ type: String, trim: true }],
        applications: [{ type: String, trim: true }],
        componentUsers: [{ type: String, trim: true }],

        sourceCode: { type: String, default: null },
        disable: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// Auto-compute pricing on save
projectSchema.pre("save", function () {
    const discountAmt = parseFloat(((this.mrp * this.discount) / 100).toFixed(2));
    this.discountAmount = discountAmt;
    this.finalPrice = parseFloat((this.mrp - discountAmt).toFixed(2));
});

projectSchema.index({ title: 1 });
projectSchema.index({ category: 1, subCategory: 1 });
projectSchema.index({ title: "text", description: "text" });

const projectModel = mongoose.model("Project", projectSchema);
export default projectModel;